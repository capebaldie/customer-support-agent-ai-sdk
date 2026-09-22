import { Mark } from "./icons";

export function ChatHeader({ error }: { error: Error | undefined }) {
  return (
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
  );
}
