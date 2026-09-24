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

export function WelcomeScreen({
  onSelect,
}: {
  onSelect: (question: string) => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="max-w-[30ch] text-balance text-[1.875rem] leading-[1.2] font-bold tracking-[-0.02em] sm:text-[2.25rem]">
        What can we help you with?
      </h1>
      <p className="mt-4 max-w-[60ch] text-[0.9375rem] leading-relaxed text-depth">
        Answers are written only from the Meridian Sync documentation. Every
        one lists the sections it used and the date each was last changed.
      </p>

      <ul className="mt-14 grid w-full gap-4 text-left sm:grid-cols-2">
        {STARTERS.map(({ question, blurb, accent, icon }) => (
          <li key={question}>
            <button
              type="button"
              onClick={() => onSelect(question)}
              className="group flex h-full w-full items-start gap-4 rounded-2xl border border-rule p-5 text-left transition-all duration-200 hover:border-edge hover:shadow-sm hover:-translate-y-0.5"
            >
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors duration-200"
                style={{
                  color: accent,
                  background:
                    "color-mix(in srgb, currentColor 10%, transparent)",
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
                className="shrink-0 self-center text-depth transition-all duration-200 group-hover:text-ink group-hover:translate-x-0.5"
              >
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
