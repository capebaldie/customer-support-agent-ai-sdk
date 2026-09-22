import type { UIMessage } from "ai";
import type { search } from "@/lib/rag/search";

// mirrors the searchKnowledgeBase execute() return in app/api/chat/route.ts
export type SearchOutput = {
  escalate: boolean;
  topSimilarity: number;
  results: Awaited<ReturnType<typeof search>>;
};

export function searchOutputs(message: UIMessage) {
  return message.parts.flatMap((part) =>
    part.type === "tool-searchKnowledgeBase" &&
    part.state === "output-available"
      ? [part.output as SearchOutput]
      : [],
  );
}
