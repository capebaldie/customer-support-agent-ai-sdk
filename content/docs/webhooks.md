---
title: Webhooks
slug: webhooks
category: developer
url: /docs/webhooks
updated: 2026-08-22
audience: developer
---

# Webhooks

Webhooks push events from Meridian to an HTTPS endpoint you control, so you can react to sync failures, usage thresholds, and schema changes without polling the API.

## Creating an endpoint

Go to **Settings → Webhooks → Add endpoint**, or `POST /v1/webhooks`.

You provide:

- **URL** — must be `https://`. Plain HTTP is rejected. The host must resolve publicly; Meridian does not deliver to private ranges such as `10.0.0.0/8`, `192.168.0.0/16`, or `localhost`.
- **Events** — the subset you want. Subscribing to everything and filtering on your side works but wastes deliveries against your endpoint.
- **Description** — free text, for your own bookkeeping.

Meridian sends a `webhook.test` event immediately on creation. If it does not return a 2xx within 10 seconds, the endpoint is created but flagged **Unverified** in the UI.

You can create up to 10 endpoints per workspace.

## Event types

| Event | Fires when |
| --- | --- |
| `sync.started` | A run begins |
| `sync.completed` | A run finishes with every table successful |
| `sync.partial` | A run finishes with some tables successful and some failed |
| `sync.failed` | A run fails entirely |
| `sync.cancelled` | A run is cancelled by a user or the API |
| `connection.broken` | Meridian cannot authenticate or reach a connection |
| `connection.restored` | A previously broken connection works again |
| `schema.changed` | Meridian detects a column or table change at the source |
| `schema.change_blocked` | A schema change could not be applied automatically |
| `usage.threshold_reached` | MAR crosses 50%, 80%, 90%, or 100% of your allowance |
| `usage.hard_cap_reached` | Syncs paused because a hard usage cap was hit |
| `invoice.payment_failed` | A charge failed |
| `invoice.paid` | An invoice was settled |
| `api_key.expiring` | An API key expires within 14 days |
| `webhook.test` | Manual test, or automatically at endpoint creation |

## Payload format

Every payload has the same envelope:

```json
{
  "id": "evt_9c2f1a8b3d",
  "type": "sync.failed",
  "created_at": "2026-09-01T14:07:22Z",
  "workspace_id": "ws_3f8a2c",
  "api_version": "2026-04-01",
  "data": {
    "sync_id": "sync_9f2b1c",
    "sync_name": "prod-orders",
    "run_id": "run_2c9f14",
    "started_at": "2026-09-01T14:00:00Z",
    "failed_at": "2026-09-01T14:07:22Z",
    "error_code": "SYNC-202",
    "error_message": "Destination role lacks CREATE TABLE on schema meridian_prod.",
    "rows_synced": 0,
    "tables": [
      { "name": "public.orders", "status": "failed", "error_code": "SYNC-202" }
    ]
  }
}
```

The `data` object's shape depends on `type`. The envelope fields never change within an API version.

`api_version` reflects the version pinned on the endpoint at creation. Change it at **Settings → Webhooks → [endpoint] → API version**; existing undelivered events keep the version they were created with.

## Verifying signatures

**Always verify signatures.** Your endpoint is a publicly reachable URL and anyone who finds it can post anything to it.

Every delivery carries:

```
Meridian-Signature: t=1757340442,v1=5257a869e7bcfd3c1a7b09a6d3f1e4c8b2a09f7d6e5c4b3a2f1e0d9c8b7a6f5e
```

The signed payload is the timestamp, a literal `.`, and the raw request body. Compute HMAC-SHA256 over that string using your endpoint's signing secret, then compare in constant time.

The signing secret is shown once when the endpoint is created and starts with `whsec_`. Rotate it at **Settings → Webhooks → [endpoint] → Rotate secret**; the old secret stays valid for 24 hours so you can deploy without dropping deliveries. During rotation Meridian sends two `v1` signatures in the header, one per secret — accept the delivery if either matches.

