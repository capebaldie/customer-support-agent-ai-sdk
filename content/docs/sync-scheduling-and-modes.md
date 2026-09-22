---
title: Sync Modes and Scheduling
slug: sync-scheduling-and-modes
category: syncs
url: /docs/sync-scheduling-and-modes
updated: 2026-08-25
audience: engineer
---

# Sync Modes and Scheduling

Every table in a sync has a **mode** that decides how Meridian detects what changed, and every sync has a **schedule** that decides when it looks. These two choices drive your cost, your data freshness, and the load Meridian puts on your source.

## Choosing a mode

| Mode | Detects deletes | Source load | Requires | MAR efficiency |
| --- | --- | --- | --- | --- |
| Full refresh | Yes, implicitly | Highest | Nothing | Worst |
| Incremental | No | Low | A cursor column | Good |
| Log-based CDC | Yes | Lowest | Source log access | Best |

The short version: **use CDC where you can, incremental where you cannot, and full refresh only for small tables.**

## Full refresh

Meridian reads every row in the table and rewrites the destination table.

**Use it for** small dimension and lookup tables — currencies, countries, product categories, feature flags — where a full read is cheap, and for any source that offers no reliable way to detect change.

**Do not use it for** large fact tables. Reading 40 million rows every hour hammers your source and, because every row is rewritten, consumes MAR on rows that did not change.

Two write strategies:

- **Overwrite** (default) — Meridian loads into a staging table and atomically swaps. Readers never see a partial table. The destination always mirrors the source exactly.
- **Append** — each run appends a new copy tagged with `_meridian_batch_id`. This builds a snapshot history and is useful for slowly changing dimensions, but the table grows every run and every row counts toward MAR every time. Watch both cost and size.

Full refresh on a table with no primary key is allowed; every other mode is not.

## Incremental

Meridian queries only rows whose **cursor column** is greater than the highest value it saw last run.

```sql
SELECT * FROM orders WHERE updated_at > '2026-09-01T14:00:00Z' ORDER BY updated_at;
```

### Picking a cursor column

A good cursor is **monotonically increasing** and **updated on every write**. In descending order of preference:

1. `updated_at` / `modified_at` — a timestamp your application sets on every insert and update. Best choice.
2. An auto-incrementing integer ID — works only for insert-only tables, since it does not change when a row is updated.
3. `created_at` — insert-only tables only, same caveat.

Meridian auto-detects a likely cursor and shows you what it picked. **Verify it.** A wrong cursor produces silently missing data, which is worse than a failure.

### The three ways incremental loses rows

Understand these before relying on incremental for anything important.

**Deletes are invisible.** A hard-deleted row has no updated timestamp, so Meridian never learns about it and it stays in the destination forever. If deletes matter, use CDC, or have your application soft-delete with a `deleted_at` column that also bumps the cursor.

**Application code that skips the timestamp.** A backfill script, an admin console, or a `UPDATE ... SET status = 'x'` run by hand that does not touch `updated_at` will never be picked up. Enforce it with a database trigger:

