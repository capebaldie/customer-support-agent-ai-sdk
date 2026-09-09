import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { chunkMarkdown } from "./chunk.ts";

const DOCS = "content/docs";

const corpus = readdirSync(DOCS)
  .filter((f) => f.endsWith(".md"))
  .flatMap((f) => chunkMarkdown(readFileSync(`${DOCS}/${f}`, "utf8")));

test("chunks the whole corpus", () => {
  assert.ok(
    corpus.length > 225 && corpus.length < 250,
    `expected 225-250 chunks, got ${corpus.length}`,
  );
  assert.ok(corpus.every((c) => c.docSlug && c.url && c.category && c.content));
});

test("drops bodyless headers but keeps them in breadcrumbs", () => {
  const own = corpus.filter((c) => c.headingPath.endsWith("400 — Bad request"));
  assert.equal(own.length, 0);

  const children = corpus.filter((c) =>
    c.headingPath.startsWith("400 — Bad request > "),
  );
  assert.ok(children.length >= 3);
});

test("breadcrumb carries the status code into a section that omits it", () => {
  const chunk = corpus.find((c) => c.headingPath.endsWith("schema_locked"));
  assert.ok(chunk, "no schema_locked chunk");
  assert.ok(!chunk.content.includes("409"), "fixture changed: body now has 409");
  assert.match(chunk.embeddingInput, /409/);
  assert.match(chunk.embeddingInput, /^API Error Codes > 409/);
});

test("keeps a table whole, header row included", () => {
  const chunk = corpus.find((c) => c.headingPath === "Error types");
  assert.ok(chunk);
  assert.match(chunk.content, /\| Type \| Meaning \| Retry\? \|/);
  assert.match(chunk.content, /`api_error`/);
});

test("ignores headings inside code fences", () => {
  const chunks = chunkMarkdown(
    ["---", "title: T", "slug: t", "url: u", "category: c", "---", "", "# T", "", "## Real", "", "```md", "## Fake", "```", ""].join("\n"),
  );
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].headingPath, "Real");
  assert.match(chunks[0].content, /## Fake/);
});
