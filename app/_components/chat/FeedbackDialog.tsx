import { useEffect, useRef } from "react";

export function FeedbackDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // showModal() is what brings the focus trap, Esc and the inert background; setting the `open`
  // attribute in JSX would render the same element with none of that.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      // fires on Esc as well as on the buttons below
      onClose={onClose}
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
          if (comment) onSubmit(comment);
          onClose();
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
            onClick={onClose}
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
  );
}
