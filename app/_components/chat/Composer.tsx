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
    <div className="sticky bottom-0 z-20 border-t border-rule bg-paper pt-4 pb-4">
      {/* the same padded max-w-2xl box <main> uses: box-sizing puts px-5 inside the max-width, so
          a max-w-2xl form next to a max-w-2xl main would still sit 20px to its left */}
      <div className="mx-auto w-full max-w-2xl px-5">
        <form
          className="flex items-center gap-2 rounded-2xl border border-rule bg-vellum py-2 pr-2 pl-4 shadow-sm focus-within:border-signal transition-colors"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            onSend(input);
            setInput("");
          }}
        >
          <input
            className="min-w-0 flex-1 bg-transparent py-1.5 outline-none focus-visible:outline-none placeholder:text-depth disabled:opacity-60"
            value={input}
            disabled={busy}
            placeholder={busy ? "Answering…" : "Ask about Meridian Sync…"}
            onChange={(e) => setInput(e.currentTarget.value)}
          />
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              className="shrink-0 rounded-full border border-edge px-4 py-2 text-sm font-semibold hover:bg-vellum transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="shrink-0 rounded-full bg-signal px-5 py-2 text-sm font-semibold text-on-signal disabled:bg-rule disabled:text-depth transition-colors"
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
