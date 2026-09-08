import { pgTable, serial, text, vector, index } from "drizzle-orm/pg-core";

export const chunks = pgTable(
  "chunks",
  {
    id: serial().primaryKey(),
    docSlug: text().notNull(),
    docTitle: text().notNull(),
    url: text().notNull(),
    category: text().notNull(),
    headingPath: text().notNull(),
    content: text().notNull(),
    // using dimension as per gemini model
    embedding: vector({ dimensions: 1536 }).notNull(),
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
  ],
);
