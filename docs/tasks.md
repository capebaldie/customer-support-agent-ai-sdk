# Build tasks

Working checklist for the RAG pipeline. One task at a time, each independently verifiable.

> Kept in `docs/` at the repo root, **not** `content/docs/` — that folder is the knowledge base and the ingester globs it. A planning file in there would end up embedded and retrievable as if it were product documentation.

API signatures below were checked against the installed versions (`drizzle-orm@0.45.2`, `ai@7.0.85`, `@ai-sdk/google@4.0.58`), not from memory.

---

## Task 1 — Dependencies and env — DONE

- [x] `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit` (dev)
- [x] `esbuild: true` in `pnpm-workspace.yaml` (drizzle-kit fetches a platform binary in its postinstall)
- [x] `DATABASE_URL` + `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.example`
- [x] `lib/env.ts` — zod validation, throws on missing/malformed
- [x] `instrumentation.ts` — runs the check once before the server accepts requests
- [x] CI passes dummy env values so `next build` can evaluate `lib/env.ts`

No `tsx` (Node 24 strips types), no `dotenv` (`--env-file`), no `gray-matter` (frontmatter is ~8 lines for a format we control).

---

## Task 2 — Database schema — DONE

**Files:** `lib/db/schema.ts`, `lib/db/index.ts`, `drizzle.config.ts`

There are currently empty placeholders at `lib/schema.ts` and `lib/index.ts`. Delete them and use `lib/db/` — `lib/index.ts` as a database client will read as the barrel export for all of `lib/` to anyone who opens it later.

### Steps

- [x] Enable pgvector. `CREATE EXTENSION IF NOT EXISTS vector;` is hand-written at the top of
      migration `0000`, so `pnpm db:migrate` handles it and a fresh clone needs no Neon console step.
      It has to come first — the `vector` column type does not exist until it does.
- [x] `lib/db/schema.ts` — one `chunks` table:

  | Column | Type |
  | --- | --- |
  | `id` | `serial` primary key |
  | `docSlug` | `text` not null |
  | `docTitle` | `text` not null |
  | `url` | `text` not null |
  | `category` | `text` not null |
  | `headingPath` | `text` not null |
  | `content` | `text` not null |
  | `embedding` | `vector({ dimensions: 1536 })` not null |

- [x] HNSW index in `pgTable`'s third argument — the extras callback:

  ```ts
  index("chunks_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
  ```

- [x] `lib/db/index.ts` — Neon HTTP driver, importing `env` from `lib/env.ts` (not `process.env` directly, so the validation is what gates it):

  ```ts
  import { drizzle } from "drizzle-orm/neon-http";
  import { env } from "@/lib/env";
  import * as schema from "./schema";

  export const db = drizzle(env.DATABASE_URL, { schema });
  ```

- [x] `drizzle.config.ts` — dialect `postgresql`, schema path, `out: "./lib/db/migrations"`.
      Use `process.env.DATABASE_URL` here, not `@/lib/env` — drizzle-kit bundles the config
      with esbuild and does not resolve tsconfig `paths`.
- [x] `pnpm db:generate` then `pnpm db:migrate`. There is no `db:push` — see **Migrations** below.

### Done when

The `chunks` table shows all 8 columns in the Neon console's Tables view, and this in the SQL editor:

```sql
select indexname, indexdef from pg_indexes where tablename = 'chunks';
```

```
chunks_pkey           CREATE UNIQUE INDEX chunks_pkey ON public.chunks USING btree (id)
chunks_embedding_idx  CREATE INDEX chunks_embedding_idx ON public.chunks USING hnsw (embedding vector_cosine_ops)
```

`\d chunks` is a psql meta-command — it works from `psql "$DATABASE_URL"`, not in the web editor.
The console's Tables view lists columns but not indexes, which is why the index needs its own query.

### Gotchas

