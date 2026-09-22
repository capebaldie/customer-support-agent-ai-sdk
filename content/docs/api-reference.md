---
title: REST API Reference
slug: api-reference
category: developer
url: /docs/api-reference
updated: 2026-09-01
audience: developer
---

# REST API Reference

The Meridian API lets you manage connections, syncs, and usage programmatically. Everything you can do in the app you can do through the API, except billing changes and SSO configuration.

**Base URL:** `https://api.meridiandata.com/v1`

All requests must use HTTPS. Plain HTTP requests are rejected, not redirected.

## Authentication

Authenticate with a bearer token in the `Authorization` header:

```bash
curl https://api.meridiandata.com/v1/syncs \
  -H "Authorization: Bearer mk_live_8f2c9a1e4b6d7f30a5c8e2b19d4f6a70"
```

Create keys at **Settings → API keys**. Key prefixes tell you what you are holding:

| Prefix | Environment | Behavior |
| --- | --- | --- |
| `mk_live_` | Production | Operates on real connections and syncs |
| `mk_test_` | Test | Operates on sandbox resources only; never moves customer data |

The secret is displayed once, at creation. Meridian stores only a SHA-256 hash and cannot recover it for you.

Never put a live key in client-side code, a mobile app, or a public repository. Meridian scans public GitHub for leaked keys and automatically revokes any it finds, then emails the workspace Admins.

### Key scopes

Each key carries an explicit scope list. Requests outside scope return `403 insufficient_permissions`.

| Scope | Grants |
| --- | --- |
| `syncs:read` | List and read syncs and their run history |
| `syncs:write` | Create, edit, pause, and delete syncs |
| `syncs:trigger` | Start a sync run |
| `connections:read` | List and read connections (never credentials) |
| `connections:write` | Create, edit, and delete connections |
| `usage:read` | Read MAR and usage data |
| `webhooks:write` | Manage webhook endpoints |
| `audit:read` | Read the audit log |

## Versioning

The API is versioned two ways, and both matter:

- **The URL path** (`/v1`) pins the major version. Breaking changes get a new path. Meridian supports a major version for at least 24 months after its successor ships, with 12 months' written notice before shutdown.
- **The `Meridian-Version` header** pins the date-based minor version:

```
Meridian-Version: 2026-04-01
```

Omit the header and your workspace's default version is used — the version current when the workspace was created. Pin it explicitly in production so a new default cannot change behavior underneath you.

Current version: `2026-04-01`. Every response echoes the version applied in the `Meridian-Version` response header.

## Requests and responses

All request and response bodies are JSON. Send `Content-Type: application/json` on `POST`, `PATCH`, and `PUT`.

Timestamps are ISO 8601 in UTC: `2026-09-01T14:32:05Z`.

Identifiers are prefixed strings, not integers: `sync_9f2b1c`, `conn_4a7e8d`, `run_2c9f14`. Do not parse them; treat them as opaque.

Every response includes a request ID:

```
Meridian-Request-Id: req_7d3f9a2b8c1e
```

Include this ID when you contact support. It lets Meridian find the exact request in its logs in seconds instead of minutes.

## Pagination

List endpoints are cursor-paginated.

| Parameter | Default | Max | Meaning |
| --- | --- | --- | --- |
| `limit` | 25 | 100 | Objects per page |
| `starting_after` | — | — | An object ID; returns the page after it |
| `ending_before` | — | — | An object ID; returns the page before it |

```json
{
  "object": "list",
  "data": [ { "id": "sync_9f2b1c", "...": "..." } ],
  "has_more": true,
  "next_cursor": "sync_9f2b1c"
}
```

Loop while `has_more` is true, passing the previous `next_cursor` as `starting_after`. Do not compute offsets — the API has no offset parameter, deliberately, because offsets skip and duplicate records when the underlying list changes mid-pagination.

## Rate limits

Limits are per workspace, not per key, and are enforced with a sliding window.

| Plan | Requests per minute | Burst |
| --- | --- | --- |
| Starter | 60 | 100 |
| Growth | 300 | 500 |
| Scale | 1,000 | 1,500 |
| Enterprise | Custom | Custom |

Every response carries the current state:

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 287
X-RateLimit-Reset: 1757340000
```

Exceeding the limit returns `429 rate_limit_exceeded` with a `Retry-After` header in seconds. **Respect `Retry-After`.** Retrying faster does not get you served sooner and repeated violations trigger a temporary 15-minute block.

Recommended client behavior: exponential backoff starting at 1 second, capped at 60 seconds, with jitter, and a maximum of 5 attempts.

Two endpoints have their own tighter limits regardless of plan:

- `POST /v1/syncs/{id}/trigger` — 10 requests per minute per sync.
- `POST /v1/connections/{id}/test` — 20 requests per minute per workspace.

## Idempotency

`POST` requests accept an `Idempotency-Key` header containing any unique string, typically a UUID:

```bash
curl -X POST https://api.meridiandata.com/v1/syncs \
  -H "Authorization: Bearer mk_live_..." \
  -H "Idempotency-Key: 8f14e45f-ea0d-4b1c-9b3a-2c7d5e6f1a09" \
  -H "Content-Type: application/json" \
  -d '{"source_id":"conn_4a7e8d","destination_id":"conn_1b9c2f","name":"prod-orders"}'
