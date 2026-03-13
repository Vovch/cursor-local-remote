"use client";

import { useState, useRef, useCallback } from "react";
import type { AgentMode } from "@/lib/types";

const MODELS = [
  { id: "auto", label: "Auto" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { id: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "claude-3.7-sonnet", label: "Claude 3.7 Sonnet" },
  { id: "claude-4-sonnet", label: "Claude 4 Sonnet" },
  { id: "cursor-small", label: "cursor-small" },
] as const;

const MODES: { id: AgentMode; label: string }[] = [
  { id: "agent", label: "Agent" },
  { id: "ask", label: "Ask" },
  { id: "plan", label: "Plan" },
];

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  selectedModel: string;
  selectedMode: AgentMode;
  onModelChange: (model: string) => void;
  onModeChange: (mode: AgentMode) => void;
}

export function ChatInput({
  onSend,
  disabled,
  selectedModel,
  selectedMode,
  onModelChange,
  onModeChange,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  const currentModelLabel =
    MODELS.find((m) => m.id === selectedModel)?.label || selectedModel;

  return (
    <div className="shrink-0 border-t border-border bg-bg px-4 py-3 safe-bottom">
      <div className="max-w-3xl mx-auto">
        <div className="relative bg-bg-surface border border-border rounded-xl focus-within:border-text-muted/40 transition-colors">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask Cursor anything..."
            disabled={disabled}
            rows={1}
            className="w-full resize-none bg-transparent px-3.5 pt-2.5 pb-1 pr-10 text-[13px] text-text placeholder:text-text-muted focus:outline-none disabled:opacity-40"
          />

          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onModeChange(mode.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    selectedMode === mode.id
                      ? "bg-accent/15 text-accent"
                      : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative">
                <button
                  onClick={() => setModelOpen(!modelOpen)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
                >
                  <span>{currentModelLabel}</span>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {modelOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setModelOpen(false)}
                    />
                    <div className="absolute bottom-full right-0 mb-1 z-50 w-48 bg-bg-elevated border border-border rounded-lg shadow-xl py-1 overflow-hidden">
                      {MODELS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            onModelChange(m.id);
                            setModelOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${
                            selectedModel === m.id
                              ? "text-accent bg-accent/10"
                              : "text-text-secondary hover:bg-bg-hover hover:text-text"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleSend}
                disabled={disabled || !value.trim()}
                className="p-1 rounded-md text-text-muted hover:text-text disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
