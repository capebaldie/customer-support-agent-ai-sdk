// Retrieval eval: recall@1, recall@5, MRR over eval/questions.ts, written to eval/baseline.json.
//
//   node --env-file=.env scripts/eval.ts
//
// Only embeds queries — the chat model is never called. One embed request per question, run in
// sequence, well under the free tier's 100/minute.
import { writeFileSync } from "node:fs";
import { questions } from "../eval/questions.ts";
import { search } from "../lib/rag/search.ts";

const K = 5;
const round = (n: number) => Math.round(n * 1000) / 1000;

type EvalResult = {
  question: string;
  expectedSlug: string | null;
  expectedHeading?: string;
  rank: number | null;
  topSimilarity: number;
  top: string | null;
};

const results: EvalResult[] = [];
for (const q of questions) {
  const hits = await search(q.question, K);
  const index = hits.findIndex(
    (h) =>
      h.docSlug === q.expectedSlug &&
      (!q.expectedHeading || h.headingPath.includes(q.expectedHeading)),
  );
  results.push({
    ...q,
    rank: index === -1 ? null : index + 1,
    topSimilarity: round(hits[0]?.similarity ?? 0),
    top: hits[0] ? `${hits[0].docSlug} > ${hits[0].headingPath}` : null,
  });
}

const answerable = results.filter((r) => r.expectedSlug !== null);
const recallAt = (n: number) =>
  answerable.filter((r) => r.rank !== null && r.rank <= n).length /
  answerable.length;

// top-1 similarity split three ways: the escalation threshold belongs between the lowest correct
// score and the highest out-of-scope one
const sorted = (rs: typeof results) =>
  rs.map((r) => r.topSimilarity).sort((a, b) => a - b);

const baseline = {
  k: K,
  n: answerable.length,
  recallAt1: round(recallAt(1)),
  recallAt5: round(recallAt(5)),
  mrr: round(
    answerable.reduce((sum, r) => sum + (r.rank ? 1 / r.rank : 0), 0) /
      answerable.length,
  ),
  topSimilarity: {
    correctAt1: sorted(answerable.filter((r) => r.rank === 1)),
    incorrectAt1: sorted(answerable.filter((r) => r.rank !== 1)),
    outOfScope: sorted(results.filter((r) => r.expectedSlug === null)),
  },
  results,
};

for (const r of answerable.filter((r) => r.rank !== 1)) {
  console.log(
    `rank ${r.rank ?? "-"}  ${r.question}\n        got ${r.top} (${r.topSimilarity})`,
  );
}
console.log(
  `\nrecall@1 ${baseline.recallAt1}  recall@5 ${baseline.recallAt5}  MRR ${baseline.mrr}  (n=${baseline.n})`,
);
console.log(baseline.topSimilarity);

writeFileSync("eval/baseline.json", JSON.stringify(baseline, null, 2) + "\n");