```

Meridian stores the result for **24 hours**. Replaying the same key returns the original response without creating a second resource. Reusing a key with a *different* body returns `409 resource_conflict`.

Use idempotency keys for anything that runs in a retry loop or a job queue.

## Core endpoints

### Connections

| Method | Path | Scope |
| --- | --- | --- |
| `GET` | `/v1/connections` | `connections:read` |
| `GET` | `/v1/connections/{id}` | `connections:read` |
| `POST` | `/v1/connections` | `connections:write` |
| `PATCH` | `/v1/connections/{id}` | `connections:write` |
| `DELETE` | `/v1/connections/{id}` | `connections:write` |
| `POST` | `/v1/connections/{id}/test` | `connections:read` |

Credentials are write-only. A `GET` returns configuration and status but every secret field reads back as `"***"`.

Deleting a connection that a sync depends on returns `409 resource_conflict`. Delete the sync first.

### Syncs

| Method | Path | Scope |
| --- | --- | --- |
| `GET` | `/v1/syncs` | `syncs:read` |
| `GET` | `/v1/syncs/{id}` | `syncs:read` |
| `POST` | `/v1/syncs` | `syncs:write` |
| `PATCH` | `/v1/syncs/{id}` | `syncs:write` |
| `DELETE` | `/v1/syncs/{id}` | `syncs:write` |
| `POST` | `/v1/syncs/{id}/trigger` | `syncs:trigger` |
| `POST` | `/v1/syncs/{id}/pause` | `syncs:write` |
| `POST` | `/v1/syncs/{id}/resume` | `syncs:write` |

Triggering a sync that is already running returns `409 sync_already_running`. Triggering when you are at your plan's concurrency limit returns `429 concurrent_sync_limit` — the run is **not** queued, so retry after the current run finishes.

### Runs

| Method | Path | Scope |
| --- | --- | --- |
| `GET` | `/v1/syncs/{id}/runs` | `syncs:read` |
| `GET` | `/v1/runs/{id}` | `syncs:read` |
| `GET` | `/v1/runs/{id}/logs` | `syncs:read` |
| `POST` | `/v1/runs/{id}/cancel` | `syncs:write` |

A run object looks like this:

```json
{
  "id": "run_2c9f14",
  "sync_id": "sync_9f2b1c",
  "status": "completed",
  "started_at": "2026-09-01T14:00:00Z",
  "completed_at": "2026-09-01T14:07:22Z",
  "rows_synced": 48213,
  "mar_consumed": 48213,
  "tables": [
    { "name": "public.orders", "status": "completed", "rows": 48000 },
    { "name": "public.customers", "status": "completed", "rows": 213 }
  ],
  "error": null
}
```

`status` is one of `queued`, `running`, `completed`, `failed`, `cancelled`, or `partial`. A `partial` run wrote some tables and failed others; the per-table `status` tells you which.

Cancelling a run stops it at the next safe checkpoint. Rows already written stay written and count toward MAR.

### Usage

```bash
curl "https://api.meridiandata.com/v1/usage?start=2026-08-01&end=2026-08-31&group_by=sync" \
  -H "Authorization: Bearer mk_live_..."
```

| Parameter | Values |
| --- | --- |
| `start`, `end` | ISO dates. Maximum 12-month range. |
| `group_by` | `sync`, `table`, `destination`, or `day` |

Usage figures for the current month are updated every 15 minutes and are provisional until the period closes.

## Webhooks

Webhook endpoints are managed through `/v1/webhooks` and documented separately in [Webhooks](/docs/webhooks).

## Errors

Every error returns a JSON body with a stable machine-readable `code`. The full list is in [API Error Codes](/docs/api-error-codes). Branch on `code`, never on the human-readable `message`, which may be reworded at any time.

## Client libraries

Official, semver-versioned, and generated from the same OpenAPI spec:

- Python — `pip install meridian-sdk`
- TypeScript / Node — `npm install @meridiandata/sdk`
- Go — `go get github.com/meridiandata/meridian-go`

The OpenAPI 3.1 specification is published at `https://api.meridiandata.com/v1/openapi.json` and is the authoritative source for request and response shapes.
