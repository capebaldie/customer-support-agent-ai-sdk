// Per-caller request counter for the API routes.
//
// The chat route is the one that matters. Gemini's free tier allows 5 requests a minute and 20 a
// day across every caller at once, so one client in a loop takes the whole day's quota and every
// other user gets the over-limit message from route.ts's onError. That message handles someone
// else's rate limit hitting us; this is the one that stops us earning it.
//
// ponytail: module-scope Map — each serverless instance counts on its own, so the real ceiling is
// (instances × limit), and a cold start forgets everything. Enough to stop one client draining the
// quota, useless against a distributed caller. Reach for Vercel's limiter or Upstash that day.

const hits = new Map<string, { count: number; resetAt: number }>();

// `NextRequest.ip` was removed in Next 15 — the host supplies the address now, and this app is not
// tied to Vercel's `ipAddress()`. A proxy appends the peer it saw to the end of x-forwarded-for, so
// the last entry is the only one a caller cannot forge by sending the header itself. Taking the
// first would hand out a fresh bucket per made-up value. No header at all means no proxy in front:
// local dev, where one shared bucket is the honest answer.
function peer(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "local";
}

/**
 * A 429 to return as-is, or null to carry on. `scope` separates the counters: without it two
 * routes share one bucket and the chatty one starves the expensive one — which is exactly what
 * happened the first time this was wired up, with 30 feedback writes locking the chat route out.
 */
export function rateLimit(req: Request, scope: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${scope}:${peer(req)}`;
  const entry = hits.get(key);

  if (!entry || now >= entry.resetAt) {
    // a caller rotating x-forwarded-for would grow this map until the instance died. Sweeping on
    // insert costs nothing until it is actually large, and needs no timer to hold the process open.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
    }
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (++entry.count > limit) {
    // useChat throws with the response body as error.message, which app/page.tsx renders verbatim
    return new Response("Too many requests. Please wait a moment and try again.", {
      status: 429,
      headers: { "retry-after": String(Math.ceil((entry.resetAt - now) / 1000)) },
    });
  }
  return null;
}