- **1536 dimensions, not 3072.** `gemini-embedding-001` returns 3072 by default and **pgvector's HNSW index caps at 2000** — store 3072 and you silently get no index, turning every query into a sequential scan. Decide this before embedding anything; changing it later means re-embedding the whole corpus.
- `vector()` accepts both `vector({ dimensions: 1536 })` and `vector("embedding", { dimensions: 1536 })`. Either is fine; the first takes the column name from the object key.
- `drizzle-kit` will not generate `CREATE EXTENSION` for you, and does not track extensions in `meta/` snapshots, so it will never re-emit it. It is hand-added to migration `0000` and must survive any future squash.
- Use the **pooled** Neon string (`-pooler` in the host). The direct one works in dev then exhausts connections under serverless load.
- The DB is in Singapore. Expect ~50–80ms per round trip from a local dev server; that is the network, not your query.


### Migrations

Schema changes are versioned SQL, generated then applied:

```bash
pnpm db:generate   # diff lib/db/schema.ts against meta/ snapshot -> new .sql
pnpm db:migrate    # apply anything not recorded in drizzle.__drizzle_migrations
```

`--name` is optional but worth passing (`pnpm db:generate --name=add_ident_and_hash`); without it
drizzle picks random words. `--custom` generates an empty file for hand-written SQL — backfills,
extensions, data fixes.

**The `db:*` scripts deliberately do not use `node --env-file=.env`.** drizzle-kit bundles `dotenv`
and loads `.env` from `process.cwd()` itself, so the flag was redundant — and worse, `--env-file`
is a hard error when the file is missing, which is exactly Task 9 (a Neon branch in CI, secrets as
real env vars, no `.env` on disk). Bare `drizzle-kit <cmd>` resolves through `node_modules/.bin`
and works in both places. Scripts we write ourselves still need the flag — they get no dotenv.

Migrations are append-only once committed: an unwanted column is removed by a **new** migration
that drops it, never by editing or deleting the one that added it. Editing an applied file does not
re-run it — `dialect.js` compares only the newest `created_at` against each journal `when`, so the
edit is silently skipped and the database drifts from git with no error.

`db:push` was removed. It leaves no reviewable file and no history to replay, and it resolves a
column rename as drop-then-add — which on this table would silently destroy 237 embeddings.
There is no reset script either — `DATABASE_URL` is a real database and a wipe command next to
`db:migrate` is a footgun. Starting over means dropping the `public` **and** `drizzle` schemas by
hand (the latter holds the migration history; dropping only `public` leaves `db:migrate`
believing everything is already applied), then re-running `pnpm db:migrate`.

---

## Task 3 — Chunker — DONE

**Files:** `lib/rag/chunk.ts`, `lib/rag/chunk.test.ts`

Pure function — no I/O, no network. That is what makes it testable, and it is the one piece here that earns a real test: every downstream task inherits its bugs silently.

### Steps

- [x] Parse frontmatter: split on `---`, then first colon per line. Values contain colons (`url: https://...`) so split on the **first** one only.
- [x] Split the body on `^##` / `^###` headings.
- [x] Drop bodyless headers (`## 400 — Bad request` has no prose of its own), pushing their titles into descendants' breadcrumbs.
- [x] Build `embeddingInput` as `` `${docTitle} > ${headingPath}\n\n${content}` ``.
- [x] Guards: never split inside a ``` fence or between a table and its header row.
- [x] Return `{ docSlug, docTitle, url, category, headingPath, content, embeddingInput }[]`.

### Done when

`node --test lib/rag/chunk.test.ts` passes. Five tests: corpus size, bodyless headers dropped but present in descendants' breadcrumbs, `schema_locked` carrying `409` in its `embeddingInput`, a table kept whole with its header row, and headings inside a fence ignored.

### Outcome

**237 chunks**, max 481 tokens, median 147.

The 195–215 estimate above was written before the chunker existed and is wrong; the other three measurements in it hold. The only model that produces a count in that range merges each `###` into its parent `##`, which yields a 1049-token maximum — contradicting both the measured 472 and this task's own rule against merging. Measurements outvote the estimate.

