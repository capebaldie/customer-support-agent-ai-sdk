"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import type { search } from "@/lib/rag/search";

// Lifted from eval/questions.ts: one each from billing, errors, setup and policy, and
// eval/baseline.json already says all four retrieve. Sentence case and a question mark here only —
// eval/questions.ts keeps the raw lower-case phrasing, because rewording those would invalidate the
// captures in eval/search-queries.json. The blurb says what the answer will cover without asserting
// what it says; the tint is decorative, so it is inline style rather than a class Tailwind would
// have to find in the source to generate.
const STARTERS = [
  {
    question: "Is there a free trial?",
    blurb: "Trial length, what is included, and what happens when it ends.",
    accent: "#2b59e8",
    icon: (
      <>
        <path d="M5 2.5h5L13.5 6v9.5a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" />
        <path d="M10 2.5V6h3.5" />
      </>
    ),
  },
  {
    question: "Why did my sync fail with 401?",
    blurb: "What the code means, and which side of the sync to fix.",
    accent: "#0f9d63",
    icon: (
      <>
        <path d="M7.4 10.6a3 3 0 0 0 4.3 0l2-2a3 3 0 0 0-4.2-4.3l-1 1" />
        <path d="M10.6 7.4a3 3 0 0 0-4.3 0l-2 2a3 3 0 0 0 4.2 4.3l1-1" />
      </>
    ),
  },
  {
    question: "How do I set up Okta SAML?",
    blurb: "Configuring single sign-on for your workspace, step by step.",
    accent: "#7c4dff",
    icon: (
      <>
        <rect x="3.4" y="7.6" width="11.2" height="8.4" rx="2" />
        <path d="M6 7.6V5.4a3 3 0 0 1 6 0v2.2" />
        <path d="M9 10.8v2" />
      </>
    ),
  },
  {
    question: "Can I get a refund?",
    blurb: "The refund policy, who qualifies, and how to ask for one.",
    accent: "#ef7c1b",
    icon: (
      <>
        <path d="M4.2 2.6h9.6v13.3l-1.9-1.2-1.9 1.2-1.9-1.2-1.9 1.2-1.9-1.2V2.6Z" />
        <path d="M6.8 6.4h4.4M6.8 9.4h2.8" />
      </>
    ),
  },
];

// mirrors the searchKnowledgeBase execute() return in app/api/chat/route.ts
type SearchOutput = {
  escalate: boolean;
  topSimilarity: number;
  results: Awaited<ReturnType<typeof search>>;
};

function searchOutputs(message: UIMessage) {
  return message.parts.flatMap((part) =>
    part.type === "tool-searchKnowledgeBase" &&
    part.state === "output-available"
      ? [part.output as SearchOutput]
      : [],
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 28 22" aria-hidden className="h-6 w-7 text-signal">
      <path
        fill="currentColor"
        d="M1.4 21V4.3a2.4 2.4 0 0 1 4.3-1.5L14 13.2 22.3 2.8A2.4 2.4 0 0 1 26.6 4.3V21h-4.9v-9.4l-5.8 7.3a2.4 2.4 0 0 1-3.8 0L6.3 11.6V21H1.4Z"
      />
    </svg>
  );
}

