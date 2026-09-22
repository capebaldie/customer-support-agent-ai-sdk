---
title: Sources and Connectors
slug: connectors-sources
category: connectors
url: /docs/connectors-sources
updated: 2026-08-18
audience: engineer
---

# Sources and Connectors

A **source** is where Meridian reads data from. This page covers the supported sources, how to set up the common ones, and the network options for reaching a database that is not on the public internet.

## Supported sources

| Source | Type | Sync modes | Minimum plan |
| --- | --- | --- | --- |
| PostgreSQL | Database | Full refresh, Incremental, Log-based CDC | Starter |
| MySQL / MariaDB | Database | Full refresh, Incremental, Log-based CDC | Starter |
| MongoDB | Database | Full refresh, Incremental, Log-based CDC | Starter |
| SQL Server | Database | Full refresh, Incremental, Log-based CDC | Growth |
| Stripe | SaaS API | Full refresh, Incremental | Starter |
| Salesforce | SaaS API | Full refresh, Incremental | Starter |
| Shopify | SaaS API | Full refresh, Incremental | Starter |
| HubSpot | SaaS API | Full refresh, Incremental | Starter |
| Zendesk | SaaS API | Full refresh, Incremental | Starter |
| Intercom | SaaS API | Full refresh, Incremental | Growth |
| Google Ads | SaaS API | Full refresh, Incremental | Growth |
| Amazon S3 | File | Full refresh, Incremental | Growth |
| NetSuite | SaaS API | Full refresh, Incremental | Enterprise |

Log-based CDC requires **Growth or above** regardless of source.

