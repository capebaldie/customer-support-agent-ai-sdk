import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { TEXT_MODEL } from "@/lib/rag/embedding";
import { rateLimit } from "@/lib/rate-limit";

// Lighter limits than the main chat: these are small, cheap calls but still hit the
// same Gemini quota. Allowing fewer per window keeps headroom for actual questions.
const LIMIT = 3;
const WINDOW_MS = 60_000;

const schema = z.object({
  questions: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe("2-3 short follow-up questions the user might ask next"),
});

export async function POST(req: Request) {
  const limited = rateLimit(req, "followups", LIMIT, WINDOW_MS);
  if (limited) return limited;

  const { answer, sources } = await req.json();

  const { output } = await generateText({
    model: google(TEXT_MODEL),
    output: Output.object({
      schema,
    }),
    maxOutputTokens: 150,
    prompt: `You are the support assistant for Meridian Sync. A user just received this answer from the documentation:

---
${answer}
---

The answer cited these documentation sections: ${sources.join(", ")}

Based only on what these documentation sections are likely to cover, suggest 2-3 short follow-up questions the user might naturally ask next. Each question must be:
- Directly related to the topic just discussed
- Answerable by the Meridian Sync documentation
- A single sentence, under 60 characters
- Phrased as a natural question a real user would type

Do not suggest questions that were already answered above.`,
  });

  return Response.json(output);
}