### Node.js

```js
import crypto from "node:crypto";

export function verifyMeridianSignature(rawBody, header, secret, toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > toleranceSec) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parts.t}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1 ?? "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

### Python

```python
import hashlib, hmac, time

def verify_meridian_signature(raw_body: bytes, header: str, secret: str, tolerance: int = 300) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    timestamp = int(parts["t"])
    if abs(time.time() - timestamp) > tolerance:
        return False
    expected = hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, parts.get("v1", ""))
```

Two mistakes account for nearly every "signature does not match" report:

1. **Verifying against a parsed and re-serialized body.** You must hash the raw bytes exactly as received. In Express, `express.json()` discards them — use `express.raw({ type: "application/json" })` on the webhook route, or capture the raw body with the `verify` option.
2. **Skipping the timestamp check.** Without it, a captured payload can be replayed forever. Meridian's tolerance is **5 minutes**; reject anything older.

## Delivery, retries, and ordering

Meridian expects a `2xx` response within **10 seconds**. Anything else — a `4xx`, a `5xx`, a timeout, a TLS error — counts as a failure.

Failed deliveries retry **8 times over roughly 24 hours** with exponential backoff:

| Attempt | Delay after previous |
| --- | --- |
| 1 | immediate |
| 2 | 10 seconds |
| 3 | 1 minute |
| 4 | 5 minutes |
| 5 | 30 minutes |
| 6 | 2 hours |
| 7 | 6 hours |
| 8 | 12 hours |

After the eighth failure the event is marked permanently failed. If an endpoint fails **every** delivery for 72 consecutive hours, Meridian disables it and emails the workspace Admins. Re-enable it at **Settings → Webhooks** after fixing the problem.

Two properties to design around:

- **Delivery is at-least-once.** Retries and network partitions mean you will occasionally see the same event twice. Deduplicate on the event `id`, which is stable across retries.
- **Order is not guaranteed.** A retried `sync.started` can land after the `sync.completed` that follows it. Use `created_at` to order events, and never assume the sequence you receive matches the sequence that happened.

### Respond first, work later

Acknowledge with a `2xx` immediately and do your real work asynchronously. If your handler runs a 30-second job inline, Meridian times out at 10 seconds, retries, and your job runs again — the classic cause of duplicated downstream work.

```js
app.post("/webhooks/meridian", express.raw({ type: "application/json" }), (req, res) => {
  if (!verifyMeridianSignature(req.body, req.get("Meridian-Signature"), process.env.MERIDIAN_WEBHOOK_SECRET)) {
    return res.status(400).send("invalid signature");
  }
  res.status(200).send("ok");          // acknowledge first
  queue.enqueue(JSON.parse(req.body)); // then process
});
```

## Inspecting and replaying deliveries

**Settings → Webhooks → [endpoint] → Deliveries** shows every attempt with its request body, response status, response body, and duration.

Retention matches your plan's log retention: 7 days on Starter, 30 on Growth, 90 on Scale, 365 on Enterprise.

Click **Replay** on any delivery to send it again immediately. Replays carry a fresh signature and timestamp so they pass verification, but keep the original event `id` — which is exactly why deduplicating on `id` matters.

Bulk replay every failed delivery in a time range with **Replay failed**. Useful after your endpoint was down for a deploy.

## Static egress IPs

Webhook deliveries originate from the same static IPs listed in [Getting Started](/docs/getting-started), so you can allowlist them at your edge. Signature verification is still required — IP allowlisting is defense in depth, not authentication.

## Alternatives to webhooks

If you only need humans notified, skip webhooks. **Settings → Notifications** sends sync failure and usage alerts to email addresses, a Slack channel via the Slack app, or a Microsoft Teams channel via an incoming webhook URL. No code to write or endpoint to run.
