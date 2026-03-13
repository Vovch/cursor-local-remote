"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage, ToolCallInfo } from "@/lib/types";
import { MessageBubble } from "./message-bubble";
import { ToolCallCard } from "./tool-call-card";

interface MessageListProps {
  messages: ChatMessage[];
  toolCalls: ToolCallInfo[];
  isStreaming: boolean;
  isLoadingHistory?: boolean;
}

interface TimelineItem {
  kind: "message" | "toolcall";
  timestamp: number;
  message?: ChatMessage;
  toolCall?: ToolCallInfo;
}

export function MessageList({ messages, toolCalls, isStreaming, isLoadingHistory }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isStreaming]);

  const timeline: TimelineItem[] = [
    ...messages.map(
      (m): TimelineItem => ({ kind: "message", timestamp: m.timestamp, message: m })
    ),
    ...toolCalls.map(
      (tc): TimelineItem => ({
        kind: "toolcall",
        timestamp: tc.timestamp,
        toolCall: tc,
      })
    ),
  ].sort((a, b) => a.timestamp - b.timestamp);

  if (isLoadingHistory) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-text-muted text-[13px]">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-text-muted border-t-transparent animate-spin" />
          Loading session...
        </div>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-10 h-10 rounded-xl bg-bg-surface border border-border flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <p className="text-text-secondary text-[13px] font-medium mb-1">Cursor Remote</p>
          <p className="text-text-muted text-[12px] leading-relaxed">
            Send a message to start an agent session.
            Access from any device on your network.
          </p>
        </div>
      </div>
    );
  }

  const hasRunningToolCalls = toolCalls.some((tc) => tc.status === "running");
  const lastItem = timeline[timeline.length - 1];
  const lastIsUser = lastItem?.kind === "message" && lastItem.message?.role === "user";
  const showThinking = isStreaming && !hasRunningToolCalls && lastIsUser;

  return (
    <div className="flex-1 overflow-y-auto px-4 max-w-3xl mx-auto w-full">
      <div className="divide-y divide-border/50">
        {timeline.map((item) => {
          if (item.kind === "message" && item.message) {
            return <MessageBubble key={item.message.id} message={item.message} />;
          }
          if (item.kind === "toolcall" && item.toolCall) {
            return <ToolCallCard key={item.toolCall.id} toolCall={item.toolCall} />;
          }
          return null;
        })}
      </div>
      {showThinking && (
        <div className="py-3 pl-9 flex items-center gap-2 text-text-muted text-[12px]">
          <span className="w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          Thinking...
        </div>
      )}
      <div ref={endRef} className="h-4" />
    </div>
  );
}