Missing a source? Request it at [meridiandata.com/connector-requests](https://meridiandata.com/connector-requests). Enterprise customers can commission a custom connector; typical delivery is 6–8 weeks.

## Credentials are write-only

Once you save a credential, nobody can read it back — not an Admin, not the Owner, not Meridian support. Secrets are encrypted with AES-256 using per-workspace keys held in AWS KMS.

The practical consequence: **store your credentials in your own password manager too.** If you need to change a firewall rule six months from now and cannot remember which database user Meridian uses, Meridian cannot tell you the password.

## Use a dedicated read-only user

For every database source, create a user that exists only for Meridian. Never reuse an application user.

This gives you three things: you can revoke Meridian's access without touching anything else, source-side query logs clearly attribute load to Meridian, and a leaked credential cannot write.

## PostgreSQL

### Read-only user for full refresh and incremental

```sql
CREATE USER meridian WITH PASSWORD 'use-a-long-random-password';
GRANT CONNECT ON DATABASE analytics TO meridian;
GRANT USAGE ON SCHEMA public TO meridian;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO meridian;

-- so future tables are readable too
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO meridian;
```

### Additional setup for log-based CDC

CDC reads the write-ahead log instead of querying tables, so it adds almost no query load and it captures deletes. It needs configuration on the server.

1. Set `wal_level = logical` in `postgresql.conf` and **restart** Postgres. A reload is not enough.

2. Confirm you have spare replication slots:

   ```sql
   SHOW max_replication_slots;   -- must be at least 1 higher than currently used
   SELECT count(*) FROM pg_replication_slots;
   ```

3. Grant replication:

   ```sql
   ALTER USER meridian WITH REPLICATION;
   ```

4. Create a publication for the tables you want:

   ```sql
   CREATE PUBLICATION meridian_pub FOR TABLE public.orders, public.customers;
   ```

   Prefer naming tables explicitly over `FOR ALL TABLES`. With `FOR ALL TABLES`, a table someone adds later silently enters your pipeline and your bill.

5. In Meridian, enable **Log-based CDC** on the connection and enter the publication name. Meridian creates its own replication slot, named `meridian_<connection_id>`.

6. Ensure every replicated table has a primary key, or set `REPLICA IDENTITY FULL` on those that do not. Without one, updates and deletes cannot be matched to a destination row and the table fails with `SYNC-302`.

**The most important operational warning about CDC:** an unconsumed replication slot makes Postgres retain WAL segments forever, and that will eventually fill your disk and take the database down. If you pause a Meridian sync for a long time, or delete the sync without deleting the connection, monitor slot lag:

```sql
SELECT slot_name,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS lag
FROM pg_replication_slots
WHERE slot_name LIKE 'meridian_%';
```

Set `max_slot_wal_keep_size` (Postgres 13+) to cap the damage. If retention is exceeded, the sync fails with `SYNC-105` and needs a historical resync.

### Read replicas

Pointing Meridian at a read replica is good practice for full refresh and incremental. For CDC, note that logical replication slots on a physical replica are only supported from **Postgres 16** onward. On older versions, CDC must connect to the primary.

## MySQL and MariaDB

```sql
CREATE USER 'meridian'@'%' IDENTIFIED BY 'use-a-long-random-password';
GRANT SELECT, RELOAD, SHOW DATABASES, REPLICATION SLAVE, REPLICATION CLIENT
  ON *.* TO 'meridian'@'%';
FLUSH PRIVILEGES;
```

`RELOAD`, `REPLICATION SLAVE`, and `REPLICATION CLIENT` are only needed for CDC. For full refresh and incremental, `SELECT` on the relevant schemas is enough.

Server settings for CDC, in `my.cnf`:

```ini
server-id        = 1
log_bin          = mysql-bin
binlog_format    = ROW
binlog_row_image = FULL
binlog_expire_logs_seconds = 604800   # 7 days
```

`binlog_format = ROW` is mandatory. With `STATEMENT` or `MIXED`, Meridian cannot reconstruct row-level changes and the connection test fails.

Set binlog retention to at least **7 days**. Shorter retention means an outage over a long weekend can outrun the log and force a full resync.

## MongoDB

Meridian reads MongoDB change streams for CDC, which requires a replica set or a sharded cluster. A standalone `mongod` cannot do CDC — use incremental instead.

```javascript
db.createUser({
  user: "meridian",
  pwd: "use-a-long-random-password",
  roles: [
    { role: "read", db: "production" },
    { role: "read", db: "local" }
  ]
})
```

The `local` database grant is what allows the oplog read behind change streams.

MongoDB documents have no fixed schema, so Meridian samples **1,000 documents per collection** to infer one. Fields absent from every sampled document are not created in the destination. If a rare field matters, raise the sample size in connection settings, up to 100,000, or declare the field manually.

Nested objects are flattened with `__` as the separator: `address.city` becomes `address__city`. Arrays are written as JSON strings unless you enable **Unnest arrays**, which creates a child table per array field.

## Salesforce

Connect with OAuth. Click **Authorize with Salesforce**, sign in, and approve.

**Authorize with a dedicated integration user, not your own login.** If you use a personal account, the connection breaks the day you change your password, lose the account, or leave the company — surfacing as `SYNC-101`.

The integration user needs:

- **API Enabled** on its profile.
- **View All Data**, or object-level Read on exactly the objects you sync.
- **View All Custom Settings** if you sync custom settings objects.

Meridian uses the Bulk API 2.0 for backfills and the REST API for incremental runs, and honors your org's daily API request allocation. If you are close to that limit, lower the sync frequency — an exhausted allocation surfaces as `SYNC-103`.

Formula fields and rollup summaries are synced as computed values at read time. They are not recomputed in the destination, so a formula that depends on the current date will drift after it lands.

Deleted records are captured when **Sync deleted records** is enabled, which reads the Recycle Bin. Salesforce purges the Recycle Bin after 15 days, so a sync paused longer than that will miss deletes permanently.

## Stripe

Paste a **restricted API key** (`rk_live_...`) with read permissions on the resources you want. Do not paste a full secret key — Meridian only ever reads.

Available objects: `charges`, `customers`, `invoices`, `subscriptions`, `payment_intents`, `payouts`, `balance_transactions`, `disputes`, `refunds`, `products`, `prices`, `events`.

Stripe's API only exposes the `events` object for the last **30 days**, so a backfill of `events` reaches 30 days back and no further. Every other object backfills to the beginning of your account.

## Amazon S3

Point Meridian at a bucket and a prefix. Supported formats: CSV, JSON, JSONL, Parquet, Avro, and gzip-compressed versions of each.

Authenticate one of two ways:

- **IAM role assumption (recommended).** Meridian gives you an external ID; create a role in your AWS account trusting Meridian's account with that external ID, and paste the role ARN back. No long-lived keys.
- **Access key pair.** Simpler, but a static credential you must rotate yourself.

The role or user needs `s3:GetObject` and `s3:ListBucket` on the bucket and prefix.

Meridian tracks which files it has already processed by key and ETag. Overwriting a file with new content changes its ETag and causes reprocessing. Appending to a file is not detected — write new files instead.

## Reaching a private database

Three options, in descending order of preference.

### 1. IP allowlisting

Simplest. Open your firewall to Meridian's static egress IPs for your region — listed in [Getting Started](/docs/getting-started) — and require TLS.

### 2. SSH tunnel

If the database cannot be exposed at all, put a bastion host in front of it.

1. In connection settings, choose **Connect via SSH tunnel**.
2. Enter the bastion host, port, and SSH username.
3. Meridian generates a public key. Add it to `~/.ssh/authorized_keys` on the bastion.
4. Test the connection.

The bastion needs to accept SSH from Meridian's egress IPs and reach the database. Meridian never needs a shell — restrict the tunnel user with `command=""`, `no-pty`, and `permitopen` limited to the database host and port.

### 3. Reverse tunnel

For networks that permit no inbound connections at all, run Meridian's lightweight agent inside your VPC. It opens an outbound-only connection to Meridian and proxies queries back.

The agent is a single container (`meridiandata/agent:latest`), needs 512 MB of memory, and requires outbound HTTPS to `agent.meridiandata.com:443`. Reverse tunnels are **Enterprise only**.

## Rotating a source credential

1. Create the new credential at the source.
2. In Meridian, edit the connection and paste it.
3. Click **Test connection**.
4. Save. In-flight runs finish with the old credential; the next run uses the new one.
5. Revoke the old credential at the source.

Do not revoke before step 4 succeeds. A revoked credential mid-run produces `SYNC-101` and a failed run.

## Deleting a connection

Delete at **Connections → [connection] → Delete**. Any sync using it must be deleted first, or the API returns `409 resource_conflict`.

For Postgres CDC sources, deleting the connection in Meridian also drops the replication slot. If you delete the connection some other way — for example by deleting the whole workspace — **drop the slot yourself**, or Postgres will retain WAL indefinitely:

```sql
SELECT pg_drop_replication_slot('meridian_conn_4a7e8d');
```