### Gotchas

- **Do not merge small chunks.** The corpus has many sections under 80 tokens, and the usual "merge anything small" advice is wrong here. They split into bodyless headers (drop them) and short complete answers like `### schema_locked` at 26 tokens (keep them — merging it into a neighbour blurs two precise answers into one fuzzy one). Small is not the same as incomplete.
- **No splitting is needed.** Measured max section is 472 tokens, median 128. Skip the recursive-splitter-with-overlap machinery entirely.
- The breadcrumb is the highest-value line in the file. `### schema_locked`'s body contains neither `schema_locked` nor `409` nor `Meridian` — without the prefix, someone typing the error they actually saw matches nothing.
- The chunker is markdown-specific by design. If docs ever move to a CMS, this file is what gets replaced — see **Deferred**.

---

## Task 4 — Ingestion as a diff — DONE

**Files:** `scripts/ingest.ts`, `lib/db/schema.ts` (addendum), `lib/db/index.ts` (fix)

Run with `node --env-file=.env scripts/ingest.ts`. Node's type stripping needs explicit extensions in relative imports (`./chunk.ts`) and does not resolve the `@/` alias, so use relative paths in scripts.

**A run is a diff, not a rebuild.** `delete from chunks` then insert-all is fine for one manual run, and wrong the moment CI runs it on every merge: it empties the index for the length of the embed run, and it pays to re-embed 237 chunks to fix one typo. Neither is acceptable on a pipeline that fires on every commit — which is Task 9.

### Prerequisite

- [x] `lib/db/index.ts` imports `@/lib/env`, which no script can resolve — `ERR_MODULE_NOT_FOUND: Cannot find package '@/lib'`. Change it to `"../env.ts"`. `allowImportingTsExtensions` is already on, so this typechecks; confirm with one `pnpm build` that Next still resolves it. Fixing it here also unblocks Task 8, which reaches the same import through `lib/rag/search.ts`.

### Schema addendum

One `pnpm db:generate` + `pnpm db:migrate` cycle adds (this becomes migration `0001`):

- [x] `contentHash` — `text().notNull()`, a hash of `embeddingInput`. Hash the embedding input, not `content`: a heading rename changes the breadcrumb, which changes the vector, and hashing only the body would miss it.
- [x] `updated` — `date()`, from frontmatter. Task 7 shows it in citations; a correct-but-outdated answer is the most expensive failure this agent can produce.
- [x] `unique("chunks_ident").on(table.docSlug, table.headingPath)` — the stable identity of a chunk and the conflict target for the upsert.

### Steps

- [x] Read `content/docs/*.md` in sorted order, chunk each. Deterministic order keeps reruns comparable.
- [x] One query for the existing `{ docSlug, headingPath, contentHash }` set.
- [x] Diff into three lists:
  - hash unchanged → **skip**, no embedding call, no write
  - hash changed or identity absent → **embed**
  - identity in the database but not in the corpus → **delete**
- [x] Embed only the changed set, in one call:

  ```ts
  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    values: changed.map((c) => c.embeddingInput),
    maxParallelCalls: 2,
    providerOptions: {
      google: { outputDimensionality: 1536, taskType: "RETRIEVAL_DOCUMENT" },
    },
  });
  ```

- [x] `assert.equal(embeddings[0].length, 1536)` before any write.
- [x] Upsert in batches of ~50 with `onConflictDoUpdate` on `chunks_ident`, then delete the removed identities.
- [x] Log added / changed / deleted / skipped, plus an estimated token count and cost.
- [x] `--force` re-embeds the whole corpus, for the day the model or the dimension count changes.

### Done when

All four verified:

- First run: `237 chunks · 237 to embed · ~36,243 tokens` → 237 rows, 15 docs, 237 distinct hashes, stored `vector_dims` 1536.
- Rerun with no edits: `0 to embed · 237 unchanged · nothing to do`.
- One row's hash invalidated: `1 to embed · 236 unchanged`.
- `count(*) where embedding is null` = 0.

