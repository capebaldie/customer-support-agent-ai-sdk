# Support Agent

A production-grade, RAG-based customer support agent built with the [Vercel AI SDK](https://ai-sdk.dev) and Next.js.

It answers questions about a fictional product — **Meridian Sync**, a managed data-pipeline SaaS — from a knowledge base of support docs in [`content/docs/`](content/docs/). The docs are invented, but they are written like real ones: consistent plan limits, a full error-code reference, and deliberately similar topics that retrieval has to tell apart.

### Highlights

- **Interactive in-app citations**: Answers cite exact sections, linking directly to rendered docs at `/docs/[slug]`.
- **Proactive follow-up suggestions**: Contextually suggests the next 2–3 questions a user might ask based on cited documentation.
- **Diagnostic feedback capture**: Thumbs-down dialog records feedback comments to distinguish retrieval misses from prompt/reasoning failures.
- **Measured retrieval**: Evaluated against a 39-question golden test set tracking `recall@1`, `recall@5`, and `MRR`.
- **Quota & cost guards**: Built-in per-caller rate-limiting and hash-based incremental diff re-indexing.

## Stack

|            |                                           |
| ---------- | ----------------------------------------- |
| Framework  | Next.js 16 (App Router)                   |
| AI         | Vercel AI SDK v7                          |
| Chat model | `gemini-3.5-flash-lite`                   |
| Embeddings | `gemini-embedding-001` at 1536 dimensions |
| Database   | Neon Postgres + pgvector                  |
| ORM        | Drizzle                                   |
| Styling    | Tailwind CSS v4                           |

## Setup

**Prerequisites:** Node.js 24+ and pnpm 11+.

**1. Install dependencies**

```bash
pnpm install
```

**2. Configure environment**

```bash
cp .env.example .env
```

Fill in both variables:

| Variable                       | Where to get it                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey)                                                               |
| `DATABASE_URL`                 | [Neon console](https://console.neon.tech) — use the **pooled** connection string, the one with `-pooler` in the host |

Both are required. The server validates them at startup and refuses to boot with a message naming what is missing, so you will not spend time debugging a symptom that is really a config problem.

**3. Set up the database**

```bash
pnpm db:migrate
```

This applies [`lib/db/migrations/`](lib/db/migrations/) to your Neon database: it enables the `vector` extension, creates the `chunks` table, and builds the HNSW index. No manual SQL in the Neon console is needed.

**4. Ingest the knowledge base**

```bash
pnpm db:ingest
```

Chunks every doc in [`content/docs/`](content/docs/), embeds it, and writes it to the `chunks` table — 237 chunks, about two minutes on a free Gemini key. Without this the schema exists but there is nothing to retrieve.

**5. Run**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  api/
    chat/route.ts        chat endpoint — streaming, agentic tool loop
    feedback/route.ts    feedback endpoint — thumbs up/down and diagnostic comments
    followups/route.ts   suggests follow-up questions from cited sections
  _components/chat/      chat UI components (thread, composer, suggestions, feedback dialog)
  docs/                  in-app doc browser (/docs and /docs/[slug])
  page.tsx               chat page
content/docs/            the knowledge base: 15 markdown docs
eval/
  baseline.json          recall@1, recall@5, and MRR baseline scores
  questions.ts           39 representative questions with expected targets
lib/
  db/
    schema.ts            drizzle schema — chunks & retrievals tables, pgvector HNSW index
    migrations/          generated SQL, applied in order by `pnpm db:migrate`
  rag/
    chunk.ts             splits docs into heading sections with breadcrumbs
    chunk.test.ts        node --test lib/rag/chunk.test.ts
    embedding.ts         model constants and embedding dimensions
    prompt.ts            system prompt and search tool definition
    search.ts            vector cosine similarity search
  env.ts                 env var validation (zod)
  rate-limit.ts          per-caller IP rate limiting on API routes
scripts/
  ingest.ts              chunk + embed + upsert, run by `pnpm db:ingest`
  eval.ts                evaluates retrieval against eval/questions.ts
  rephrase.ts            captures model search queries for eval
instrumentation.ts       runs the env check once, before the server serves
```

## Database migrations

Schema changes are versioned as SQL files, not pushed straight at the database:

```bash
# 1. edit lib/db/schema.ts, then:
pnpm db:generate --name=what_changed   # write a new .sql file (--name optional)
# 2. read the generated SQL, commit it, then:
pnpm db:migrate                        # apply anything not yet applied
```

Everything under `lib/db/migrations/` is committed — the `.sql` files, the `meta/` snapshots that
the next diff is computed against, and `_journal.json`. They are how a clone, a CI branch, or a
rebuilt database gets its schema, so they are never deleted after being applied. Once committed
they are append-only: drop an unwanted column with a new migration, never by editing an old one.

`pnpm db:studio` opens a browser UI over the data.

There is deliberately no reset script. `DATABASE_URL` points at a real database, and a destructive command sitting one tab-completion away from `db:migrate` is not worth the convenience. To start over, drop the `public` and `drizzle` schemas from the Neon console and re-run `pnpm db:migrate`.

There is deliberately no `db:push`. Push diffs the schema against the live database and applies the change immediately, leaving no file to review and no history to replay, and it resolves a column rename as drop-then-add, which loses the data in it.

## Ingesting the knowledge base

```bash
pnpm db:ingest            # only what changed
pnpm db:ingest --force    # re-embed everything
```

A run is a diff, not a rebuild. Every chunk is identified by `(docSlug, headingPath)` and hashed
over the exact text that gets embedded, so the script compares the corpus on disk against the rows
in the database and touches only the difference:

| Change                 | Result                                                                         |
| ---------------------- | ------------------------------------------------------------------------------ |
| Edit a section's prose | that one chunk is re-embedded and updated in place                             |
| Add or remove a doc    | its chunks are inserted or deleted                                             |
| Rename a heading       | the chunks beneath it get new identities — old rows deleted, new ones inserted |
| No change              | `nothing to do`, and no embedding calls                                        |

Re-running after a typo fix therefore costs one API call rather than 237, and the index is never
emptied mid-run. Each batch is written as it completes, so an interrupted run resumes where it
stopped rather than starting over.

The hash covers the heading breadcrumb as well as the body, because the breadcrumb is embedded with
it. Renaming a heading changes the vector even when the prose beneath is untouched.

Embedding happens in slices of 100 a minute apart: Gemini's free tier allows 100 `embed_content`
requests per minute and counts each value, not each HTTP call, so a single batched request for 237
chunks is rejected. `RATE_LIMIT` at the top of [`scripts/ingest.ts`](scripts/ingest.ts) is the only
thing to raise on a paid key.

Use `--force` when the embedding model or `outputDimensionality` changes — the stored vectors are
then stale in a way no hash can detect, since the input text never moved.

## Retrieval log

Every `searchKnowledgeBase` call writes a row to `retrievals`: the query, the chunk ids and scores it
returned, `k`, latency, model, and the answer's token counts. The row is written with Next's
`after()`, once the response has finished streaming, so logging never slows or breaks an answer.
The 👍/👎 under an answer sets `feedback` on every search row of that message; down-votes open
a dialog capturing an optional diagnostic `comment` (distinguishing retrieval misses from ignored context).

Thumbs-down answers with what they retrieved, newest first (Neon SQL editor or `psql`):

```sql
select r."createdAt", r.query, r.comment, r.scores,
       array_agg(coalesce(c."docSlug" || ' > ' || c."headingPath", '(chunk ' || ids.id || ' since deleted)')
                 order by ids.ord) as retrieved
from retrievals r
cross join lateral unnest(r."chunkIds") with ordinality as ids(id, ord)
left join chunks c on c.id = ids.id
where r.feedback = 'down'
group by r.id
order by r."createdAt" desc;
```

Each of these is a candidate question for `eval/questions.ts`.

## Retrieval evaluation

Retrieval quality is measured against 39 curated support questions in [`eval/questions.ts`](eval/questions.ts), tracking `recall@1`, `recall@5`, and `MRR` (Mean Reciprocal Rank):

```bash
pnpm eval              # scores retrieval against the golden set
pnpm eval:rephrase     # captures the chat model's rephrased search queries
```

Scores are written to [`eval/baseline.json`](eval/baseline.json) across two columns:
- `raw`: embeds the user question verbatim as typed.
- `rephrased`: embeds the query the model generated for `searchKnowledgeBase` (captured via `pnpm eval:rephrase`), matching production behavior.

### Retention

Rows are user text and grow without bound, so unrated rows are dropped after 30 days. Rows with
feedback are kept: they are the eval set's source of new questions, and there are few of them.
Complaints arrive within days of an answer, so a longer window would store rows nobody opens.

```sql
delete from retrievals where "createdAt" < now() - interval '30 days' and feedback is null;
```

Schedule it once per deployment, in the Neon SQL editor:

```sql
create extension if not exists pg_cron;
select cron.schedule('retrievals-retention', '17 3 * * *',
  $$delete from retrievals where "createdAt" < now() - interval '30 days' and feedback is null$$);
```

`select * from cron.job;` lists it, `select cron.unschedule('retrievals-retention');` removes it.
Not in a migration: `pg_cron` jobs live in the database, not the schema, and every branch created
from production would otherwise inherit a job deleting rows on a copy nobody reads.

## Environment validation

[`lib/env.ts`](lib/env.ts) parses `process.env` with a zod schema and throws if anything is missing or malformed. [`instrumentation.ts`](instrumentation.ts) imports it from Next's `register` hook, which runs once per server instance and must complete before the server accepts requests.

The effect is that a bad config fails the boot instead of surfacing later as a confusing 500. To add a new required variable, add it to the schema in `lib/env.ts` and to `.env.example`.

## The knowledge base

15 docs, ~2,800 lines, in [`content/docs/`](content/docs/) — onboarding, pricing, billing, account management, auth and SSO, the REST API, error codes, webhooks, connectors, destinations, sync modes, troubleshooting, limits, security, and support.

The documentation is also served directly by the app at [`/docs`](http://localhost:3000/docs) and `/docs/[slug]`, so all citations in assistant answers link directly to readable in-app pages.

Each has YAML frontmatter (`title`, `slug`, `category`, `url`, `updated`, `audience`) and consistent `##`/`###` heading structure, which is what the chunker splits on.

Facts are cross-checked for consistency across docs: plan prices, MAR allowances, rate limits, retention windows, and every `SYNC-xxx` error code agree wherever they appear. That matters because it means a wrong answer indicates a retrieval failure, not a contradictory source.
