---
title: Destinations
slug: destinations
category: connectors
url: /docs/destinations
updated: 2026-08-11
audience: engineer
---

# Destinations

A **destination** is the warehouse Meridian writes to. This page covers the supported destinations, the exact grants each one needs, and how Meridian shapes the data it writes.

## Supported destinations

| Destination | Minimum plan | Notes |
| --- | --- | --- |
| Snowflake | Starter | Key-pair or password auth |
| Google BigQuery | Starter | Service account JSON |
| Amazon Redshift | Growth | Provisioned and Serverless |
| Databricks | Growth | Unity Catalog required |
| PostgreSQL | Starter | Also used for Meridian Sandbox |
| Amazon S3 | Growth | Parquet or JSONL files, not a queryable table |
| Microsoft Fabric | Enterprise | Preview |

Destination count is capped by plan: 1 on Starter, 3 on Growth, 10 on Scale, unlimited on Enterprise. Extra destinations are available as a $150/month add-on on Growth and Scale.

## Give Meridian its own schema

Create a schema or dataset that only Meridian writes to, such as `meridian_prod`.

Meridian alters tables in that schema to match the source: adding columns, widening types, and recreating tables during a full resync. Anything a person creates or edits by hand there will eventually be overwritten. Build your models in a separate schema that reads from Meridian's.

## How Meridian writes data

### Naming

Source schemas and table names are lowercased and non-alphanumeric characters become underscores. `Sales.Order Items` becomes `sales_order_items`. Set a per-sync prefix in sync settings if you want to namespace by source.

### Metadata columns

Every table gets four extra columns:

| Column | Type | Meaning |
| --- | --- | --- |
| `_meridian_synced_at` | `timestamp` | When Meridian last wrote this row |
| `_meridian_deleted` | `boolean` | `true` if deleted at the source |
| `_meridian_row_hash` | `varchar(64)` | Content hash used to skip unchanged rows |
| `_meridian_batch_id` | `varchar(32)` | The run that last touched this row |

### Deletes are soft by default

A row deleted at the source is **not** removed from your destination. Meridian sets `_meridian_deleted = true` and leaves it in place, so history survives and a bad delete at the source is recoverable.

Filter it out in your queries:

```sql
select * from meridian_prod.orders where not _meridian_deleted;
```

Turn on **Hard delete** per sync if you want rows physically removed. This is irreversible and cannot be undone from Meridian.

Soft-deleted rows count toward MAR once, in the month the delete is applied.

### Writes are transactional per table

Meridian stages each table's changes and applies them in a single transaction. Readers see either the previous state or the new one, never a half-loaded table. On warehouses without multi-statement transactions on the write path, Meridian uses atomic swap instead, with the same guarantee.

A run that fails partway leaves already-committed tables at their new state and untouched tables at their previous state. The run is reported as `partial`.

## Snowflake

### Setup

```sql
-- warehouse
CREATE WAREHOUSE meridian_wh
  WITH WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

-- role, database, schema
CREATE ROLE meridian_role;
CREATE DATABASE IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS analytics.meridian_prod;

GRANT USAGE ON WAREHOUSE meridian_wh TO ROLE meridian_role;
GRANT USAGE ON DATABASE analytics TO ROLE meridian_role;
GRANT USAGE, CREATE TABLE, CREATE VIEW, CREATE STAGE, CREATE FILE FORMAT
  ON SCHEMA analytics.meridian_prod TO ROLE meridian_role;
GRANT ALL ON ALL TABLES IN SCHEMA analytics.meridian_prod TO ROLE meridian_role;
GRANT ALL ON FUTURE TABLES IN SCHEMA analytics.meridian_prod TO ROLE meridian_role;

-- user
CREATE USER meridian
  PASSWORD = 'use-a-long-random-password'
  DEFAULT_ROLE = meridian_role
  DEFAULT_WAREHOUSE = meridian_wh;
GRANT ROLE meridian_role TO USER meridian;
```

`AUTO_SUSPEND = 60` matters. Meridian's writes are bursty, and a warehouse that stays warm between syncs is the most common source of unexpected Snowflake cost.

An `XSMALL` warehouse handles most workloads. Move up only if load steps become your bottleneck — check run durations before resizing.

### Key-pair authentication

Snowflake is deprecating password authentication for service users. Use key-pair instead:

```sql
ALTER USER meridian SET RSA_PUBLIC_KEY = 'MIIBIjANBgkqh...';
```

Paste the matching private key into Meridian. Encrypted private keys are supported; supply the passphrase alongside.

### Network policies

If your Snowflake account has a network policy, add Meridian's egress IPs to it. A policy that blocks Meridian surfaces as `SYNC-201`, which looks like an authentication failure but is not.

## Google BigQuery

Create a service account and grant it, on the target dataset:

- `roles/bigquery.dataEditor` — create and modify tables
- `roles/bigquery.jobUser` — run load jobs, granted at project level

