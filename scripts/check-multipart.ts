// One behaviour check: a two-part question must not lose a part.
//
//   pnpm dev                          # in another terminal
//   node scripts/check-multipart.ts
//
// Deliberately not part of the retrieval eval. eval/questions.ts scores one question against one
// expected doc, and each half below already passes there on its own — what breaks is the answer
// dropping a half, which is prompt behaviour. So it needs the real route and a live model call, and
// it stays out of baseline.json's deterministic numbers. One generateContent call per run, against
// a free-tier cap of 20/day, so this is a run-it-when-you-touch-the-prompt check, not a CI gate.
//
// Only the answer is asserted, not the number of searches: the model reliably blends both parts
// into one query, and that is fine as long as K=5 covers both docs. The queries are printed because
// a blend that stops covering both is how case 1 would start failing.
import assert from "node:assert/strict";
import { ESCALATION_MESSAGE } from "../lib/rag/prompt.ts";

const ENDPOINT = process.env.CHAT_URL ?? "http://localhost:3000/api/chat";

// The uncovered-half case that used to live here is gone: it asserted a partial answer plus the
// escalation line, which INSTRUCTIONS forbids outright ("Reply with exactly this and nothing else").
// It could only ever pass by the model disobeying the prompt. See docs/tasks.md for what it found.
const CASES = [
  {
    // both halves covered — the answer must cite both docs, not just whichever the query leaned on
    question: "is there a free trial available and is there a refund policy?",
    expect: ["plans-and-pricing", "billing-and-invoices"],
  },
];

for (const { question, expect } of CASES) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: question }] }],
    }),
  });
  assert.ok(res.ok, `${res.status} ${res.statusText} — is \`pnpm dev\` running?`);

  // SSE: one `data: <json>` per chunk, terminated by `data: [DONE]`. Buffered rather than streamed —
  // nothing here reacts to a partial answer.
  const queries: string[] = [];
  let answer = "";
  for (const line of (await res.text()).split("\n")) {
    if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
    const chunk = JSON.parse(line.slice(6));
    if (chunk.type === "tool-input-available") queries.push(chunk.input.query);
    if (chunk.type === "text-delta") answer += chunk.delta;
    // the route maps failures to a user-facing string; surface it rather than failing on no answer
    if (chunk.type === "error") assert.fail(chunk.errorText);
  }

  console.log(`\n${question}\n${queries.map((q) => `  search: ${q}`).join("\n")}\n\n${answer}`);

  assert.notEqual(answer.trim(), ESCALATION_MESSAGE, "escalated instead of answering the covered half");
  const missing = expect.filter((needle) => !answer.includes(needle));
  assert.equal(missing.length, 0, `answer never mentions ${missing.join(", ")}`);
}

console.log("\nok — both parts survived");
