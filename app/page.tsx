"use client";

import { useChat } from "@ai-sdk/react";
import clsx from "clsx";
import { useState } from "react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat();
  const isStreaming = status === "streaming";
  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map((message) => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === "user" ? "User: " : "AI: "}
          {message.parts.map((part, i) => {
            switch (part.type) {
              case "text":
                return (
                  // streamdown is used for stylong markdown texts genrated by the llm
                  // example **Elon musk** to Elon mush in bold.
                  <Streamdown
                    key={`${message.id}-${i}`}
                    animated
                    isAnimating={status === "streaming"}
                  >
                    {part.text}
                  </Streamdown>
                );
              default:
                return null;
            }
          })}
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <input
          className="fixed dark:bg-zinc-900 bottom-0 w-full max-w-md p-2 mb-8 border border-zinc-300 dark:border-zinc-800 rounded shadow-xl"
          value={input}
          placeholder="Say something..."
          onChange={(e) => setInput(e.currentTarget.value)}
        />
      </form>
    </div>
  );
}
