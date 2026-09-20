import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { retrievals } from "@/lib/db/schema";

const body = z.object({
  messageId: z.uuid(),
  feedback: z.enum(["up", "down"]),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("invalid feedback", { status: 400 });

  const { messageId, feedback } = parsed.data;
  // an answer with no search has no rows; there is nothing to attach feedback to
  await db.update(retrievals).set({ feedback }).where(eq(retrievals.messageId, messageId));
  return new Response(null, { status: 204 });
}
