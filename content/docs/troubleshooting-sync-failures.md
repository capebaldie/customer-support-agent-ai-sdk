---
title: Troubleshooting Sync Failures
slug: troubleshooting-sync-failures
category: troubleshooting
url: https://docs.meridiandata.com/troubleshooting-sync-failures
updated: 2026-09-03
audience: engineer
---

# Troubleshooting Sync Failures

Every failed sync run reports a `SYNC-xxx` code. This page lists all of them with causes and fixes.

Codes are grouped by where the problem is:

| Range | Area |
| --- | --- |
| `SYNC-1xx` | Source — connectivity, authentication, source-side limits |
| `SYNC-2xx` | Destination — authentication, permissions, capacity |
| `SYNC-3xx` | Schema — structure mismatches between source and destination |
| `SYNC-4xx` | Limits — plan quotas, durations, concurrency |

For REST API request errors rather than sync run failures, see [API Error Codes](https://docs.meridiandata.com/api-error-codes).

## Where to look first

1. Open **Syncs → [sync] → Runs** and click the failed run.
2. Read the error code and message at the top. The message names the specific table and, where relevant, the specific column.
3. Click **View logs** for the full run log. Logs are retained for 7 days on Starter, 30 on Growth, 90 on Scale, and 365 on Enterprise.
4. Note the **run ID** (`run_2c9f14`). Include it in any support request — it lets support find the exact run immediately.

## Source errors — `SYNC-1xx`

### Authentication failed

Meridian reached the source or the destination but the credentials were rejected.

Common causes, in the order they actually happen:

- **A password was rotated at the source** and not updated in Meridian.
- **An OAuth connection was authorized with a personal account** and that person changed their password, lost access, or left the company. Reauthorize with a dedicated integration user.
- **The user was dropped or locked** at the source.
- **A permission was revoked**, so the login works but the required grant is gone.
- **IP restriction at the source** — Salesforce login IP ranges, Snowflake network policies, and Postgres `pg_hba.conf` all produce authentication-shaped errors when they are really network rules.

Warehouse-specific causes:

- **Snowflake** — password expired, key-pair rotated, user disabled, or a network policy blocking Meridian's IPs.
- **BigQuery** — service account key deleted or disabled, or the service account removed from the project.
- **Redshift** — password changed, or the cluster is in a different VPC than the security group allows.
- **Databricks** — personal access token expired. Tokens have a maximum lifetime; check the expiry.

Fix: edit the connection, enter working credentials, click **Test connection**, save. The next scheduled run picks it up, or trigger one manually.

### `SYNC-102` — Source unreachable

Meridian could not open a network connection at all. This is a network problem, not a credentials problem.

Check in order:

1. **Firewall.** Are Meridian's egress IPs for your region allowlisted? They are listed in [Getting Started](https://docs.meridiandata.com/getting-started). Somebody tightening a security group is the most common cause of a connection that worked yesterday.
2. **Host and port.** Verify from outside your network, not from a machine inside the VPC where it will always work.
3. **The database is down or failed over.** Check the source itself.
4. **DNS.** A hostname that resolves internally but not publicly fails here.
5. **SSH tunnel.** If you use one, is the bastion up and is Meridian's public key still in `authorized_keys`?
6. **TLS.** An expired or self-signed certificate on the source is rejected unless you have supplied the CA certificate in connection settings.

### `SYNC-103` — Source rate limited

A SaaS source returned its own rate limit or quota error.

- **Salesforce** — daily API request allocation exhausted. Check **Setup → System Overview**. Lower sync frequency or raise the allocation.
- **Shopify, HubSpot, Zendesk, Intercom** — per-second or per-minute limits. Meridian backs off and retries automatically; this code appears only when backoff is exhausted.
- **Google Ads** — daily operation quota.

Meridian retries with exponential backoff before reporting this, so seeing it means the limit is genuinely saturated. Reduce frequency, sync fewer objects, or ask the vendor for a higher quota. Another integration sharing the same credentials is a frequent hidden cause — give Meridian its own.

### `SYNC-104` — Replication slot missing

Postgres CDC only. The replication slot Meridian created no longer exists.

Usually someone dropped it manually, often while clearing disk space, or the database was restored from a backup or failed over to a replica — slots do not survive either.

Fix: edit the connection and click **Recreate replication slot**. Meridian creates a new slot starting at the current WAL position, which means changes made between the slot being dropped and recreated are lost. **Run a historical resync on the affected tables** to close that gap.

### `SYNC-105` — Log retention exceeded

CDC on any source. Meridian's read position fell outside the source's log retention window, so the changes it needs no longer exist.

Causes:

- The sync was paused, broken, or failing for longer than the retention window.
- Retention is configured too short. Postgres `max_slot_wal_keep_size`, MySQL `binlog_expire_logs_seconds`, or MongoDB oplog size.
- A bulk operation generated enough log volume to age out the window in hours.

There is no way to recover the missing changes. Fix:

1. Raise retention at the source to at least 7 days.
2. Run a historical resync on the affected tables.

The resync counts fully toward MAR. For a large table, contact support@meridiandata.com first — credits are available in advance, not retroactively.

To prevent recurrence, alert on `connection.broken` and `sync.failed` webhooks so a broken CDC sync is fixed in hours rather than discovered a week later.

### `SYNC-106` — Source schema or table not found

A table or schema in the sync no longer exists at the source. It was renamed, dropped, or moved, or the Meridian user's grant to it was revoked.

Fix: remove the table from the sync, or restore it at the source. If it was renamed, add the new name as a new table — Meridian treats it as a different table and it needs a backfill.

### `SYNC-107` — Source query timeout

A query against the source exceeded the timeout, by default 30 minutes per query.

Almost always a full refresh on a very large table, or a missing index on the cursor column making incremental scans do a sequential read.

Fix:

- **Index the cursor column.** `CREATE INDEX CONCURRENTLY ON orders (updated_at);` This one change resolves most occurrences.
- Switch the table from full refresh to incremental or CDC.
- Raise **Query timeout** in connection settings, up to 2 hours.
- Lower **Batch size** so each query does less work.

## Destination errors — `SYNC-2xx`

### `SYNC-202` — Destination permission denied

Authentication worked; the role cannot do what Meridian needs. This is the most common first-sync failure.

Meridian needs `CREATE TABLE` in its schema, not just `SELECT` and `INSERT`. It creates tables on first sync and alters them when the source schema changes.

The message names the exact missing privilege. Full grant scripts per warehouse are in [Destinations](https://docs.meridiandata.com/destinations).

Watch for grants that cover existing objects but not future ones. In Snowflake you need `GRANT ALL ON FUTURE TABLES IN SCHEMA ...`; without it, the first sync succeeds and the second fails.

### `SYNC-203` — Destination storage full

The destination is out of space or over a quota.

- **Redshift** — cluster disk full. Add nodes, resize, or `VACUUM` to reclaim space from deleted rows.
- **PostgreSQL** — disk full.
- **BigQuery / Snowflake / Databricks** — rare, since storage is elastic, but possible against an org-level quota or spending cap.

Also check your staging bucket. Redshift loads stage through S3, and a bucket policy denying writes reports as a storage error.

### `SYNC-204` — Destination timeout or unavailable

The destination did not respond in time, or refused the operation.

- **Snowflake** — warehouse suspended and slow to resume, or queuing behind other work. Increase warehouse size or give Meridian its own warehouse.
- **BigQuery** — load job quota exceeded, 1,500 per table per day. Lower sync frequency.
- **Redshift** — the load queued behind long-running queries. Give Meridian a WLM queue with guaranteed slots.
- **Databricks** — SQL warehouse cold-starting. Enable serverless or raise the auto-stop timeout.

Meridian retries transient timeouts automatically before reporting.

### `SYNC-205` — Destination object modified externally

A table Meridian manages was altered outside Meridian — columns dropped, types changed, the table recreated, or a view put in its place.

Fix: revert the change, or resync the table so Meridian rebuilds it correctly.

Prevention: give Meridian a schema nobody else writes to and build models in a separate schema that reads from it.

## Schema errors — `SYNC-3xx`

### `SYNC-301` — Incompatible schema change

A source schema change cannot be applied without data loss. The usual trigger is a changed primary key, or a table dropped and recreated with a different structure.

Fix: run a historical resync on the affected table. Meridian rebuilds it to match the new structure.

### `SYNC-302` — Primary key missing

The table has no primary key, and incremental and CDC modes both need one to match a source row to a destination row.

Options, in order of preference:

1. **Add a primary key at the source.** Correct fix.
2. **Define a composite key in Meridian.** In table settings, pick a set of columns that is unique together. Meridian trusts you — if it is not actually unique, you will get duplicate or overwritten rows.
3. **Use full refresh** for that table. Works without a key, but rereads everything each run.

For Postgres CDC, `REPLICA IDENTITY FULL` on the table also satisfies this, at the cost of larger WAL entries.

### `SYNC-303` — Column type conflict

The source column type changed in a way the destination cannot accept — `integer` to `varchar`, `timestamp` to `text`, or a numeric precision reduction.

Meridian handles widening automatically (`int` → `bigint`, `varchar(50)` → `varchar(200)`). It refuses narrowing and cross-family changes, because applying them would silently corrupt existing rows.

Fix one of three ways:

- **Resync the table** so Meridian recreates it with the new type. Existing destination data for that table is rebuilt.
- **Alter the destination column yourself** to a compatible type, then resume.
- **Deselect the column** if you do not need it.

### `SYNC-304` — Unsupported data type

The source has a type with no destination equivalent — Postgres geometric types, custom composite types, or an enum array.

Meridian's fallback is to write the value as a JSON or text string where it can. `SYNC-304` means even that is impossible.

Fix: deselect the column, or create a view at the source that casts it to a supported type and sync the view instead.

### `SYNC-305` — Row size exceeded

A single row is larger than the limit: 8 MB on Starter, 16 MB on Growth, 32 MB on Scale and Enterprise.

Nearly always a large text or blob column — a serialized document, a base64 image, a giant JSON payload.

Fix: deselect the oversized column, or sync a view that truncates it. Warehouses are the wrong place for blobs; keep them in object storage and sync the URL.

## Limit errors — `SYNC-4xx`

### `SYNC-401` — MAR limit reached

You hit your plan's included MAR with a hard usage cap enabled, or you are on Starter, which always caps at 100,000 MAR.

Syncs are paused. Nothing is lost; they resume on the first of the next month, or immediately when you raise the cap or upgrade.

Fix: raise or disable the cap at **Settings → Billing**, or upgrade. To find what consumed the allowance, open **Settings → Billing → Usage** and sort by MAR descending — a table nobody uses is usually at the top.

### `SYNC-402` — Sync duration exceeded

The run exceeded the maximum duration for your plan: 2 hours on Starter, 12 on Growth, 24 on Scale and Enterprise.

Tables completed before the cutoff stay committed. The run is marked `partial` and the next run resumes from there, so a sync that is merely slow will eventually catch up across several runs.

If it never catches up:

- Split the largest table into its own sync so it does not block the others.
- Move the table from full refresh to incremental or CDC.
- Narrow the historical sync window.
- Index the cursor column.
- Upgrade for a longer limit.

### `SYNC-403` — Concurrent sync limit

You are at your plan's concurrent run limit: 1 on Starter, 5 on Growth, 20 on Scale.

Runs are **not queued** — the trigger is rejected.

Fix: stagger schedules with cron instead of leaving everything on the same interval. Ten syncs created as "hourly" in one sitting all fire on the hour. Offset them: `0 * * * *`, `10 * * * *`, `20 * * * *`.

### `SYNC-404` — Connection limit exceeded

The sync references a connection beyond your plan's allowance, usually after a downgrade. Starter allows 3 source connections and 1 destination.

Fix: delete unused connections, or upgrade.

## Problems with no error code

### The sync succeeds but data is missing

Almost always incremental mode losing rows. In order of likelihood:

1. **Deletes are not captured.** Incremental cannot see them by design. Use CDC.
2. **The cursor column is not updated on every write.** A backfill script or manual `UPDATE` that skips `updated_at` is invisible. Add a trigger.
3. **Long transactions fall behind the watermark.** Raise **cursor lag** above your longest transaction.
4. **A wrong cursor column was auto-detected.** Verify it is a column that changes on update, not just on insert.

Confirm by comparing counts:

```sql
-- source
select count(*) from orders where updated_at >= '2026-09-01';

-- destination
select count(*) from meridian_prod.orders
where updated_at >= '2026-09-01' and not _meridian_deleted;
```

### The sync runs but nothing changes

The source genuinely has no changes, or the sync is paused, or every table is deselected. Check the run detail: `rows_synced: 0` with status `completed` means Meridian looked and found nothing.

### Rows appear then disappear

Something else is writing to Meridian's destination schema — a dbt model with the same name, or a manual script. Give Meridian an exclusive schema.

### Duplicate rows in the destination

A composite primary key defined in Meridian that is not actually unique at the source. Verify:

```sql
select customer_id, order_date, count(*)
from orders group by 1, 2 having count(*) > 1;
```

If that returns rows, the key is wrong. Pick a genuinely unique set of columns and resync.

## Getting help

Include these four things and support can usually answer in one round trip instead of three:

1. The **run ID** (`run_2c9f14`) or **request ID** (`req_7d3f9a2b8c1e`).
2. The **error code** and full message.
3. **When it last worked** and what changed around then.
4. What you have already tried.

Email support@meridiandata.com, or use in-app chat on Scale and above. Response times by plan and severity are in [Support and SLA](https://docs.meridiandata.com/support-and-sla).