```bash
gcloud iam service-accounts create meridian-sync \
  --display-name="Meridian Sync"

gcloud projects add-iam-policy-binding my-project \
  --member="serviceAccount:meridian-sync@my-project.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

bq add-iam-policy-binding \
  --member="serviceAccount:meridian-sync@my-project.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor" \
  my-project:meridian_prod
```

Download the service account JSON key and paste its contents into Meridian.

Grant `dataEditor` on the **dataset**, not the project. Project-level grants give Meridian write access to every dataset you own, including ones your analysts maintain by hand.

Meridian sets table partitioning on `_meridian_synced_at` and clusters on the primary key by default. Override per table in sync settings. Partitioning is what keeps query cost down on large tables — leave it on unless you have a specific reason.

BigQuery load jobs are subject to a quota of 1,500 per table per day. Meridian batches to stay well under this, but a 5-minute schedule across many tables can approach it. If you hit `SYNC-204` with a quota message, lower the frequency or request a quota increase from Google.

## Amazon Redshift

```sql
CREATE USER meridian PASSWORD 'use-a-long-random-password';
CREATE SCHEMA meridian_prod AUTHORIZATION meridian;
GRANT ALL ON SCHEMA meridian_prod TO meridian;
```

Meridian loads through S3 using `COPY`, which is dramatically faster than row-by-row inserts. You must supply a staging bucket:

- An S3 bucket in the **same region** as the Redshift cluster. Cross-region staging works but is slow and incurs transfer cost.
- An IAM role attached to the cluster with `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, and `s3:ListBucket` on that bucket.
- The role ARN pasted into Meridian.

Meridian deletes staging files after a successful load. Set a lifecycle rule on the bucket to expire objects after 7 days so failed runs cannot leave debris behind indefinitely.

Redshift Serverless works the same way; supply the workgroup endpoint instead of a cluster endpoint.

Run `VACUUM` and `ANALYZE` on a schedule you control. Meridian does not run maintenance on your cluster.

## Databricks

Unity Catalog is required. Legacy Hive metastore is not supported.

1. Create a SQL warehouse, or use an existing one. Serverless is recommended.
2. Create a service principal and generate a personal access token for it.
3. Grant on the target catalog and schema:

   ```sql
   GRANT USE CATALOG ON CATALOG main TO `meridian-sp`;
   GRANT USE SCHEMA, CREATE TABLE, MODIFY, SELECT
     ON SCHEMA main.meridian_prod TO `meridian-sp`;
   ```

4. In Meridian, supply the workspace URL, the SQL warehouse HTTP path, the token, and the catalog and schema names.

Meridian writes Delta tables. It does not run `OPTIMIZE` or `VACUUM`; schedule those yourself, since many small writes from frequent syncs will otherwise accumulate small files and slow queries down.

## PostgreSQL

Suitable for smaller workloads — under roughly 50 million rows per table. Beyond that, use a real warehouse; Postgres will work but analytical queries get slow.

```sql
CREATE USER meridian WITH PASSWORD 'use-a-long-random-password';
CREATE SCHEMA meridian_prod AUTHORIZATION meridian;
GRANT CONNECT ON DATABASE analytics TO meridian;
GRANT ALL ON SCHEMA meridian_prod TO meridian;
```

Meridian needs `CREATE TABLE` in its schema — a `SELECT`-only grant is the number one cause of `SYNC-202` on this destination.

## Amazon S3

An S3 destination writes files rather than tables, for a data lake or an archive.

Configure the bucket, a prefix, a format (Parquet or JSONL), compression (`none`, `gzip`, or `snappy` for Parquet), and a partitioning scheme.

Files land at:

```
s3://your-bucket/prefix/{table}/{yyyy}/{mm}/{dd}/{batch_id}.parquet
```

S3 destinations are append-only. Updates and deletes are written as new records with `_meridian_deleted` and `_meridian_synced_at` set; you resolve the latest state at read time. Query with Athena, Spark, or DuckDB.

## Schema changes

Meridian propagates source schema changes automatically:

| Source change | What Meridian does |
| --- | --- |
| New column added | Adds the column to the destination, backfilled `NULL` for existing rows |
| Column dropped | Keeps the column, stops writing to it, leaves existing values |
| Column type widened (`int` → `bigint`) | Alters the destination column |
| Column type narrowed or changed incompatibly (`int` → `varchar`) | Fails with `SYNC-303`, needs manual resolution |
| New table added to source | Ignored unless **Auto-add new tables** is on for the sync |
| Table dropped at source | Table retained in the destination, sync continues, warning raised |
| Primary key changed | Fails with `SYNC-301`, needs a full resync |

Subscribe to the `schema.changed` and `schema.change_blocked` webhooks to catch these before your dashboards do. See [Webhooks](/docs/webhooks).

## Changing destinations

You cannot repoint an existing sync at a different destination. Create a new sync with the new destination, run a full historical backfill, verify the data, then delete the old sync.

The backfill counts fully toward MAR. If it is large, contact support@meridiandata.com **before** running it — migration credits are routinely granted in advance and never retroactively.
