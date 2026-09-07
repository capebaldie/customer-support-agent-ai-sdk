# Support Agent

A RAG-based customer support agent built with the [Vercel AI SDK](https://ai-sdk.dev) and Next.js.

It answers questions about a fictional product — **Meridian Sync**, a managed data-pipeline SaaS — from a knowledge base of support docs in [`content/docs/`](content/docs/). The docs are invented, but they are written like real ones: consistent plan limits, a full error-code reference, and deliberately similar topics that retrieval has to tell apart.

## Stack

| | |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| AI | Vercel AI SDK v7 |
| Chat model | `gemini-3.5-flash` |
| Embeddings | `gemini-embedding-001` at 1536 dimensions |
| Database | Neon Postgres + pgvector |
| ORM | Drizzle |
| Styling | Tailwind CSS v4 |

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

| Variable | Where to get it |
| --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `DATABASE_URL` | [Neon console](https://console.neon.tech) — use the **pooled** connection string, the one with `-pooler` in the host |

Both are required. The server validates them at startup and refuses to boot with a message naming what is missing, so you will not spend time debugging a symptom that is really a config problem.

**3. Run**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  api/chat/route.ts    chat endpoint — streaming, agentic tool loop
  page.tsx             chat UI
content/docs/          the knowledge base: 15 markdown docs
lib/
  env.ts               env var validation (zod)
instrumentation.ts     runs the env check once, before the server serves
```

## Environment validation

[`lib/env.ts`](lib/env.ts) parses `process.env` with a zod schema and throws if anything is missing or malformed. [`instrumentation.ts`](instrumentation.ts) imports it from Next's `register` hook, which runs once per server instance and must complete before the server accepts requests.

The effect is that a bad config fails the boot instead of surfacing later as a confusing 500. To add a new required variable, add it to the schema in `lib/env.ts` and to `.env.example`.

## The knowledge base

15 docs, ~2,800 lines, in [`content/docs/`](content/docs/) — onboarding, pricing, billing, account management, auth and SSO, the REST API, error codes, webhooks, connectors, destinations, sync modes, troubleshooting, limits, security, and support.

Each has YAML frontmatter (`title`, `slug`, `category`, `url`, `updated`, `audience`) and consistent `##`/`###` heading structure, which is what the chunker splits on.

Facts are cross-checked for consistency across docs: plan prices, MAR allowances, rate limits, retention windows, and every `SYNC-xxx` error code agree wherever they appear. That matters because it means a wrong answer indicates a retrieval failure, not a contradictory source.

## Status

Built:

- [x] Streaming chat endpoint and UI
- [x] Knowledge base
- [x] Environment validation

In progress:

- [ ] Database schema and pgvector setup
- [ ] Markdown chunker (heading sections, breadcrumb-enriched)
- [ ] Ingestion script
- [ ] Retrieval as an agent tool
- [ ] Citations in the UI
- [ ] Eval harness — recall@k against hand-written question/source pairs

Deferred until the eval says they are needed: hybrid search, reranking, conversation persistence, auth and account-lookup tools, rate limiting.
