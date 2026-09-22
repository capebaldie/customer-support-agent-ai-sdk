export function Mark() {
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
export function Thumb({ down = false }: { down?: boolean }) {
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
