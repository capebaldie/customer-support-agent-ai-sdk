import {
  date,
  index,
  pgTable,
  serial,
  text,
  unique,
  vector,
} from "drizzle-orm/pg-core";
import { EMBEDDING_DIMENSIONS } from "../rag/embedding";

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
