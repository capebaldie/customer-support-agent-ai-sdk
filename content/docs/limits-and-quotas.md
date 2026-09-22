---
title: Limits and Quotas
slug: limits-and-quotas
category: reference
url: /docs/limits-and-quotas
updated: 2026-08-29
audience: all
---

# Limits and Quotas

Every limit Meridian enforces, in one place. Limits marked **soft** can be raised by contacting support; **hard** limits are architectural and cannot.

## Plan limits

| Limit | Starter | Growth | Scale | Enterprise | Type |
| --- | --- | --- | --- | --- | --- |
| Included MAR per month | 100,000 | 5,000,000 | 25,000,000 | Negotiated | Hard on Starter |
| Overage allowed | No | Yes | Yes | Yes | Hard |
| Seats | 2 | 10 | 25 | Unlimited | Soft (add-on) |
| Source connections | 3 | Unlimited | Unlimited | Unlimited | Hard on Starter |
| Destinations | 1 | 3 | 10 | Unlimited | Soft (add-on) |
| Syncs | 5 | 100 | 500 | Unlimited | Soft |
| Tables per sync | 50 | 500 | 2,000 | 5,000 | Soft |
| Minimum sync interval | 24 hours | 1 hour | 15 minutes | 5 minutes | Hard |
| Concurrent sync runs | 1 | 5 | 20 | Custom | Hard |
| Maximum run duration | 2 hours | 12 hours | 24 hours | 24 hours | Hard |
| Log-based CDC | No | Yes | Yes | Yes | Hard |
| Sync log retention | 7 days | 30 days | 90 days | 365 days | Soft (add-on) |
| Audit log retention | None | 30 days | 90 days | 365 days | Soft |
| Webhook endpoints | 10 | 10 | 10 | 50 | Soft |
| API keys | 5 | 25 | 100 | Unlimited | Soft |
| Notification recipients | 3 | 10 | 25 | Unlimited | Soft |

## Data shape limits

| Limit | Starter | Growth | Scale | Enterprise |
| --- | --- | --- | --- | --- |
| Columns per table | 500 | 1,000 | 2,000 | 2,000 |
| Maximum row size | 8 MB | 16 MB | 32 MB | 32 MB |
| Maximum single column value | 4 MB | 8 MB | 16 MB | 16 MB |
| Table name length | 255 characters | 255 | 255 | 255 |
| Column name length | 128 characters | 128 | 128 | 128 |
| Composite primary key columns | 8 | 8 | 8 | 8 |

Exceeding row size fails the row with `SYNC-305`. Exceeding column count fails the table with `SYNC-301`.

These are Meridian limits. Your destination has its own — BigQuery caps at 10,000 columns per table, Redshift at 1,600 — and the lower of the two applies.

## API rate limits

Per workspace, sliding window.

| Plan | Requests / minute | Burst |
| --- | --- | --- |
| Starter | 60 | 100 |
| Growth | 300 | 500 |
| Scale | 1,000 | 1,500 |
| Enterprise | Custom | Custom |

Per-endpoint limits apply on every plan, on top of the workspace limit:

| Endpoint | Limit |
| --- | --- |
| `POST /v1/syncs/{id}/trigger` | 10 / minute per sync |
| `POST /v1/connections/{id}/test` | 20 / minute per workspace |
| `GET /v1/usage` | 60 / hour per workspace |
| `POST /v1/webhooks` | 10 / hour per workspace |

Sustained violation after a `429` triggers a **15-minute block** on the workspace. Honor `Retry-After`.

## Webhook limits

| Limit | Value |
| --- | --- |
| Endpoints per workspace | 10 (50 on Enterprise) |
| Delivery timeout | 10 seconds |
| Retry attempts | 8 over ~24 hours |
| Auto-disable after | 72 hours of total failure |
| Maximum payload size | 1 MB |
| Signature tolerance window | 5 minutes |
| Replay window | Matches log retention |

Payloads exceeding 1 MB — a schema change event on a table with thousands of columns, for example — are truncated, with `"truncated": true` set in the envelope. Fetch the full object from the API when you see it.

## Source-specific limits

| Source | Limit |
| --- | --- |
| PostgreSQL | 1 replication slot per connection |
| MySQL | `binlog_format` must be `ROW` |
| MongoDB | Schema inferred from 1,000 sampled documents, configurable to 100,000 |
| Salesforce | Bound by your org's daily API allocation |
| Stripe | `events` object backfills 30 days maximum |
| Shopify | Bound by Shopify's leaky-bucket rate limit |
| Amazon S3 | 100,000 files per sync run |

## Retention

| Data | Retention |
| --- | --- |
| Sync run logs | 7 / 30 / 90 / 365 days by plan |
| Audit log | None / 30 / 90 / 365 days by plan |
| Webhook delivery history | Matches sync log retention |
| Usage data | 24 months, all plans |
| Invoices | 7 years, all plans |
| Deleted workspace | 30-day soft delete, then permanent |
| Transient sync data in Meridian's cache | Purged within 24 hours of a successful run |
| Failed-run payloads (for debugging) | 7 days |

## Regional availability

| Region | Code | Available on |
| --- | --- | --- |
| US East (Virginia) | `us-east` | All plans, default |
| EU West (Ireland) | `eu-west` | Scale, Enterprise |
| Asia Pacific (Sydney) | `ap-southeast` | Enterprise |

A workspace's region is chosen at creation and **cannot be changed afterward**. To move regions, create a new workspace in the target region and rebuild your syncs there. Plan this before you start, not after.

## What counts as a Monthly Active Row

Restated here because it is the limit that matters most. A MAR is one distinct primary key inserted, updated, or deleted in a destination during a calendar month.

- Updated 50 times in a month → **1 MAR**
- Read but unchanged → **0 MAR**
- Deleted → **1 MAR**
- Synced to two destinations → **2 MAR**
- Counter resets on the 1st at 00:00 UTC

Full detail and worked examples are in [Plans and Pricing](/docs/plans-and-pricing).

## Requesting a limit increase

Email support@meridiandata.com with:

1. Which limit you are hitting.
2. The value you need.
3. Why — what workload requires it.

Soft limits on Growth and above are usually raised within one business day. Hard limits require a plan change. Enterprise limits are set in your contract.
