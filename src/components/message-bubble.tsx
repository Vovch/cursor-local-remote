"use client";

import type { ChatMessage } from "@/lib/types";
import { Markdown } from "./markdown";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`py-3 ${isUser ? "pl-8" : ""}`}>
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-semibold mt-0.5 ${
            isUser
              ? "bg-bg-surface text-text-secondary"
              : "bg-accent/10 text-accent"
          }`}
        >
          {isUser ? "U" : "C"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-text-muted mb-1">
            {isUser ? "You" : "Cursor"}
          </p>
          {isUser ? (
            <div className="text-[13px] leading-[1.6] text-text whitespace-pre-wrap break-words">
              {message.content}
            </div>
          ) : (
            <Markdown content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}
