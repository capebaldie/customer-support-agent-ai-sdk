import assert from "node:assert/strict";
import { google } from "@ai-sdk/google";
import { embed } from "ai";
import { cosineDistance, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { chunks } from "../db/schema.ts";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./embedding.ts";

// embedding dimensions must match scripts/ingest.ts, or the query lands in a different vector space
// embedding dimensions setup inside /embedding.ts for consistency

/**
 * Finds the doc sections closest in meaning to the user's question.
 *
 * @param query the user's question, in their own words
 * @param k how many sections to return, best match first. `k` is the usual
 *   name in search ("top-k", from k-nearest neighbours), not an abbreviation.
 */
export async function search(query: string, k = 5) {
  const { embedding } = await embed({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    value: query,
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        // the query half of the asymmetric pair; ingest uses RETRIEVAL_DOCUMENT
        taskType: "RETRIEVAL_QUERY",
      },
    },
  });

  assert.equal(
    embedding.length,
    EMBEDDING_DIMENSIONS,
    `model returned ${embedding.length} dimensions, schema expects ${EMBEDDING_DIMENSIONS}`,
  );

  const distance = cosineDistance(chunks.embedding, embedding);

  return (
    db
      .select({
        id: chunks.id,
        docSlug: chunks.docSlug,
        docTitle: chunks.docTitle,
        url: chunks.url,
        updated: chunks.updated,
        headingPath: chunks.headingPath,
        content: chunks.content,
        // parenthesised: `-` binds tighter than `<=>`, so `1 - a <=> b` is `(1 - a) <=> b`
        similarity: sql<number>`1 - (${distance})`,
      })
      .from(chunks)
      // ascending distance, not descending similarity — only this uses the HNSW index
      .orderBy(distance)
      .limit(k)
  );
}
