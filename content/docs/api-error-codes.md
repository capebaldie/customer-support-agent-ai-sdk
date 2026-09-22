---
title: API Error Codes
slug: api-error-codes
category: developer
url: /docs/api-error-codes
updated: 2026-09-01
audience: developer
---

# API Error Codes

Every Meridian API error returns the same JSON envelope:

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Too many requests. Retry after 34 seconds.",
    "type": "rate_limit_error",
    "param": null,
    "request_id": "req_7d3f9a2b8c1e",
    "doc_url": "/docs/api-error-codes#rate_limit_exceeded"
  }
}
```

**Branch on `code`.** It is stable and will not change within a major API version. The `message` field is written for humans and gets reworded without notice.

`param` names the offending field when the error is about a specific input, so you can attribute a validation failure without parsing prose.

For sync run failures — as opposed to API request failures — see [Troubleshooting Sync Failures](/docs/troubleshooting-sync-failures), which covers the `SYNC-xxx` codes.

## Error types

The `type` field groups codes so you can write one handler per class:

| Type | Meaning | Retry? |
| --- | --- | --- |
| `invalid_request_error` | Your request is malformed | No — fix the request |
| `authentication_error` | Credentials are missing, wrong, or expired | No — fix credentials |
| `permission_error` | Valid credentials, insufficient rights | No |
| `not_found_error` | The resource does not exist | No |
| `conflict_error` | The request conflicts with current state | Sometimes, after state changes |
| `validation_error` | Semantically invalid input | No |
| `rate_limit_error` | Too many requests | Yes, after `Retry-After` |
| `api_error` | Something went wrong on Meridian's side | Yes, with backoff |

The rule of thumb: retry `429` and `5xx`, never retry `4xx` other than `429`.

## 400 — Bad request

### `invalid_request`

The request body is not valid JSON, or a field has the wrong type.

```json
{ "error": { "code": "invalid_request", "message": "Expected 'schedule_minutes' to be an integer, received string.", "param": "schedule_minutes" } }
```

Check `param`. The usual causes are a number sent as a string, a trailing comma, or a `Content-Type` that is not `application/json`.

### `missing_parameter`

A required field is absent. `param` names it.

Creating a sync requires `source_id`, `destination_id`, and `name`. Creating a connection requires `type` and a `config` object whose shape depends on `type`.

### `invalid_parameter_value`

The field is present and correctly typed but the value is not allowed — an unknown enum member, a negative number where positive is required, or a schedule shorter than your plan permits.

Requesting a 5-minute schedule on the Growth plan returns this code with `param: "schedule_minutes"`, because Growth's minimum is 60.

## 401 — Authentication

### `invalid_api_key`

The key does not exist, was revoked, or is malformed. Also returned when you send a `mk_test_` key to an endpoint operating on live resources.

Check for the classics: a truncated copy-paste, a trailing newline from `$(cat keyfile)`, the literal string `Bearer` included twice, or the word `Bearer` missing entirely.

### `expired_api_key`

The key passed its configured expiry date. Create a new key at **Settings → API keys**. Meridian emails Admins 14 days before expiry — check whether those emails are being filtered.

### `missing_authorization_header`

No `Authorization` header at all. Note that some HTTP clients strip this header when following a redirect across hosts.

## 403 — Permission

### `insufficient_permissions`

The key is valid but lacks the scope for this endpoint. The message names the required scope.

```json
{ "error": { "code": "insufficient_permissions", "message": "This endpoint requires the 'syncs:write' scope." } }
```

Scopes cannot be added to an existing key. Create a new key with the right scopes and retire the old one.

### `plan_limit_exceeded`

The operation is allowed for your role but not on your plan. Examples: creating a fourth connection on Starter, a fourth destination on Growth, or enabling CDC on Starter.

The message names the limit and the plan that lifts it. See [Limits and Quotas](/docs/limits-and-quotas).

### `workspace_suspended`

The workspace is suspended for non-payment. All write endpoints return this; read endpoints keep working. Settle the outstanding invoice — see [Billing, Invoices, and Payments](/docs/billing-and-invoices).

## 404 — Not found

### `resource_not_found`

No object with that ID exists **in this workspace**. A key is scoped to one workspace, so an ID from another workspace returns 404 rather than 403 — Meridian does not confirm the existence of resources you cannot see.

If the ID looks right, verify the key belongs to the workspace you think it does with `GET /v1/workspace`.

### `endpoint_not_found`

The path does not exist. Nearly always a missing `/v1` prefix or a typo. Note the API has no trailing slashes: `/v1/syncs/` returns this error, `/v1/syncs` works.

## 409 — Conflict

### `resource_conflict`

The request conflicts with current state. Common cases:

- Deleting a connection that a sync still references. Delete the sync first.
- Creating a connection with a name already in use in the workspace.
- Reusing an `Idempotency-Key` with a different request body.

### `sync_already_running`

You triggered a sync that has an active run. Meridian never runs two runs of the same sync concurrently, because that would produce interleaved writes to the same destination tables.

Poll `GET /v1/syncs/{id}` until `current_run` is null, or subscribe to the `sync.completed` webhook instead of polling.

### `schema_locked`

A schema change is in progress on this sync. These are brief. Retry after 30 seconds.

## 422 — Validation

### `schema_validation_failed`

The configuration is structurally valid but cannot work against the actual source or destination. Examples: a selected table does not exist at the source, a cursor column named for incremental sync is not present, or a chosen primary key is not unique.

The `details` array lists every problem found, not just the first:

```json
{
  "error": {
    "code": "schema_validation_failed",
    "message": "2 tables failed validation.",
    "details": [
      { "table": "public.orders", "issue": "cursor_column_not_found", "column": "updated_at" },
      { "table": "public.events", "issue": "no_primary_key" }
    ]
  }
}
```

### `incompatible_sync_mode`

The requested sync mode is not supported for that source and table combination — for example log-based CDC against a source with no change log, or incremental against a table with no monotonically increasing column. See [Sync Modes and Scheduling](/docs/sync-scheduling-and-modes).

### `connection_unreachable`

Meridian could not reach the source or destination while validating. This is a connectivity problem, not a configuration one — check firewall rules and the egress IP allowlist in [Getting Started](/docs/getting-started).

## 429 — Rate limiting

### `rate_limit_exceeded`

You exceeded your plan's requests-per-minute limit. The `Retry-After` header gives the seconds to wait.

Back off exponentially with jitter. Do not retry in a tight loop — sustained violations trigger a 15-minute block on the workspace.

### `concurrent_sync_limit`

You are at your plan's concurrent run limit: 1 on Starter, 5 on Growth, 20 on Scale.

**Runs are not queued.** The trigger is rejected outright. Wait for a run to finish, or stagger your schedules so peaks do not collide.

### `endpoint_rate_limit_exceeded`

You hit a per-endpoint limit that is tighter than the workspace limit — 10/minute for `POST /v1/syncs/{id}/trigger`, 20/minute for `POST /v1/connections/{id}/test`. These apply on every plan.

## 5xx — Server errors

### `internal_error` (500)

Something failed inside Meridian. The request may or may not have taken effect, so retry with an `Idempotency-Key` to avoid creating a duplicate.

Retry with exponential backoff. If it persists past three attempts, send the `request_id` to support@meridiandata.com.

### `service_unavailable` (503)

Meridian is degraded or in maintenance. Check [status.meridiandata.com](https://status.meridiandata.com) and honor `Retry-After`.

### `gateway_timeout` (504)

The request exceeded Meridian's 30-second gateway timeout. This usually means a connection test against a slow or unreachable host. The underlying operation may still complete — poll rather than blindly retrying.

## Reference table

| HTTP | Code | Type | Retry |
| --- | --- | --- | --- |
| 400 | `invalid_request` | `invalid_request_error` | No |
| 400 | `missing_parameter` | `invalid_request_error` | No |
| 400 | `invalid_parameter_value` | `invalid_request_error` | No |
| 401 | `invalid_api_key` | `authentication_error` | No |
| 401 | `expired_api_key` | `authentication_error` | No |
| 401 | `missing_authorization_header` | `authentication_error` | No |
| 403 | `insufficient_permissions` | `permission_error` | No |
| 403 | `plan_limit_exceeded` | `permission_error` | No |
| 403 | `workspace_suspended` | `permission_error` | No |
| 404 | `resource_not_found` | `not_found_error` | No |
| 404 | `endpoint_not_found` | `not_found_error` | No |
| 409 | `resource_conflict` | `conflict_error` | After state change |
| 409 | `sync_already_running` | `conflict_error` | After run completes |
| 409 | `schema_locked` | `conflict_error` | After 30s |
| 422 | `schema_validation_failed` | `validation_error` | No |
| 422 | `incompatible_sync_mode` | `validation_error` | No |
| 422 | `connection_unreachable` | `validation_error` | After fixing network |
| 429 | `rate_limit_exceeded` | `rate_limit_error` | After `Retry-After` |
| 429 | `concurrent_sync_limit` | `rate_limit_error` | After run completes |
| 429 | `endpoint_rate_limit_exceeded` | `rate_limit_error` | After `Retry-After` |
| 500 | `internal_error` | `api_error` | Yes, with backoff |
| 503 | `service_unavailable` | `api_error` | Yes, with backoff |
| 504 | `gateway_timeout` | `api_error` | Poll, do not blind retry |
