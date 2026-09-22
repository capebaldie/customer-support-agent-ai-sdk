---
title: Getting Started with Meridian Sync
slug: getting-started
category: onboarding
url: /docs/getting-started
updated: 2026-08-14
audience: all
---

# Getting Started with Meridian Sync

Meridian Sync is a managed data pipeline service. You connect a **source** (a database or SaaS application), connect a **destination** (a data warehouse), and Meridian keeps the destination up to date on a schedule you choose. There is no infrastructure to run and no pipeline code to write.

This guide takes you from a new account to a working sync in about 15 minutes.

## Before you begin

You will need:

- A Meridian account. Sign up free at [app.meridiandata.com/signup](https://app.meridiandata.com/signup). No credit card is required for the Starter plan.
- Credentials for at least one source. For a database source this means a host, port, database name, and a user with read access. For a SaaS source it usually means an OAuth login.
- A destination warehouse you can write to, such as Snowflake, BigQuery, Redshift, Databricks, or PostgreSQL.

If you do not have a warehouse yet, start with the built-in **Meridian Sandbox** destination. It is a hosted PostgreSQL database that holds up to 1 million rows for 14 days, and it exists so you can test a pipeline without provisioning anything.

## Step 1: Create your workspace

A **workspace** is the top-level container for everything you build: connections, syncs, members, and billing. Most companies run a single production workspace, and larger teams add separate workspaces for staging or for individual business units.

When you sign up you are prompted to name your first workspace. Pick something that matches how you will bill, because **usage and invoices are tracked per workspace, not per account**. You can rename a workspace at any time from **Settings → General**.

Your account is automatically assigned the **Owner** role in the workspace you create. See [Account and Workspace Management](/docs/account-and-workspace) for the full role list.

## Step 2: Connect a source

1. In the left sidebar, click **Connections → New connection → Source**.
2. Pick your source type from the catalog. Meridian supports PostgreSQL, MySQL, MongoDB, Stripe, Salesforce, Shopify, HubSpot, Google Ads, Zendesk, Intercom, Amazon S3, and NetSuite. See [Sources and Connectors](/docs/connectors-sources) for setup notes on each.
3. Enter credentials. Database sources ask for host, port, database, username, and password. SaaS sources open an OAuth window instead.
4. Click **Test connection**. Meridian opens a connection, lists the tables or objects it can see, and reports back. This usually takes under 10 seconds.
5. Click **Save**.

If the test fails, the error banner names a `SYNC-1xx` code. The two most common are `SYNC-101` (bad credentials) and `SYNC-102` (Meridian cannot reach the host, almost always a firewall). [Troubleshooting Sync Failures](/docs/troubleshooting-sync-failures) lists every code and its fix.

### Allowlisting Meridian's IP addresses

If your database sits behind a firewall, allow inbound connections from Meridian's static egress IPs for your region:

| Region | Egress IP addresses |
| --- | --- |
| `us-east` | `52.14.108.22`, `52.14.108.23`, `52.14.108.24` |
| `eu-west` | `18.203.44.10`, `18.203.44.11`, `18.203.44.12` |
| `ap-southeast` | `13.55.201.88`, `13.55.201.89`, `13.55.201.90` |

These addresses are stable and Meridian gives 30 days' notice by email before changing them. If you cannot open a firewall, use an SSH tunnel or a reverse tunnel instead — both are described in [Sources and Connectors](/docs/connectors-sources).

## Step 3: Connect a destination

Click **Connections → New connection → Destination** and pick your warehouse.

Every destination needs a schema or dataset that Meridian owns and a role with permission to create and modify tables inside it. Do not point Meridian at a schema your analysts also write to by hand — Meridian will alter tables to match the source schema, and hand-made changes to those tables will be overwritten.

The exact grants for each warehouse are listed in [Destinations](/docs/destinations). The most common first-sync failure is `SYNC-202`, a destination role that can read but cannot create tables.

## Step 4: Create a sync

A **sync** is a pairing of one source and one destination, plus the set of tables you want moved and the schedule to move them on.

1. Click **Syncs → New sync**.
2. Choose your source connection and your destination connection.
3. Select tables. Meridian shows every table it can read, with an estimated row count next to each. **Select only what you need** — every synced row counts toward your Monthly Active Rows, and unused tables are the single most common cause of a surprise bill.
4. Choose a sync mode per table. Meridian preselects the best available mode: log-based CDC where the source supports it, incremental where a usable cursor column exists, and full refresh otherwise. See [Sync Modes and Scheduling](/docs/sync-scheduling-and-modes).
5. Choose a schedule. The minimum interval depends on your plan: 24 hours on Starter, 1 hour on Growth, 15 minutes on Scale, and 5 minutes on Enterprise.
6. Click **Create sync**.

## Step 5: Run your first sync

New syncs do not start automatically. Click **Sync now** to trigger the first run.

The first run is a **historical backfill**: Meridian reads every existing row in the tables you selected and writes them to the destination. Backfills are usually the largest run a sync will ever do, and for a large source they can take hours. Subsequent runs only move what changed.

Watch progress on the sync detail page. Each table moves through `queued → extracting → loading → complete`. You can leave the page; the run continues on Meridian's infrastructure.

### Understanding your first bill

The backfill counts toward Monthly Active Rows in the month it runs. A 4 million row backfill on the Growth plan consumes 4 million of your 5 million included MAR immediately. This is expected, and it is why the second month's bill is usually much lower than the first. See [Plans and Pricing](/docs/plans-and-pricing) for how MAR is counted.

## Step 6: Verify the data

Query your destination:

```sql
select count(*) from meridian_prod.customers;
```

Meridian adds four metadata columns to every table it creates:

| Column | Type | Meaning |
| --- | --- | --- |
| `_meridian_synced_at` | `timestamp` | When this row was last written by Meridian |
| `_meridian_deleted` | `boolean` | `true` if the row was deleted at the source (soft deletes only) |
| `_meridian_row_hash` | `varchar` | Content hash Meridian uses to skip unchanged rows |
| `_meridian_batch_id` | `varchar` | The sync run that last touched this row |

Filter out `_meridian_deleted = true` in your queries unless you specifically want deleted history.

## What to do next

- Set up alerting so you hear about failures before your analysts do. Go to **Settings → Notifications** and add an email address or Slack channel for `sync.failed` and `connection.broken`. Programmatic alerting is covered in [Webhooks](/docs/webhooks).
- Invite your team from **Settings → Members**. Grant the narrowest role that works; `Analyst` is enough for someone who only reads sync status.
- Set a usage alert at **Settings → Billing → Usage alerts** so you are emailed at 80% of your included MAR.

## Getting help

Email support@meridiandata.com or use in-app chat if your plan includes it. Response times by plan are listed in [Support and SLA](/docs/support-and-sla). Live incidents are posted at [status.meridiandata.com](https://status.meridiandata.com).
