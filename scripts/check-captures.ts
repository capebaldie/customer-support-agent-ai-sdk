// Fails if eval/search-queries.json was captured under a different prompt than lib/rag/prompt.ts.
//
//   node scripts/check-captures.ts
//
// A captured query only means something next to the prompt that produced it. Edit INSTRUCTIONS and
// the model would search differently, so the committed queries describe a system that no longer
// exists — and the eval would report confident numbers for it. That is the failure this guards.
//
// No database and no API calls, so it runs on every PR including forks. The fix is local and slow:
// `pnpm eval:rephrase` needs one chat call per question against a free-tier cap of 20/day.
//
// Deleting eval/search-queries.json is the deliberate way out. That passes: scripts/eval.ts already
// falls back to scoring the raw column alone. Skipping the check has to be a choice, not an accident.
import { readFileSync } from "node:fs";
import { INSTRUCTIONS, SEARCH_TOOL } from "../lib/rag/prompt.ts";

const FILE = "eval/search-queries.json";

let file;
try {
  file = JSON.parse(readFileSync(FILE, "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  console.log(`no ${FILE} — the eval will score the raw column only`);
  process.exit(0);
}

const current = { instructions: INSTRUCTIONS, tool: SEARCH_TOOL.description };
if (JSON.stringify(file.prompt) === JSON.stringify(current)) {
  console.log(`${FILE} matches lib/rag/prompt.ts (${Object.keys(file.queries).length} queries)`);
  process.exit(0);
}

console.error(
  `${FILE} was captured under a different prompt than lib/rag/prompt.ts.\n\n` +
    `The committed search queries no longer describe what the model would search for, so the\n` +
    `eval's rephrased column would be wrong. Either:\n\n` +
    `  pnpm eval:rephrase        # recapture (20 chat calls/day, so 39 questions takes two days)\n` +
    `  rm ${FILE}   # or drop the rephrased column deliberately\n`,
);
process.exit(1);
