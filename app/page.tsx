"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useState } from "react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import type { search } from "@/lib/rag/search";

// mirrors the searchKnowledgeBase execute() return in app/api/chat/route.ts
type SearchOutput = {
  escalate: boolean;
  topSimilarity: number;
  results: Awaited<ReturnType<typeof search>>;
};

function searchOutputs(message: UIMessage) {
  return message.parts.flatMap((part) =>
    part.type === "tool-searchKnowledgeBase" && part.state === "output-available"
      ? [part.output as SearchOutput]
      : [],
  );
}

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat();
  // "error" stays enabled so the user can retry; otherwise the form would lock after one failure
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-col w-full max-w-2xl px-4 py-24 mx-auto gap-6">
      {messages.map((message) => {
        // dedupe by url: several chunks from one doc, or repeat searches, share a source link
        const sources = [
          ...new Map(
            searchOutputs(message)
              .flatMap((o) => o.results)
              .map((r) => [r.url, r]),
          ).values(),
        ];

        return (
          <div key={message.id}>
            <div className="font-semibold">
              {message.role === "user" ? "You" : "Assistant"}
            </div>

            {message.parts.map((part, i) => {
              const key = `${message.id}-${i}`;

              if (part.type === "text") {
                return (
                  <Streamdown
                    key={key}
                    animated
                    isAnimating={busy}
                  >
                    {part.text}
                  </Streamdown>
                );
              }

              if (part.type !== "tool-searchKnowledgeBase") {
                return null;
              }

              const { query } = (part.input ?? {}) as { query?: string };

              if (part.state === "output-error") {
                return (
                  <p key={key} className="my-2 text-sm text-red-600">
                    Search failed for “{query}”: {part.errorText}
                  </p>
                );
              }

              if (part.state !== "output-available") {
                return (
                  <p key={key} className="my-2 text-sm text-zinc-500">
                    Searching docs for “{query ?? "…"}”…
                  </p>
                );
              }

              const output = part.output as SearchOutput;
              return (
                <details
                  key={key}
                  className="my-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded p-2"
                >
                  <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">
                    Searched “{query}” — top {output.topSimilarity.toFixed(3)}
                    {output.escalate && " · below threshold, escalated"}
                  </summary>
                  <ol className="mt-2 list-decimal pl-5 space-y-1">
                    {output.results.map((r) => (
                      <li key={r.id}>
                        <span className="font-mono">{r.similarity.toFixed(3)}</span>{" "}
                        {r.docTitle} › {r.headingPath}
                      </li>
                    ))}
                  </ol>
                </details>
              );
            })}

            {sources.length > 0 && (
              <ul className="mt-3 text-sm border-t border-zinc-200 dark:border-zinc-800 pt-2">
                {sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} className="underline" target="_blank" rel="noreferrer">
                      {s.docTitle}
                    </a>{" "}
                    <span className="text-zinc-500">· updated {s.updated}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {/* covers the gap before the first text/tool part, e.g. while the server retries a rate limit;
          the assistant message may already exist holding only a "step-start" part */}
      {busy &&
        (messages.at(-1)?.role === "user" ||
          !messages
            .at(-1)
            ?.parts.some((p) => p.type === "text" || p.type.startsWith("tool-"))) && (
          <p className="text-sm text-zinc-500 animate-pulse">Thinking…</p>
        )}

      {error && <p className="text-sm text-red-600">Error: {error.message}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <input
          className="fixed dark:bg-zinc-900 bg-white bottom-0 w-full max-w-2xl p-2 mb-8 border border-zinc-300 dark:border-zinc-800 rounded shadow-xl disabled:opacity-50"
          value={input}
          disabled={busy}
          placeholder={busy ? "Answering…" : "Ask about Meridian Sync..."}
          onChange={(e) => setInput(e.currentTarget.value)}
        />
      </form>
    </div>
  );
}
