-- pgvector must exist before the vector(1536) column below.
-- Hand-added: drizzle-kit does not track extensions in meta/ snapshots,
-- so it will NOT regenerate this line. Keep it if these migrations are squashed.
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"docSlug" text NOT NULL,
	"docTitle" text NOT NULL,
	"url" text NOT NULL,
	"category" text NOT NULL,
	"headingPath" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chunks_embedding_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);