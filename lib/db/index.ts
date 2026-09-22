import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "../env.ts";
import * as schema from "./schema.ts";

// Node's Happy Eyeballs gives each resolved address 250ms to finish a TCP handshake before
// abandoning it and trying the next. This database is in ap-southeast-1 and a GitHub runner is not,
// so a round trip is roughly that 250ms and the handshake lands on the limit: every address gets
// abandoned in turn and the driver reports `AggregateError [ETIMEDOUT]` listing all of them. That
// reads exactly like the database being down, which is what sent three CI ingests chasing Neon.
//
// It was up the whole time. The same endpoint completes TLS in ~100ms from a network nearer to
// Singapore, which is why local runs passed while CI failed. Being borderline is also why it was
// intermittent: one run lost its first query, another got several through before one tipped over.
//
// 5s is far above any real handshake and well inside the job's own timeout, so a genuinely
// unreachable database still fails, just not in under a second with a misleading error.
setDefaultAutoSelectFamilyAttemptTimeout(5_000);

export const db = drizzle(env.DATABASE_URL, { schema });
