import {
  check,
  date,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { EMBEDDING_DIMENSIONS } from "../rag/embedding.ts";

export const chunks = pgTable(
  "chunks",
  {
    id: serial().primaryKey(),
    docSlug: text().notNull(),
    docTitle: text().notNull(),
    url: text().notNull(),
    category: text().notNull(),
    // frontmatter `updated`, shown alongside citations — an answer that is
    // correct for last quarter is the failure users are least able to spot
    updated: date().notNull(),
    headingPath: text().notNull(),
    content: text().notNull(),
    // hash of embeddingInput, not of content: a heading rename changes the
    // breadcrumb, which changes the vector. Ingestion re-embeds only the
    // chunks whose hash moved.
    contentHash: text().notNull(),
    // using dimension as per gemini model
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  },
  // table-level extras: indexes and constraints that belong to the table
  // rather than one column. HNSW is pgvector's approximate nearest-neighbour
  // index — the default btree cannot order 1536 dimensions. vector_cosine_ops
  // must match the distance metric the search query uses, or Postgres silently
  // ignores the index and falls back to scanning every row.
  (table) => [
    index("chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    // a chunk's identity across runs, and the conflict target ingestion
    // upserts on. `id` is a surrogate key — it changes on every reinsert,
    // so it cannot be what a diff matches against.
    unique("chunks_ident").on(table.docSlug, table.headingPath),
  ],
);

// one row per searchKnowledgeBase call — what the model searched for and exactly what came back
export const retrievals = pgTable(
  "retrievals",
  {
    id: serial().primaryKey(),
    // the assistant message id the client sees; several searches in one answer share it, and
    // feedback is written against it
    messageId: text().notNull(),
    query: text().notNull(),
    // no foreign key: ingest deletes chunks whose heading was renamed, and the log must outlive them.
    // An id that no longer joins means the doc changed after this answer.
    chunkIds: integer().array().notNull(),
    scores: real().array().notNull(),
    k: integer().notNull(),
    latencyMs: integer().notNull(),
    model: text().notNull(),
    // whole-answer totals, repeated on each search row of that answer; null when generation failed
    inputTokens: integer(),
    outputTokens: integer(),
    feedback: text({ enum: ["up", "down"] }),
    // free text from the thumbs-down box, optional. A bare `down` only says someone was unhappy;
    // this is what distinguishes retrieval missing, the model ignoring sections it was given, and
    // half a two-part question going unanswered — three different fixes.
    comment: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("retrievals_message_idx").on(table.messageId),
    index("retrievals_created_idx").on(table.createdAt),
    // text({ enum }) only narrows the TypeScript type; this is what stops a bad value in the table
    check("retrievals_feedback", sql`${table.feedback} in ('up', 'down')`),
  ],
);
