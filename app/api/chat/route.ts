import {
  streamText,
  UIMessage,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  tool,
  isStepCount,
  APICallError,
  RetryError,
} from "ai";
import { google } from "@ai-sdk/google";
import { after } from "next/server";
import { db } from "@/lib/db";
import { retrievals } from "@/lib/db/schema";
import { TEXT_MODEL } from "@/lib/rag/embedding";
import { INSTRUCTIONS, SEARCH_TOOL } from "@/lib/rag/prompt";
import { search } from "@/lib/rag/search";
import { rateLimit } from "@/lib/rate-limit";

const K = 5;

// A floor against nothing at all, not a separator. eval/baseline.json scores both columns: on the
// `rephrased` one — the string this gate actually sees — correct answers bottom out at 0.638 while
// out-of-scope questions reach 0.714 ("do you sync to google sheets", which the model rewrites into
// corpus vocabulary as "google sheets sync destinations supported destinations"). No threshold
// separates those. Deciding whether the sections answer the question is the prompt's job, not this
// number's.
//
// Was 0.6, lowered after a false escalation that showed what the number actually measures.
// "is rupay credit card supported" retrieves Billing > Payment methods at top-1 — the section
// listing every card accepted, which answers it — and scored 0.568, while the same question padded
// with "for payment" scored 0.633 and was answered. A brand name absent from the corpus costs ~0.08
// of cosine similarity whether or not the retrieved section covers the question, so at 0.6 the gate
// was withholding correct retrievals from questions that name a product Meridian does not support —
// which is most of what a support user types. It never caught the out-of-scope ones anyway: they
// sail past at 0.7. 0.5 keeps the one job the eval shows a threshold can still do — catch the
// query that matched nothing — and leaves the rest to the prompt's answer-only-from-sections rule.
const MIN_SIMILARITY = 0.5;

// Gemini's free tier is 5 requests a minute, shared by everyone hitting this deployment. Matching
// that per caller means one client can reach the ceiling but cannot hold it there. It does not
// protect the separate 20/day cap — four minutes of one determined caller still spends the day.
const LIMIT = 5;
const WINDOW_MS = 60_000;

export async function POST(req: Request) {
  // before parsing the body or touching the model: the point is to spend nothing on a caller
  // that is already over
  const limited = rateLimit(req, "chat", LIMIT, WINDOW_MS);
  if (limited) return limited;

  // message variable contains history of the chat
  const { messages }: { messages: UIMessage[] } = await req.json();

  // generated here rather than by the SDK so the log rows and the client's message share one id
  const messageId = crypto.randomUUID();
  const searches: (typeof retrievals.$inferInsert)[] = [];

  // streamtext for showing response as streaming
  // there is generateText if dont want to stream the response
  const result = streamText({
    model: google(TEXT_MODEL),
    // a bare number is the total budget for the whole multi-step loop; this only bounds the wait for
    // the model to start responding. Free-tier Gemini can be slow to start.
    timeout: { firstChunkMs: 30_000 },
    maxRetries: 2,
    instructions: INSTRUCTIONS,
    maxOutputTokens: 512,
    reasoning: "low",
    // no of steps before that can run before generating final response
    stopWhen: isStepCount(5),
    messages: await convertToModelMessages(messages),
    tools: {
      searchKnowledgeBase: tool({
        ...SEARCH_TOOL,
        execute: async ({ query }) => {
          const started = performance.now();
          const results = await search(query, K);
          searches.push({
            messageId,
            query,
            chunkIds: results.map((r) => r.id),
            scores: results.map((r) => r.similarity),
            k: K,
            latencyMs: Math.round(performance.now() - started),
            model: TEXT_MODEL,
          });
          // escalation gate: withhold weak matches so the model has nothing to improvise from
          if (!results.length || results[0].similarity < MIN_SIMILARITY) {
            return {
              escalate: true,
              topSimilarity: results[0]?.similarity ?? 0,
              results: [],
            };
          }
          return {
            escalate: false,
            topSimilarity: results[0].similarity,
            results,
          };
        },
      }),
    },
  });

  // runs once the response has finished streaming, so logging never delays or breaks an answer
  after(async () => {
    if (!searches.length) return;
    // usage settles when generation ends; on a failed or client-aborted stream it may never
    // settle, and the searches are still worth keeping
    const usage = await Promise.race([
      Promise.resolve(result.totalUsage).catch(() => undefined),
      new Promise<undefined>((resolve) => setTimeout(resolve, 5_000)),
    ]);
    await db
      .insert(retrievals)
      .values(
        searches.map((s) => ({
          ...s,
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
        })),
      )
      .catch((error) => console.error("retrieval log write failed", error));
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      generateMessageId: () => messageId,
      // default hides every error as "An error occurred"; name the quota case, keep the rest hidden
      onError: (error) => {
        // the two strings below are all the client ever sees; without this the real cause
        // (503 overload, an embedding 4xx, a Neon connection drop) is gone for good
        console.error("chat stream error", error);
        const last = RetryError.isInstance(error) ? error.lastError : error;
        return APICallError.isInstance(last) && last.statusCode === 429
          ? "The assistant is over its usage limit right now. Please try again later."
          : "Something went wrong. Please try again.";
      },
    }),
  });
}
