// Renders a PR comment comparing two eval/baseline.json files, and exits 1 on a recall@5 drop.
//
//   node scripts/eval-report.ts <base-baseline.json> <new-baseline.json>
//
// The base copy must come from the base branch (`git show origin/main:eval/baseline.json`), never
// from the PR's own checkout: a docs PR may legitimately regenerate baseline.json, and comparing it
// against itself always passes.
//
// recall@5 is the gate — it is 1.0 today, so any drop means a question fell out of the results
// entirely. recall@1 only warns: one near-miss flipping rank moves it 0.029 over n=34, which is not
// worth blocking a docs fix. The per-question lines are the part a human acts on.
import { readFileSync } from "node:fs";

type Hit = { rank: number | null; topSimilarity: number; top: string | null };
type Metrics = { n: number; recallAt1: number; recallAt5: number; mrr: number };
type Baseline = {
  k: number;
  raw: Metrics;
  rephrased: Metrics | null;
  stale?: string;
  results: { question: string; expectedSlug: string | null; raw: Hit; rephrased?: Hit }[];
};

const [basePath, newPath] = process.argv.slice(2);
const load = (p: string): Baseline | null => {
  try {
    const b = JSON.parse(readFileSync(p, "utf8"));
    // a baseline from before the two-column split has no `raw` key; treat it as incomparable
    return b?.raw ? b : null;
  } catch {
    return null;
  }
};

const next = load(newPath);
if (!next) throw new Error(`${newPath} is missing or not a two-column baseline`);
const base = load(basePath);

const pct = (n: number) => n.toFixed(3);
const delta = (a: number, b: number) => (a === b ? "—" : `${b > a ? "+" : ""}${(b - a).toFixed(3)}`);

const lines = ["### Retrieval eval", ""];
if (next.stale) lines.push(`> [!WARNING]`, `> ${next.stale}`, "");

if (!base) {
  lines.push("No comparable baseline on the base branch — reporting absolute numbers.", "");
  lines.push("| metric | raw | rephrased |", "|---|---|---|");
  for (const k of ["recallAt1", "recallAt5", "mrr"] as const)
    lines.push(`| ${k} | ${pct(next.raw[k])} | ${next.rephrased ? pct(next.rephrased[k]) : "—"} |`);
} else {
  lines.push("| metric | base | this PR | Δ |", "|---|---|---|---|");
  for (const col of ["raw", "rephrased"] as const) {
    const b = base[col];
    const n = next[col];
    if (!b || !n) continue;
    for (const k of ["recallAt1", "recallAt5", "mrr"] as const)
      lines.push(`| ${k} (${col}) | ${pct(b[k])} | ${pct(n[k])} | ${delta(b[k], n[k])} |`);
  }
}

// rank movements, which say what actually broke rather than by how much
const moved: string[] = [];
for (const r of next.results) {
  const was = base?.results.find((x) => x.question === r.question);
  if (!was) continue;
  for (const col of ["raw", "rephrased"] as const) {
    const a = was[col]?.rank ?? null;
    const b = r[col]?.rank ?? null;
    if (!was[col] || !r[col] || a === b) continue;
    moved.push(
      `- \`${r.question}\` (${col}) rank ${a ?? "miss"} → ${b ?? "miss"}\n` +
        `  now: ${r[col]!.top} (${r[col]!.topSimilarity})`,
    );
  }
}
if (moved.length) lines.push("", "**Rank changes**", ...moved);

// Absolute state, not a diff: on the first run there is no base to compare against, and a question
// that has been failing for weeks never appears in `moved` at all.
const missing = next.results
  .filter((r) => r.expectedSlug !== null && (["raw", "rephrased"] as const).some((c) => r[c] && r[c]!.rank === null))
  .map((r) => `- \`${r.question}\`\n  got: ${r.raw.top}`);
if (missing.length) lines.push("", `**Not found in the top ${next.k} at all** (${missing.length})`, ...missing);

console.log(lines.join("\n"));

// gate: any recall@5 drop in either column
const dropped =
  base &&
  (["raw", "rephrased"] as const).some(
    (c) => base[c] && next[c] && next[c]!.recallAt5 < base[c]!.recallAt5,
  );
if (dropped) {
  console.error("\nrecall@5 dropped — a question fell out of the top 5 entirely");
  process.exit(1);
}
