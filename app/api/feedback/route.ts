import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { retrievals } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";

const body = z.object({
  messageId: z.uuid(),
  feedback: z.enum(["up", "down"]),
  // trust boundary: free text straight from the browser, so it is length-capped here rather
  // than relying on the input's maxLength. Sent as a second request after the vote itself.
  comment: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  // an open write endpoint: a guessed messageId is the only thing standing in front of it. Loose
  // enough that nobody voting by hand will ever see it.
  const limited = rateLimit(req, "feedback", 30, 60_000);
  if (limited) return limited;

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("invalid feedback", { status: 400 });

  const { messageId, feedback, comment } = parsed.data;
  // an answer with no search has no rows; there is nothing to attach feedback to
  await db
    .update(retrievals)
    // an empty box after trimming is not a comment — leave whatever is already stored alone
    .set(comment ? { feedback, comment } : { feedback })
    .where(eq(retrievals.messageId, messageId));
  return new Response(null, { status: 204 });
}