```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Long transactions with clock-ordering gaps.** A transaction that starts at 14:00:00, writes a row stamped 14:00:00, and commits at 14:00:30 is invisible to a sync that read up to 14:00:10 at 14:00:15. The row exists with an older timestamp than the watermark, so it is never selected.

Meridian mitigates this with a configurable **cursor lag** — a safety window it subtracts from the high-water mark, defaulting to 60 seconds. Rows are re-read within that window and deduplicated by primary key, so nothing is double-billed. If your source has transactions longer than a minute, raise the lag to exceed your longest transaction.

### Deduplication

Incremental runs upsert on the primary key. A row updated three times between runs arrives once, at its final state, and counts as 1 MAR.

## Log-based CDC

Meridian reads the source's own change log — the Postgres WAL, the MySQL binlog, the MongoDB oplog, the SQL Server transaction log — instead of querying tables.

This is the best mode available, for four reasons:

- **Deletes are captured**, because they appear in the log like any other change.
- **Source load is near zero.** No `SELECT` runs against your tables; Meridian tails a log the database is already writing.
- **Every intermediate change is seen**, so a row updated and then reverted is not silently missed.
- **MAR is minimal**, because only genuine changes are read.

CDC requires **Growth or above** and server-side configuration, described per source in [Sources and Connectors](/docs/connectors-sources).

### Operational realities of CDC

**Log retention is a hard deadline.** Meridian's read position in the log must stay inside the retention window. If a sync is paused, or fails repeatedly, or your source's retention is too short, the position falls off the end of the log and the sync fails with `SYNC-105`. Recovery means a full historical resync, which is expensive.

Set retention to at least 7 days on every CDC source.

**Postgres replication slots retain WAL until consumed.** A slot with nothing reading it makes Postgres keep WAL segments indefinitely, which fills the disk and takes the database down. This is the single most damaging CDC failure mode. If you pause a Postgres CDC sync for more than a day, either monitor slot lag or drop the slot and plan to resync. Set `max_slot_wal_keep_size` as a safety net.

**Schema changes flow through the log.** A DDL statement appears in the change stream, and Meridian applies compatible changes automatically. Incompatible ones stop the sync with `SYNC-301` or `SYNC-303`. See the schema change table in [Destinations](/docs/destinations).

### Change history mode

An option on CDC tables. Instead of upserting current state, Meridian appends every individual change as its own row with an operation column (`insert`, `update`, `delete`) and a log timestamp.

This gives you a full audit trail and lets you reconstruct state at any past moment. The cost is size and MAR — every change is a row, so a heavily updated table can produce far more rows in the destination than exist at the source. Enable it deliberately, for tables where history is genuinely the point.

## Scheduling

### Interval scheduling

Pick an interval. The minimum depends on your plan:

| Plan | Minimum interval |
| --- | --- |
| Starter | 24 hours |
| Growth | 1 hour |
| Scale | 15 minutes |
| Enterprise | 5 minutes |

Meridian schedules the next run **after the previous one completes**, not on a fixed wall clock. A sync set to run hourly that takes 20 minutes runs at roughly 00:00, 01:20, 02:40. This prevents runs from stacking up when the source is slow.

### Cron scheduling

Growth and above support cron expressions for precise timing, in a timezone you choose:

```
0 6 * * *        every day at 06:00
0 */4 * * *      every 4 hours
0 2 * * 1-5      weekdays at 02:00
30 23 L * *      last day of the month at 23:30
```

Cron is the right choice when a downstream job depends on the data landing before a fixed time — dbt at 07:00, a report at 08:00.

If a cron-scheduled run comes due while the previous run is still going, the new run is **skipped**, not queued, and a warning is logged. Two runs of the same sync never overlap.

### Manual and API triggering

Click **Sync now**, or `POST /v1/syncs/{id}/trigger`. Triggering a running sync returns `409 sync_already_running`.

API triggering is how you build a real pipeline: run the sync, wait for the `sync.completed` webhook, then kick off your transformations. Polling works too but wastes rate limit — subscribe to the webhook instead.

### Concurrency limits

| Plan | Concurrent runs |
| --- | --- |
| Starter | 1 |
| Growth | 5 |
| Scale | 20 |
| Enterprise | Custom |

Runs beyond the limit are **rejected, not queued**, with `SYNC-403` or `429 concurrent_sync_limit`.

Stagger schedules so peaks do not collide. Ten syncs all set to "hourly" created in the same session will all fire together on the hour. Offset them with cron — `5 * * * *`, `15 * * * *`, and so on.

## Selecting tables and columns

Sync only what is used. Every synced row costs MAR, and unused tables are the most common cause of a bill nobody expected.

**Column selection** is available per table. Deselecting columns reduces bytes transferred and keeps sensitive fields out of the destination entirely, but it does **not** reduce MAR — MAR counts rows, not columns.

Deselecting a column that is already in the destination stops future writes to it. Existing values stay until you drop the column yourself.

**Auto-add new tables**, off by default, brings newly created source tables into the sync automatically. Convenient and occasionally expensive: someone creates a 200 million row table and your next bill reflects it. Leave it off in production.

## Historical resync

A **resync** discards Meridian's saved state for a table and reloads it from scratch.

Resync when:

- A CDC sync failed with `SYNC-105` because log retention was exceeded.
- You changed a cursor column or primary key.
- You suspect the destination has drifted from the source.
- You changed sync mode on a table.

Start one from **Syncs → [sync] → Tables → [table] → Resync**. Resync a single table, not the whole sync, unless you truly need everything.

A resync counts every reloaded row toward MAR at full rate. There is no discount. Check the estimated row count Meridian shows before confirming.

While a resync runs, the destination table keeps serving its previous data. The swap happens atomically at the end.

## Pausing

Pause at **Syncs → [sync] → Pause**, or `POST /v1/syncs/{id}/pause`. Paused syncs consume no MAR.

On resume, Meridian picks up from where it stopped. Rows changed during the pause are collected on the next run.

The exception is CDC: if the pause outlasts your source's log retention, resuming fails with `SYNC-105` and requires a resync. **Pausing a Postgres CDC sync also leaves its replication slot in place**, and that slot will accumulate WAL for the entire pause. Do not pause a Postgres CDC sync for days without watching disk on the source.

## Sync duration limits

| Plan | Maximum run duration |
| --- | --- |
| Starter | 2 hours |
| Growth | 12 hours |
| Scale | 24 hours |
| Enterprise | 24 hours |

A run that exceeds its limit is terminated with `SYNC-402`. Tables completed before the cutoff stay committed; the run is marked `partial` and the next run resumes from there.

Runs that keep hitting the limit usually mean one enormous table. Split it into its own sync, narrow the historical window, or move it to CDC so it stops re-reading unchanged rows.
