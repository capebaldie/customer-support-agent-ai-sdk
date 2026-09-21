// Captures what the chat model actually sends to searchKnowledgeBase for each eval question, into
// eval/search-queries.json. Committed, not regenerated per eval run: a live model call inside the
// eval loop makes baseline.json non-deterministic, and then a real retrieval regression is
// indistinguishable from rephrase drift.
//
//   node --env-file=.env scripts/rephrase.ts
//
// Paced and resumable: the free tier caps generateContent per model, at 5/minute AND 20/day on
// gemini-3.5-flash. Both 429s name the same metric, so read quotaId and retryDelay in the body to
// tell which one you hit — the daily one means come back tomorrow, and 39 questions needs two days.
// Questions already in the file are skipped and every answer is written as it arrives, so a run cut
// off by quota just needs re-running.
//
// The file records the prompt its queries were captured under. Change INSTRUCTIONS or the tool
// description and both scripts say so rather than scoring a prompt that no longer exists — a
// multi-day capture is too expensive to let go stale quietly.
import { readFileSync, writeFileSync } from "node:fs";
import { google } from "@ai-sdk/google";
import { generateText, tool } from "ai";
import { questions } from "../eval/questions.ts";
import { TEXT_MODEL } from "../lib/rag/embedding.ts";
import { INSTRUCTIONS, SEARCH_TOOL } from "../lib/rag/prompt.ts";

const FILE = "eval/search-queries.json";

// ponytail: fixed pause under the observed 5/minute cap. Raise PAUSE_MS if the model changes and
// 429s return; on a paid key drop it and run the questions concurrently.
const PAUSE_MS = 13_000;

// no execute: generateText stops at the call and hands it back instead of searching. No toolChoice
// either — a question the model refuses to search for is a real outcome worth recording as null.
const tools = { searchKnowledgeBase: tool(SEARCH_TOOL) };

// stored verbatim rather than hashed: the diff then shows what actually changed
export const promptOfRecord = { instructions: INSTRUCTIONS, tool: SEARCH_TOOL.description };

let captured: Record<string, string | null> = {};
try {
  const file = JSON.parse(readFileSync(FILE, "utf8"));
  if (JSON.stringify(file.prompt) !== JSON.stringify(promptOfRecord)) {
    console.error(
      `${FILE} was captured under a different prompt. Delete it and re-capture, ` +
        `or restore lib/rag/prompt.ts.`,
    );
    process.exit(1);
  }
  captured = file.queries;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

// rebuilt in questions.ts order each time, so resuming does not scramble the file
const save = (next: Record<string, string | null>) =>
  writeFileSync(
    FILE,
    JSON.stringify(
      {
        prompt: promptOfRecord,
        queries: Object.fromEntries(
          questions.filter((q) => q.question in next).map((q) => [q.question, next[q.question]]),
        ),
      },
      null,
      2,
    ) + "\n",
  );

for (const q of questions) {
  if (q.question in captured) continue;

  let toolCalls;
  try {
    // maxRetries 0: the binding quota is daily, so backing off and retrying only burns more of it
    ({ toolCalls } = await generateText({
      model: google(TEXT_MODEL),
      instructions: INSTRUCTIONS,
      prompt: q.question,
      maxOutputTokens: 512,
      reasoning: "low",
      maxRetries: 0,
      tools,
    }));
  } catch (error) {
    console.log(`\nstopped at "${q.question}": ${error instanceof Error ? error.message : error}`);
    break;
  }

  // only the first call: production can search again after a miss, but the retry is driven by
  // results this script never produces, so there is nothing faithful to capture beyond the first.
  // A tool with no execute is typed as dynamic, so its input arrives as unknown — parse, don't cast.
  const call = toolCalls[0];
  captured[q.question] = call ? SEARCH_TOOL.inputSchema.parse(call.input).query : null;
  save(captured);
  console.log(`${captured[q.question] ?? "(no search)"}\n        ${q.question}`);
  await new Promise((r) => setTimeout(r, PAUSE_MS));
}

const done = questions.filter((q) => q.question in captured);
const unsearched = done.filter((q) => captured[q.question] === null).length;
console.log(
  `\n${done.length}/${questions.length} captured — ${done.length - unsearched} rephrased, ` +
    `${unsearched} answered without searching`,
);
if (done.length < questions.length) console.log("re-run tomorrow to continue");