### Gotchas

- **Do not hand-batch the embed calls.** `embedMany` already splits `values` by the model's `maxEmbeddingsPerCall` (100 for Google, confirmed in `node_modules/@ai-sdk/google`) and by `maxInputBytesPerCall`. Pass the whole array and bound concurrency with `maxParallelCalls` instead. `maxRetries` defaults to 2 with backoff, so 429s are already handled.
- **`db.transaction()` throws on this driver** — `No transactions support in neon-http driver`. `db.batch([...])` does run as a single transaction and is the way to make the swap atomic, if the payload fits; 237 rows × 1536 floats is roughly 4–5 MB serialized, so batch the inserts either way.
- **`taskType` matters and is easy to miss.** Gemini embeddings are trained asymmetrically: `RETRIEVAL_DOCUMENT` here, `RETRIEVAL_QUERY` in Task 5. Getting these backwards, or omitting them, measurably degrades retrieval for no visible reason.
- `outputDimensionality: 1536` must match the schema exactly or the insert fails.
- **The free tier allows 100 `embed_content` requests per minute and counts each value, not each HTTP call.** Sending 237 values in 3 calls still exceeds it — the first run died on a 429 after `embedMany` exhausted its retries, because its backoff is shorter than the quota window. The script embeds in slices of 100 a minute apart, so a full ingest takes ~2 minutes. Task 8's eval runs ~30 queries and stays under the limit; Task 9 running both in one job may not.
- **Write each slice as it completes.** With a rate limit in play a run can die partway, and the diff makes that safe: finished slices are stored, and the next run's hash comparison resumes exactly where it stopped. This is why the upsert is inside the slice loop rather than after all embedding finishes.
- `chunk.ts` had to start carrying `updated` through, and `lib/db/index.ts` needed `./schema.ts` with the extension — Node's type stripping resolves neither bare relative paths nor the `@/` alias.
- Once CI runs this (Task 9), wrap the run in a `pg_advisory_lock` so two triggers cannot interleave. That is the whole concurrency story.

---

## Task 5 — Retrieval function — DONE

**File:** `lib/rag/search.ts`

Plain function `search(query: string, k = 5)` — no tool wrapper, no request context. The route (Task 6), the eval script (Task 8), and CI (Task 9) all call it.

### Steps

- [x] `embed` the query with `taskType: "RETRIEVAL_QUERY"` and `outputDimensionality: 1536`
- [x] Order by cosine distance ascending, limit `k`:

  ```ts
  import { cosineDistance, sql } from "drizzle-orm";

  const distance = cosineDistance(chunks.embedding, queryEmbedding);

  await db
    .select({
      content: chunks.content,
      headingPath: chunks.headingPath,
      url: chunks.url,
      docTitle: chunks.docTitle,
      updated: chunks.updated,
      similarity: sql<number>`1 - (${distance})`,
    })
    .from(chunks)
    .orderBy(distance)   // ascending distance — uses the HNSW index
    .limit(k);
  ```

- [x] Return the similarity scores. Task 6 gates on the top one and Task 7 displays them; a function that returns only text cannot support either.

### Done when

A scratch call for *"why did my sync fail with 401"* returns `SYNC-101` in the top 3.

### Outcome

*"why did my sync fail with 401"* → `SYNC-101` at rank 3 (0.745). Rank 1 is `SYNC-401 — MAR limit reached` (0.794): the embedding matched the literal `401`. That is the exact-token weakness Task 11 targets — add this question to the Task 8 eval set.

### Gotchas

