"use client";

import { useState } from "react";
import type { ToolCallInfo } from "@/lib/types";

interface ToolCallCardProps {
  toolCall: ToolCallInfo;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = toolCall.status === "running";

  const fileName = toolCall.path?.split("/").pop() || toolCall.name;

  return (
    <div className="py-1 pl-9">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-secondary transition-colors"
      >
        {isRunning ? (
          <span className="w-3 h-3 rounded-full border-2 border-warning border-t-transparent animate-spin" />
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span className="font-mono">{fileName}</span>
        {toolCall.result && (
          <span className="text-text-muted">{toolCall.result}</span>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-1 ml-4.5 pl-3 border-l border-border text-[11px] font-mono text-text-muted py-1 space-y-0.5">
          {toolCall.path && <p>{toolCall.path}</p>}
          {toolCall.args && <p className="break-all">{toolCall.args}</p>}
          {isRunning && <p className="text-warning">running...</p>}
        </div>
      )}
    </div>
  );
}
