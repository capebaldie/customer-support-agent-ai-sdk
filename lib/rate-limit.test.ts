import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { test } from "node:test";
import { rateLimit } from "./rate-limit.ts";

const from = (xff: string) =>
  new Request("http://test/api/chat", { headers: { "x-forwarded-for": xff } });

test("allows up to the limit, blocks past it, recovers when the window rolls over", async () => {
  const limit = 3;
  const windowMs = 60;

  for (let i = 0; i < limit; i++) {
    assert.equal(rateLimit(from("1.1.1.1"), "a", limit, windowMs), null, `request ${i + 1}`);
  }

  const blocked = rateLimit(from("1.1.1.1"), "a", limit, windowMs);
  assert.equal(blocked?.status, 429);
  assert.ok(Number(blocked?.headers.get("retry-after")) >= 0);

  // a different caller keeps its own count
  assert.equal(rateLimit(from("2.2.2.2"), "a", limit, windowMs), null);

  await sleep(windowMs + 20);
  assert.equal(rateLimit(from("1.1.1.1"), "a", limit, windowMs), null);
});

test("keys on the last x-forwarded-for entry, which a caller cannot forge", () => {
  const windowMs = 60_000;
  assert.equal(rateLimit(from("5.5.5.5"), "b", 1, windowMs), null);
  // same peer, attacker-supplied prefix: must not hand out a fresh bucket
  assert.equal(rateLimit(from("9.9.9.9, 5.5.5.5"), "b", 1, windowMs)?.status, 429);
});

test("one caller's scopes do not share a counter", () => {
  const req = () => from("7.7.7.7");
  assert.equal(rateLimit(req(), "chat", 1, 60_000), null);
  assert.equal(rateLimit(req(), "chat", 1, 60_000)?.status, 429);
  // the chat bucket is spent; a chatty second route must not have spent it, and must not be
  // locked out by it. Same window on purpose — this is the collision the scope key exists for.
  assert.equal(rateLimit(req(), "feedback", 1, 60_000), null);
});