- **Order by ascending distance, not descending similarity.** `orderBy(desc(sql`1 - ${distance}`))` returns identical results but the planner will not use the HNSW index for it — you get a sequential scan that looks fine at 237 rows and falls over at 200,000. Select the similarity for display; sort by the distance.
- **Parenthesise the distance.** `1 - ${distance}` renders as `1 - a <=> b`, and `-` binds tighter than `<=>`, so Postgres fails with `operator does not exist: integer - vector`.
- `cosineDistance` is exported from `drizzle-orm` root, not from `drizzle-orm/pg-core`.

---

## Task 6 — Wire the tool into the agent — DONE

**File:** `app/api/chat/route.ts`

### Steps

- [x] Add a `searchKnowledgeBase` tool wrapping Task 5, `inputSchema: z.object({ query: z.string() })`
- [x] System prompt: answer only from retrieved content, cite the `url`
- [x] **Escalation gate.** When the top similarity falls below a threshold, decline and hand off to support@meridiandata.com instead of generating. A confidently wrong answer about billing is worse than "let me get someone." Provisional `MIN_SIMILARITY = 0.6` from a 7-query probe (in-scope ≥0.68, off-topic ~0.50, uncovered 0.56); replace from Task 8. Task 8 found no clean value (in-scope low 0.63, out-of-scope high 0.659) — see its Outcome.
- [x] Fix `timeout: 10000` → `{ firstChunkMs: 30_000 }` (free-tier Gemini is slow to start)
- [ ] Raise `maxOutputTokens` 512 → 2000 — kept at 512 for now; raise if answers truncate

### Done when

*"what counts as a monthly active row?"* streams a cited answer; *"what's the capital of France?"* declines instead of answering; a plausible-but-uncovered question escalates rather than improvising.

### Gotchas

- **`timeout: 10000` is a total budget, not a first-chunk one.** A bare number maps to `totalMs` in `TimeoutConfiguration`. Ten seconds total will kill a multi-step RAG loop that has to embed, query Singapore, and then generate.
- Let the model call the tool; do not pre-fetch and stuff results into the system prompt. Query rewriting and routing come free from the tool loop that `stopWhen: isStepCount(5)` already sets up.
- **Retrieved text is data, not instruction.** It reaches the model as a tool result and stays there. It is trusted today only because the corpus is in git behind PR review — the moment content comes from anywhere with more editors, that assumption is gone and this is the boundary that holds.
- 512 output tokens truncates a cited answer mid-sentence.

---

## Task 7 — Citations in the UI — DONE

**File:** `app/page.tsx`

### Steps

- [x] Render the `tool-searchKnowledgeBase` part — query, retrieved heading paths, similarity scores
- [x] Show source links under the answer, each with its `updated` date
- [x] Disable the form while `status !== "ready"`

### Done when

You can see what was retrieved for every answer, and how stale it is.

Not polish — this is the debugger for Task 8 and for anything after it. When an answer is wrong you need to distinguish *retrieval returned the wrong chunks* from *retrieval was right and the model ignored it*. Those have different fixes and the answer text alone cannot tell them apart.

---

## Task 8 — Eval harness — DONE

**Files:** `eval/questions.ts`, `scripts/eval.ts`, `eval/baseline.json`

The task that turns everything after it from guesswork into engineering.

### Steps

- [x] ~30 hand-written `{ question, expectedSlug }` pairs
- [x] Include the near-miss pairs the corpus was built with: `SYNC-101` vs `SYNC-201` (both "authentication failed", opposite sides), `rate_limit_exceeded` vs `SYNC-103` (both rate limits, API vs source)
- [x] Phrase questions the way a user would — *"meridian 409 schema locked"*, not *"what is the schema_locked error"*
- [x] Print recall@1, recall@5, and MRR
- [x] Write the scores to `eval/baseline.json` and commit it. Task 9 diffs against this file, so it has to be machine-readable, not just printed.
- [x] Record the score distribution too — the escalation threshold in Task 6 comes from where correct and incorrect retrievals separate.

### Done when

One command prints a baseline and updates a committed file.

### Outcome

`pnpm eval` — 34 answerable + 5 out-of-scope questions. recall@1 0.912, recall@5 1.0, MRR 0.946.