// One path, flipped vertically for the down vote — which is how the thumb is drawn either way.
function Thumb({ down = false }: { down?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={`h-4 w-4 ${down ? "-scale-y-100" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    >
      <path d="M5.2 14V6.4l3.1-4.1a1 1 0 0 1 1.8.6v3h3a1.3 1.3 0 0 1 1.3 1.6l-1.1 4.9a1.6 1.6 0 0 1-1.6 1.6H5.2Z" />
      <path d="M5.2 6.4H2.8a1 1 0 0 0-1 1v5.6a1 1 0 0 0 1 1h2.4" />
    </svg>
  );
}

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, stop } = useChat();
  // "error" stays enabled so the user can retry; otherwise the form would lock after one failure
  const busy = status === "submitted" || status === "streaming";
  const [feedback, setFeedback] = useState<Record<string, "up" | "down">>({});
  const endRef = useRef<HTMLDivElement>(null);
  // the message whose comment box is open, or null. The <dialog> itself is rendered once.
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const empty = messages.length === 0;

  // `messages` is replaced on every streamed chunk, so this follows the answer as it grows.
  // The guard is what stops it hijacking the page when someone has scrolled up to re-read
  // something earlier: by the time the effect runs the DOM has already grown, but only by the
  // size of one chunk, so a reader still pinned to the bottom stays well inside the margin.
  useEffect(() => {
    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.scrollHeight - 200;
    if (nearBottom) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // showModal() is what brings the focus trap, Esc and the inert background; setting the `open`
  // attribute in JSX would render the same element with none of that.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (commentFor) dialog.showModal();
    else dialog.close();
  }, [commentFor]);

  function sendFeedback(
    messageId: string,
    value: "up" | "down",
    comment?: string,
  ) {
    setFeedback((f) => ({ ...f, [messageId]: value }));
    // fire-and-forget: a lost vote is not worth an error in the chat.
    // JSON.stringify drops an undefined comment, so the vote-only call is unchanged.
    fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId, feedback: value, comment }),
    }).catch(() => {});
  }

  function vote(messageId: string, value: "up" | "down") {
    sendFeedback(messageId, value);
    // the down vote is recorded either way; the box asks for detail a click cannot carry,
    // and closing it without typing costs nothing
    if (value === "down") setCommentFor(messageId);
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Decoration only. The dot fields are a CSS gradient rather than an asset, and the band at
          the bottom is what the composer sits on. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 bottom-0 h-[55vh] bg-gradient-to-t from-wash via-wash/60 to-transparent" />
        <div
          className="absolute top-[34%] left-4 hidden h-28 w-28 opacity-70 lg:block"
          style={{
            backgroundImage:
              "radial-gradient(var(--rule) 1.6px, transparent 1.6px)",
            backgroundSize: "15px 15px",
          }}
        />
        <div
          className="absolute top-[42%] right-4 hidden h-28 w-28 opacity-70 lg:block"
          style={{
            backgroundImage:
              "radial-gradient(var(--rule) 1.6px, transparent 1.6px)",
            backgroundSize: "15px 15px",
          }}
        />
      </div>

      <header className="sticky top-0 z-20 border-b border-rule bg-paper">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-5">
          <Mark />
          <span className="text-[1.0625rem] font-bold tracking-tight">
            Meridian Sync
          </span>
          <span aria-hidden className="h-5 w-px bg-rule" />
          <span className="text-[0.9375rem] text-depth">Support</span>

          {/* tied to the last request rather than hardcoded: a green dot that cannot go out is
              decoration, and this one is the only status the page actually knows */}
          <span
            className="ml-auto flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              color: error ? "var(--depth)" : "var(--positive)",
              background: error
                ? "var(--vellum)"
                : "color-mix(in srgb, var(--positive) 12%, transparent)",
            }}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: error ? "var(--depth)" : "var(--positive)" }}
            />
            {error ? "Unavailable" : "Online"}
          </span>
        </div>
      </header>

      <main
        className={`mx-auto flex w-full flex-1 flex-col gap-12 px-5 pt-10 pb-8 ${
          // the 2x2 grid wraps its longest title below this; the transcript instead shares the
          // composer's width, so question, answer, sources and input all sit on one left edge
          empty ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        {empty && (
          <div className="flex flex-col items-center text-center">
            <svg viewBox="0 0 142 86" aria-hidden className="h-[5.5rem] w-auto">
              <g
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                className="text-signal opacity-40"
              >
                <path d="M16 24 6 19" />
                <path d="M22 13 17 4" />
                <path d="M35 7 34 0" />
                <path d="M122 22 132 18" />
                <path d="M116 12 121 4" />
              </g>
              <g className="fill-signal opacity-25">
                <rect x="76" y="28" width="54" height="38" rx="14" />
                <path d="M96 64 90 78l16-12Z" />
              </g>
              <g className="fill-paper">
                <circle cx="91" cy="47" r="2.8" />
                <circle cx="103" cy="47" r="2.8" />
                <circle cx="115" cy="47" r="2.8" />
              </g>
              <g className="fill-signal">
                <rect x="22" y="8" width="68" height="47" rx="16" />
                <path d="M40 53 32 70l18-13Z" />
              </g>
              <g className="fill-paper">
                <circle cx="41" cy="31" r="3.6" />
                <circle cx="56" cy="31" r="3.6" />
                <circle cx="71" cy="31" r="3.6" />
              </g>
            </svg>

            <h1 className="mt-6 max-w-[30ch] text-balance text-[1.875rem] leading-[1.2] font-bold tracking-[-0.02em] sm:text-[2.25rem]">
              What can we help you with?
            </h1>
            <p className="mt-4 max-w-[60ch] text-[0.9375rem] leading-relaxed text-depth">
              Answers are written only from the Meridian Sync documentation.
              Every one lists the sections it used and the date each was last
              changed.
            </p>

            <ul className="mt-10 grid w-full gap-4 text-left sm:grid-cols-2">
              {STARTERS.map(({ question, blurb, accent, icon }) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => sendMessage({ text: question })}
                    className="group flex h-full w-full items-start gap-4 rounded-2xl border border-rule bg-vellum p-5 text-left hover:border-signal/40 hover:bg-paper"
                  >
                    <span
                      aria-hidden
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
                      style={{
                        color: accent,
                        background:
                          "color-mix(in srgb, currentColor 13%, transparent)",
                      }}
                    >
                      <svg
                        viewBox="0 0 18 18"
                        className="h-[18px] w-[18px]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {icon}
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{question}</span>
                      <span className="mt-1 block text-sm leading-snug text-depth">
                        {blurb}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="shrink-0 self-center text-depth group-hover:text-signal"
                    >
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

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

          // dedupe by url: several chunks from one doc, or repeat searches, share a source link
          const sources = [
            ...new Map(
              searchOutputs(message)
                .flatMap((o) => o.results)
                .map((r) => [r.url, r]),
            ).values(),
          ];

          return (
            <div key={message.id} className="-mt-6">
              <h3 className="sr-only">Answer</h3>

              {message.parts.map((part, i) => {
                const key = `${message.id}-${i}`;

                if (part.type === "text") {
                  return (
                    <div key={key} className="answer">
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
                    <p key={key} className="my-3 text-sm text-signal">
                      Search failed for “{query}”. {part.errorText}
                    </p>
                  );
                }

                if (part.state !== "output-available") {
                  return (
                    <p key={key} className="my-3 text-sm text-depth">
                      Searching the docs for “{query ?? "…"}”
                    </p>
                  );
                }

                const output = part.output as SearchOutput;
                return (
                  // kept deliberately: tasks.md Task 7 built this to tell "retrieval returned the
                  // wrong sections" apart from "the model ignored the right ones". Quiet, but the
                  // scores are machine output, so they are set in the machine face.
                  <details key={key} className="group my-3 text-sm">
                    <summary className="flex items-baseline gap-2 text-depth">
                      <span
                        aria-hidden
                        className="shrink-0 transition-transform group-open:rotate-90"
                      >
                        ›
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        Searched “{query}”
                      </span>
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
              })}

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
              {searchOutputs(message).length > 0 &&
                !(busy && message.id === messages.at(-1)?.id) && (
                  <div className="mt-4 flex items-center gap-3 text-sm">
                    {feedback[message.id] ? (
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
                            aria-label={
                              value === "up" ? "Helpful" : "Not helpful"
                            }
                            onClick={() => vote(message.id, value)}
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

        {error && (
          <p className="rounded-xl border border-rule bg-vellum px-4 py-3 text-sm">
            {error.message}
          </p>
        )}

        <div ref={endRef} />
      </main>

      <div className="sticky bottom-0 z-20 bg-gradient-to-t from-wash from-55% to-transparent pt-8 pb-4">
        {/* the same padded max-w-2xl box <main> uses: box-sizing puts px-5 inside the max-width, so
            a max-w-2xl form next to a max-w-2xl main would still sit 20px to its left */}
        <div className="mx-auto w-full max-w-2xl px-5">
          <form
            className="flex items-center gap-2 rounded-full border border-rule bg-paper py-2 pr-2 pl-4 shadow-[0_10px_34px_-12px_rgb(27_42_86_/_0.28)] focus-within:border-signal"
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim()) return;
              sendMessage({ text: input });
              setInput("");
            }}
          >
            <svg
              viewBox="0 0 18 18"
              aria-hidden
              className="h-[18px] w-[18px] shrink-0 text-signal"
              fill="currentColor"
            >
              <path d="M9 1.5 10.6 6 15 7.6 10.6 9.2 9 13.7 7.4 9.2 3 7.6 7.4 6 9 1.5Z" />
              <path d="M14.4 11.6l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" />
            </svg>
            <input
              className="min-w-0 flex-1 bg-transparent py-1.5 outline-none placeholder:text-depth disabled:opacity-60"
              value={input}
              disabled={busy}
              placeholder={busy ? "Answering…" : "Ask about Meridian Sync…"}
              onChange={(e) => setInput(e.currentTarget.value)}
            />
            {busy ? (
              <button
                type="button"
                onClick={stop}
                className="shrink-0 rounded-full border border-edge px-4 py-2 text-sm font-semibold hover:bg-vellum"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="shrink-0 rounded-full bg-signal px-5 py-2 text-sm font-semibold text-on-signal disabled:bg-rule disabled:text-depth"
              >
                Ask
              </button>
            )}
          </form>

          {/* accurate, not reassuring: every question is written to the retrievals table with the
            sections it matched. Claiming more privacy than that would be untrue. */}
          <p className="mt-3 text-center text-xs text-depth">
            Questions are logged with the sections they matched, and used only
            to improve these answers.
          </p>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        // fires on Esc as well as on the buttons below
        onClose={() => setCommentFor(null)}
        className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-rule p-6"
        aria-labelledby="comment-title"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const comment = String(
              new FormData(event.currentTarget).get("comment") ?? "",
            ).trim();
            // the down vote is already stored; an empty box just closes
            if (comment && commentFor)
              sendFeedback(commentFor, "down", comment);
            setCommentFor(null);
          }}
        >
          <h2 id="comment-title" className="text-base font-bold">
            What was wrong with this answer?
          </h2>
          <p className="mt-1 text-sm text-depth">
            Your vote is recorded. This is optional, and it is what tells us
            whether retrieval missed the section or the answer ignored it.
          </p>
          <textarea
            name="comment"
            rows={4}
            maxLength={500}
            autoFocus
            aria-label="What was wrong with this answer?"
            className="mt-4 w-full resize-none rounded-xl border border-edge bg-paper px-3 py-2 text-sm outline-none placeholder:text-depth focus:border-signal"
            placeholder="It missed the part about…"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCommentFor(null)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-depth hover:bg-vellum"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-signal px-5 py-2 text-sm font-semibold text-on-signal"
            >
              Send
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
