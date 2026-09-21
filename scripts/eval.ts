// Retrieval eval: recall@1, recall@5, MRR over eval/questions.ts, written to eval/baseline.json.
//
//   node --env-file=.env scripts/eval.ts
//
// Scores two columns. `raw` embeds the question as the user typed it. `rephrased` embeds what the
// chat model actually sends to searchKnowledgeBase, captured by scripts/rephrase.ts — that is the
// string production searches on, and the one MIN_SIMILARITY should be read off.
//
// Only embeds queries — the chat model is never called. Two embed requests per question, run in
// sequence; 39 questions is ~78 requests against the free tier's 100/minute, so it has little room
// left. Add a pause if you grow the question set.
import { readFileSync, writeFileSync } from "node:fs";
import { questions } from "../eval/questions.ts";
import { INSTRUCTIONS, SEARCH_TOOL } from "../lib/rag/prompt.ts";
import { search } from "../lib/rag/search.ts";

const K = 5;
const round = (n: number) => Math.round(n * 1000) / 1000;

// missing file: raw-only run, so the eval still works before the first capture
let searchQueries: Record<string, string | null> = {};
let stale = false;
try {
  const file = JSON.parse(readFileSync("eval/search-queries.json", "utf8"));
  searchQueries = file.queries;
  // warn but still score: stale numbers with a label beat no numbers at all
  stale =
    JSON.stringify(file.prompt) !==
    JSON.stringify({ instructions: INSTRUCTIONS, tool: SEARCH_TOOL.description });
  if (stale) console.log("WARNING: captures predate the current prompt — re-run scripts/rephrase.ts\n");
} catch {
  console.log("no eval/search-queries.json — run scripts/rephrase.ts for the rephrased column\n");
}

type Hit = { rank: number | null; topSimilarity: number; top: string | null };

type EvalResult = {
  question: string;
  // null means the model answered without searching; absent means not captured yet
  searchQuery?: string | null;
  expectedSlug: string | null;
  expectedHeading?: string;
  raw: Hit;
  rephrased?: Hit;
};

async function score(query: string, q: (typeof questions)[number]): Promise<Hit> {
  const hits = await search(query, K);
  const index = hits.findIndex(
    (h) =>
      h.docSlug === q.expectedSlug &&
      (!q.expectedHeading || h.headingPath.includes(q.expectedHeading)),
  );
  return {
    rank: index === -1 ? null : index + 1,
    topSimilarity: round(hits[0]?.similarity ?? 0),
    top: hits[0] ? `${hits[0].docSlug} > ${hits[0].headingPath}` : null,
  };
}

const results: EvalResult[] = [];
for (const q of questions) {
  const searchQuery = searchQueries[q.question];
  results.push({
    ...q,
    searchQuery,
    raw: await score(q.question, q),
    rephrased: searchQuery ? await score(searchQuery, q) : undefined,
  });
}

// top-1 similarity split three ways: the escalation threshold belongs between the lowest correct
// score and the highest out-of-scope one
const sorted = (hits: Hit[]) => hits.map((h) => h.topSimilarity).sort((a, b) => a - b);

// `pick` selects the column. Results with no hit for that column drop out, which is how a question
// the model answered without searching leaves the rephrased numbers.
function metrics(rows: EvalResult[], pick: (r: EvalResult) => Hit | undefined) {
  const scored = rows.filter((r) => pick(r));
  const answerable = scored.filter((r) => r.expectedSlug !== null);
  const hits = answerable.map((r) => pick(r)!);
  const recallAt = (n: number) =>
    hits.filter((h) => h.rank !== null && h.rank <= n).length / hits.length;
  return {
    n: answerable.length,
    recallAt1: round(recallAt(1)),
    recallAt5: round(recallAt(5)),
    mrr: round(hits.reduce((sum, h) => sum + (h.rank ? 1 / h.rank : 0), 0) / hits.length),
    topSimilarity: {
      correctAt1: sorted(hits.filter((h) => h.rank === 1)),
      incorrectAt1: sorted(hits.filter((h) => h.rank !== 1)),
      outOfScope: sorted(scored.filter((r) => r.expectedSlug === null).map((r) => pick(r)!)),
    },
  };
}

// Both columns are scored over the same questions, so a partial capture cannot show a delta that is
// really just a difference in which questions each side was asked. Once every question is captured
// the subset is the whole set. With nothing captured, rephrased is null rather than a block of NaN.
const captured = results.filter((r) => r.rephrased);
const rows = captured.length ? captured : results;
const baseline = {
  k: K,
  coverage: `${captured.length}/${results.length} questions captured by scripts/rephrase.ts`,
  ...(stale ? { stale: "captured under an older prompt — re-run scripts/rephrase.ts" } : {}),
  raw: metrics(rows, (r) => r.raw),
  rephrased: captured.length ? metrics(rows, (r) => r.rephrased) : null,
  results,
};

for (const r of rows.filter((r) => r.expectedSlug !== null)) {
  for (const [label, hit] of [["raw", r.raw], ["rephrased", r.rephrased]] as const) {
    if (!hit || hit.rank === 1) continue;
    console.log(
      `rank ${hit.rank ?? "-"}  [${label}] ${r.question}\n        got ${hit.top} (${hit.topSimilarity})`,
    );
  }
}
for (const label of ["raw", "rephrased"] as const) {
  const m = baseline[label];
  if (!m) continue;
  console.log(
    `\n${label.padEnd(9)} recall@1 ${m.recallAt1}  recall@5 ${m.recallAt5}  MRR ${m.mrr}  (n=${m.n})`,
  );
  console.log(m.topSimilarity);
}

writeFileSync("eval/baseline.json", JSON.stringify(baseline, null, 2) + "\n");