Misses at rank 1: the `401` → `SYNC-401` exact-token confusion (rank 3), "duplicate rows" → *Rows appear then disappear* (rank 3), overage pricing → MAR definition (rank 2).

**Similarity alone cannot separate in-scope from uncovered.** Lowest correct top-1 is 0.63 (*card declined*); out-of-scope tops reach 0.659 (*who is the CEO*), 0.633 (*mobile app*), 0.615 (*google sheets*). `MIN_SIMILARITY = 0.6` lets three of five through to the model, and no value between 0.63 and 0.66 fixes that without escalating real billing questions. Left at 0.6: the prompt's "sections do not actually answer the question" rule is the real gate for these. Revisit after Task 11.

- **Questions can name a section, not just a doc.** A hit is a matching `docSlug` plus, when `expectedHeading` is set, a `headingPath` containing it. `SYNC-101` and `SYNC-201` live in the same doc, so slug-only matching would count either as correct for both.
- **`expectedSlug: null`** marks an uncovered question. It stays out of recall and MRR and only feeds `topSimilarity.outOfScope`.
- **The eval only embeds.** It never calls `TEXT_MODEL`, so it still runs when the chat model's daily quota is exhausted.

### Gotchas

- Write the questions before tuning anything, or you will unconsciously write questions your current setup already passes.
- 30 is enough to see a real regression. 300 is a research project.
- After launch the eval set should grow from production traffic, not imagination. Every thumbs-down in Task 10 is a candidate pair.

---

## Task 9 — CI: ingest on merge, eval on every PR

**File:** `.github/workflows/ci.yml`

Retrieval fails **silently**. It does not throw — it returns plausible, wrong chunks. Someone reorganizes a doc's headings, recall drops, and the only symptom is a slow rise in support tickets. This job is the only thing that notices.

### Steps

- [ ] **On a PR touching `content/docs/**`:** create a Neon branch, run `db:migrate` and `ingest` against it, run the eval, post recall@1 / recall@5 / MRR as a PR comment with the delta against `eval/baseline.json`, delete the branch.
- [ ] **On merge to main:** run `ingest` against production, re-run the eval, fail the job if recall@5 drops more than a set margin below the baseline.
- [ ] Keep the existing `lint` + `build` job as-is; docs jobs are separate and only run on the paths that matter.
- [ ] Add `node --test lib/rag/*.test.ts` to the always-run job. The chunker test costs nothing and guards every task downstream.

### Done when

A PR that renames a heading in `content/docs/` gets a comment with its retrieval scores before anyone merges it.

### Gotchas

- **Secrets are manual here.** This project uses Neon standalone, not the Vercel integration, so `NEON_API_KEY`, `NEON_PROJECT_ID`, and `GOOGLE_GENERATIVE_AI_API_KEY` go into repository secrets by hand. There is no `neon env pull` shortcut.
- **A Neon branch copies the parent's data**, so the preview branch arrives with 237 chunks already embedded and the ingest on it is a diff like any other. This is the reason Task 4 had to land first: a full rebuild per PR would embed the whole corpus every time.
- Delete the branch on PR close, not only on merge. Abandoned branches accumulate.
- The eval spends ~30 embedding calls per run. Trivial in cost, but it is a real API call — it needs the key, and it will fail on a fork PR that has no access to secrets.

---

## Task 10 — Retrieval logging — DONE

**Files:** `lib/db/schema.ts`, `app/api/chat/route.ts`

The only debugging surface this system has, and the pipeline that grows the eval set.

### Steps

- [x] One `retrievals` table: query, retrieved chunk ids, scores, `k`, latency, model, token counts, timestamp
- [x] Write a row from the route after each tool call. Do not block the stream on it.
- [x] A nullable `feedback` column, written by a thumbs up/down in the UI
- [x] One query that lists thumbs-down rows with what was retrieved

### Done when

For any answer a user complains about, you can see the exact chunks and scores that produced it.

