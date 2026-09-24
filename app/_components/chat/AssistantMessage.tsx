import type { UIMessage } from "ai";
import { useEffect, useState } from "react";
import { AnswerPart } from "./AnswerPart";
import { FollowUpSuggestions } from "./FollowUpSuggestions";
import { Thumb } from "./icons";
import { searchOutputs } from "./search-output";

export function AssistantMessage({
  message,
  busy,
  isLast,
  feedbackValue,
  onVote,
  onFollowUp,
}: {
  message: UIMessage;
  busy: boolean;
  isLast: boolean;
  feedbackValue: "up" | "down" | undefined;
  onVote: (messageId: string, value: "up" | "down") => void;
  onFollowUp: (question: string) => void;
}) {
  const [followUps, setFollowUps] = useState<string[]>([]);

  // dedupe by url: several chunks from one doc, or repeat searches, share a source link
  const sources = [
    ...new Map(
      searchOutputs(message)
        .flatMap((o) => o.results)
        .map((r) => [r.url, r]),
    ).values(),
  ];

  const hasSearchResults = searchOutputs(message).length > 0;
  const done = isLast && !busy && hasSearchResults;

  // fetch follow-up suggestions once the answer finishes streaming
  useEffect(() => {
    if (!done) return;

    // collect the full answer text from all text parts
    const answerText = message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n");

    if (!answerText.trim()) return;

    const sourceTitles = sources.map((s) => s.docTitle);

    // fire-and-forget: follow-ups are a nice-to-have, not critical
    fetch("/api/followups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answer: answerText, sources: sourceTitles }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setFollowUps(data.questions ?? []))
      .catch(() => {}); // silent fail — the chat still works without suggestions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

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
      {hasSearchResults && !(busy && isLast) && (
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

      {/* follow-up suggestions — only on the latest completed answer */}
      {isLast && followUps.length > 0 && (
        <FollowUpSuggestions questions={followUps} onSelect={onFollowUp} />
      )}
    </div>
  );
}
