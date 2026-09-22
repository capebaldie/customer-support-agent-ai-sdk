import type { UIMessage } from "ai";
import { AssistantMessage } from "./AssistantMessage";

export function MessageThread({
  messages,
  busy,
  feedback,
  onVote,
}: {
  messages: UIMessage[];
  busy: boolean;
  feedback: Record<string, "up" | "down">;
  onVote: (messageId: string, value: "up" | "down") => void;
}) {
  const lastId = messages.at(-1)?.id;

  return (
    <>
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <h2
              key={message.id}
              className="text-[1.375rem] leading-snug font-bold tracking-[-0.015em]"
            >
              <span className="sr-only">You asked: </span>
              {message.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("")}
            </h2>
          );
        }

        return (
          <AssistantMessage
            key={message.id}
            message={message}
            busy={busy}
            isLast={message.id === lastId}
            feedbackValue={feedback[message.id]}
            onVote={onVote}
          />
        );
      })}

      {/* covers the gap before the first text/tool part, e.g. while the server retries a rate
          limit; the assistant message may already exist holding only a "step-start" part */}
      {busy &&
        (messages.at(-1)?.role === "user" ||
          !messages
            .at(-1)
            ?.parts.some(
              (p) => p.type === "text" || p.type.startsWith("tool-"),
            )) && (
          <p className="-mt-6 text-sm text-depth">
            <span className="animate-pulse">Searching the docs</span>
          </p>
        )}
    </>
  );
}
