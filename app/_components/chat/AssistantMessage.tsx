import type { UIMessage } from "ai";
import { AnswerPart } from "./AnswerPart";
import { Thumb } from "./icons";
import { searchOutputs } from "./search-output";

export function AssistantMessage({
  message,
  busy,
  isLast,
  feedbackValue,
  onVote,
}: {
  message: UIMessage;
  busy: boolean;
  isLast: boolean;
  feedbackValue: "up" | "down" | undefined;
  onVote: (messageId: string, value: "up" | "down") => void;
}) {
  // dedupe by url: several chunks from one doc, or repeat searches, share a source link
  const sources = [
    ...new Map(
      searchOutputs(message)
        .flatMap((o) => o.results)
        .map((r) => [r.url, r]),
    ).values(),
  ];

  return (
    <div className="-mt-6">
      <h3 className="sr-only">Answer</h3>

      {message.parts.map((part, i) => (
        <AnswerPart key={`${message.id}-${i}`} part={part} busy={busy} />
      ))}

      {sources.length > 0 && (
        // the date is the part a reader cannot judge for themselves, so it gets its own
        // column instead of trailing the title in grey
        <ul className="mt-7 border-t border-rule">
          {sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-baseline justify-between gap-4 border-b border-rule py-2 text-sm hover:text-signal"
              >
                <span className="min-w-0">{s.docTitle}</span>
                <span className="shrink-0 font-mono text-xs text-depth">
                  {s.updated}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* only answers that searched have log rows to attach feedback to */}
      {searchOutputs(message).length > 0 && !(busy && isLast) && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          {feedbackValue ? (
            // the POST is fire-and-forget, so this acknowledges the click, not the
            // write. role=status announces it to whoever activated the button that
            // just vanished.
            <span role="status" className="text-depth">
              Thanks for the feedback.
            </span>
          ) : (
            <>
              <span className="text-depth">Was this helpful?</span>
              {(["up", "down"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={value === "up" ? "Helpful" : "Not helpful"}
                  onClick={() => onVote(message.id, value)}
                  className="rounded-lg border border-rule p-1.5 text-depth hover:border-signal hover:text-signal"
                >
                  <Thumb down={value === "down"} />
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