### Outcome

`retrievals` — one row per `searchKnowledgeBase` call, written from `after()` once the response has
finished streaming. Verified against the live database: a 👎 in the UI sets `feedback` on every row
of that answer, and the README query lists it with the sections it retrieved.

- **Token counts are per answer, not per search.** The SDK aggregates usage over the whole tool
  loop, so an answer with two searches repeats the same totals on both rows.
- **A declined question logs nothing.** The model refuses off-topic questions without calling the
  tool, so there is no search to record. Questions that are searched and escalate are logged
  normally, with their low scores. Catching wrong refusals needs per-turn logging, which is a
  different table and a different purpose.
- **Retention is 30 days for unrated rows**, rated ones kept. `pg_cron` schedule in the README,
  deliberately not in a migration: jobs live in the database, and every Neon branch off production
  would otherwise inherit a job deleting rows on a copy nobody reads.
- **Sampling was considered and rejected** (log a fraction, or buffer in Redis and persist only on
  👎). Feedback is rare, so a feedback-only table keeps a few percent of the evidence and loses the
  denominator every rate question needs; a TTL races the user who rates an answer an hour later. At
  ~400 bytes a row the current volume is not worth a second store. If it ever is, sample at write
  time — keep every low-scoring or escalated row plus a recorded fraction of the rest.

### Gotchas

- Log the scores, not just the ids. "Retrieved the right chunk at rank 4 with 0.61 similarity" and "retrieved nothing above 0.3" are different problems.
- This table grows without bound. A retention window is a one-line cron, and cheaper to add now than to backfill a decision about later.

---

## Task 11 — Hybrid search

**File:** `lib/rag/search.ts`

Only now, with a baseline to measure against.

### Steps

- [ ] A generated `tsvector` column over `embeddingInput`, plus a GIN index
- [ ] Run both legs, fuse with reciprocal rank fusion, rerank the union to `k`
- [ ] Re-run the eval. **Keep it only if the number moves.** Targets from Task 8's baseline: *"why did my sync fail with 401"* (`SYNC-101` at rank 3 behind `SYNC-401`), and whether better ranking opens a gap between in-scope and out-of-scope top similarity for `MIN_SIMILARITY`.

### Done when

`eval/baseline.json` improves, or this task is reverted and the reason recorded.

### Gotchas

- Embeddings are weak on exact tokens — `SYNC-101`, `mk_test_`, `429`, plan names — which is exactly what support users paste. This is the most likely single-largest recall win available, and it costs one index.
- Fuse by rank, not by raw score. Cosine similarity and `ts_rank` are not on the same scale and averaging them is meaningless.

---

## Deferred

Each of these waits for the eval number to justify it, or for a real user to ask:

- **Reranking** — `rerank` is already exported from `ai@7`. Try it after hybrid search, and only if Task 11's numbers say recall is fine but precision at 1 is not.
- **Conversation persistence.**
- **Better Auth + account-lookup tools.** When built: the user id comes from the **server session**, never as a tool parameter — a model-supplied `userId` is an attacker-influenced input and turns into a data-exfiltration path.
- **Rate limiting.**
- **An ops dashboard at `/admin`** — ingestion run history, reindex buttons, the thumbs-down queue, eval scores over time. Build it when someone who cannot run `pnpm` needs to operate this. Until then Task 10's query and a terminal do the same job. It is an ops surface, never a content editor.
- **Moving docs out of git.** The trigger is not technical: it is the first time someone who does not use git says "that doc is wrong, can you fix it." Docs going stale is the real failure mode of a support agent, and no amount of retrieval quality compensates for it. When that day comes, put the corpus in an existing CMS or help center rather than building one, and keep the change contained to a `fetchDocuments() => Document[]` boundary in front of Task 4 — one implementation reading the filesystem today, another reading an API later. Task 3 gets replaced along with it: a CMS stores a rich-text tree, not markdown with `##` headings.
