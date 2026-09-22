import { useState } from "react";

export function Composer({
  busy,
  onSend,
  onStop,
}: {
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [input, setInput] = useState("");

  return (
    <div className="sticky bottom-0 z-20 bg-gradient-to-t from-wash from-55% to-transparent pt-8 pb-4">
      {/* the same padded max-w-2xl box <main> uses: box-sizing puts px-5 inside the max-width, so
          a max-w-2xl form next to a max-w-2xl main would still sit 20px to its left */}
      <div className="mx-auto w-full max-w-2xl px-5">
        <form
          className="flex items-center gap-2 rounded-full border border-rule bg-paper py-2 pr-2 pl-4 shadow-[0_10px_34px_-12px_rgb(27_42_86_/_0.28)] focus-within:border-signal"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            onSend(input);
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
              onClick={onStop}
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
  );
}
