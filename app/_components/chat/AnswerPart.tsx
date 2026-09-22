import type { UIMessage } from "ai";
import { Streamdown } from "streamdown";
import type { SearchOutput } from "./search-output";

export function AnswerPart({
  part,
  busy,
}: {
  part: UIMessage["parts"][number];
  busy: boolean;
}) {
  if (part.type === "text") {
    return (
      <div className="answer">
        <Streamdown animated isAnimating={busy}>
          {part.text}
        </Streamdown>
      </div>
    );
  }

  if (part.type !== "tool-searchKnowledgeBase") {
    return null;
  }

  const { query } = (part.input ?? {}) as { query?: string };

  if (part.state === "output-error") {
    return (
      <p className="my-3 text-sm text-signal">
        Search failed for “{query}”. {part.errorText}
      </p>
    );
  }

  if (part.state !== "output-available") {
    return (
      <p className="my-3 text-sm text-depth">
        Searching the docs for “{query ?? "…"}”
      </p>
    );
  }

  const output = part.output as SearchOutput;
  return (
    // kept deliberately: tasks.md Task 7 built this to tell "retrieval returned the
    // wrong sections" apart from "the model ignored the right ones". Quiet, but the
    // scores are machine output, so they are set in the machine face.
    <details className="group my-3 text-sm">
      <summary className="flex items-baseline gap-2 text-depth">
        <span
          aria-hidden
          className="shrink-0 transition-transform group-open:rotate-90"
        >
          ›
        </span>
        <span className="min-w-0 flex-1 truncate">Searched “{query}”</span>
        <span
          className={`shrink-0 font-mono text-xs ${
            output.escalate ? "text-signal" : ""
          }`}
        >
          {output.topSimilarity.toFixed(3)}
          {output.escalate && " below threshold"}
        </span>
      </summary>
      <ol className="mt-2 space-y-1 pl-5">
        {output.results.map((r) => (
          <li key={r.id} className="flex gap-3 text-depth">
            <span className="shrink-0 font-mono text-xs leading-5">
              {r.similarity.toFixed(3)}
            </span>
            <span className="min-w-0 text-[0.8125rem] leading-5">
              {r.docTitle} › {r.headingPath}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
