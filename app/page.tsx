"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import "streamdown/styles.css";
import { ChatHeader } from "./_components/chat/ChatHeader";
import { Composer } from "./_components/chat/Composer";
import { FeedbackDialog } from "./_components/chat/FeedbackDialog";
import { MessageThread } from "./_components/chat/MessageThread";
import { WelcomeScreen } from "./_components/chat/WelcomeScreen";

export default function Chat() {
  const { messages, sendMessage, status, error, stop } = useChat();
  // "error" stays enabled so the user can retry; otherwise the form would lock after one failure
  const busy = status === "submitted" || status === "streaming";
  const [feedback, setFeedback] = useState<Record<string, "up" | "down">>({});
  const endRef = useRef<HTMLDivElement>(null);
  // the message whose comment box is open, or null. The <dialog> itself is rendered once.
  const [commentFor, setCommentFor] = useState<string | null>(null);
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

      <ChatHeader error={error} />

      <main
        className={`mx-auto flex w-full flex-1 flex-col gap-12 px-5 pt-10 pb-8 ${
          // the 2x2 grid wraps its longest title below this; the transcript instead shares the
          // composer's width, so question, answer, sources and input all sit on one left edge
          empty ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        {empty && (
          <WelcomeScreen
            onSelect={(question) => sendMessage({ text: question })}
          />
        )}

        <MessageThread
          messages={messages}
          busy={busy}
          feedback={feedback}
          onVote={vote}
        />

        {error && (
          <p className="rounded-xl border border-rule bg-vellum px-4 py-3 text-sm">
            {error.message}
          </p>
        )}

        <div ref={endRef} />
      </main>

      <Composer
        busy={busy}
        onSend={(text) => sendMessage({ text })}
        onStop={stop}
      />

      <FeedbackDialog
        open={commentFor !== null}
        onClose={() => setCommentFor(null)}
        onSubmit={(comment) => {
          if (commentFor) sendFeedback(commentFor, "down", comment);
        }}
      />
    </div>
  );
}
