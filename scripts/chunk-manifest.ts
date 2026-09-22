// Prints the corpus's chunk structure, one line per chunk, for diffing across commits.
//
//   node scripts/chunk-manifest.ts
//
// lib/rag/chunk.ts has no imports, so this runs in a bare checkout with no install and no API calls.
// CI emits it at the base commit and at the PR head and diffs the two: a chunker change leaves every
// markdown file byte-identical while moving every boundary in the corpus, and this is the only thing
// that shows that before an embedding is spent. It says which boundaries moved, never whether
// retrieval got better — that is the eval's job.
import { readFileSync, readdirSync } from "node:fs";
import { chunkMarkdown } from "../lib/rag/chunk.ts";

const DOCS = "content/docs";

let total = 0;
for (const file of readdirSync(DOCS).filter((f) => f.endsWith(".md")).sort()) {
  for (const chunk of chunkMarkdown(readFileSync(`${DOCS}/${file}`, "utf8"))) {
    // the embedded length, not the raw content: that is what actually becomes a vector
    console.log(`${chunk.docSlug} > ${chunk.headingPath}\t${chunk.embeddingInput.length}`);
    total++;
  }
}
console.log(`# ${total} chunks`);
