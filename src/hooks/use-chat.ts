"use client";

import { useState, useCallback, useRef } from "react";
import type {
  ChatMessage,
  ToolCallInfo,
  StreamEvent,
  ChatRequest,
  AgentMode,
} from "@/lib/types";

const DEBUG = process.env.NODE_ENV === "development";

function log(...args: unknown[]) {
  if (DEBUG) console.log("[use-chat]", ...args);
}

interface UseChatReturn {
  messages: ChatMessage[];
  toolCalls: ToolCallInfo[];
  sessionId: string | null;
  isStreaming: boolean;
  isLoadingHistory: boolean;
  model: string | null;
  selectedModel: string;
  selectedMode: AgentMode;
  error: string | null;
  sendMessage: (prompt: string, workspace?: string) => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  setSessionId: (id: string | null) => void;
  setSelectedModel: (model: string) => void;
  setSelectedMode: (mode: AgentMode) => void;
  clearChat: () => void;
}

function extractAssistantText(message: Record<string, unknown>): string {
  const content = message.content;

  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((c: Record<string, unknown>) => {
        if (typeof c === "string") return c;
        if (c && typeof c.text === "string") return c.text;
        return "";
      })
      .join("");
  }

  log("unexpected content format:", content);
  return String(content ?? "");
}

function extractToolCallInfo(
  toolCall: Record<string, unknown>,
  callId: string,
  status: "running" | "completed"
): Partial<ToolCallInfo> {
  if ("readToolCall" in toolCall) {
    const tc = toolCall.readToolCall as Record<string, unknown>;
    const args = tc.args as Record<string, string>;
    const result = tc.result as Record<string, Record<string, unknown>> | undefined;
    return {
      type: "read",
      name: "Read File",
      path: args.path,
      status,
      result:
        status === "completed" && result?.success
          ? `${result.success.totalLines} lines, ${result.success.totalChars} chars`
          : undefined,
    };
  }

  if ("writeToolCall" in toolCall) {
    const tc = toolCall.writeToolCall as Record<string, unknown>;
    const args = tc.args as Record<string, string>;
    const result = tc.result as Record<string, Record<string, unknown>> | undefined;
    return {
      type: "write",
      name: "Write File",
      path: args.path,
      status,
      result:
        status === "completed" && result?.success
          ? `${result.success.linesCreated} lines created`
          : undefined,
    };
  }

  if ("function" in toolCall) {
    const fn = toolCall.function as Record<string, string>;
    return {
      type: fn.name?.toLowerCase().includes("bash") ? "shell" : "other",
      name: fn.name || "Tool",
      args: fn.arguments,
      status,
    };
  }

  return { type: "other", name: "Tool", status };
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [model, setModel] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("auto");
  const [selectedMode, setSelectedMode] = useState<AgentMode>("agent");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearChat = useCallback(() => {
    setMessages([]);
    setToolCalls([]);
    setSessionId(null);
    setModel(null);
    setError(null);
  }, []);

  const loadSession = useCallback(
    async (id: string) => {
      setIsLoadingHistory(true);
      setError(null);
      setMessages([]);
      setToolCalls([]);
      setSessionId(id);

      try {
        const res = await fetch(`/api/sessions/history?id=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error("Failed to load session");
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load session";
        setError(msg);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (prompt: string, workspace?: string) => {
      if (isStreaming) return;

      setError(null);
      setIsStreaming(true);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const body: ChatRequest = {
        prompt,
        sessionId: sessionId ?? undefined,
        workspace,
        model: selectedModel !== "auto" ? selectedModel : undefined,
        mode: selectedMode !== "agent" ? selectedMode : undefined,
      };

      log("sending:", body);

      abortRef.current = new AbortController();
      let currentAssistantId: string | null = null;
      let eventCount = 0;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortRef.current.signal,
        });

        log("response status:", res.status);

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            log("stream done, total events:", eventCount);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(line);
            } catch {
              log("failed to parse line:", line.slice(0, 200));
              continue;
            }

            eventCount++;
            log(`event #${eventCount}:`, parsed.type, parsed.subtype ?? "");

            if (parsed.type === "error") {
              const errMsg = (parsed.message as string) || "Unknown CLI error";
              log("error event:", errMsg);
              setError(errMsg);
              continue;
            }

            const event = parsed as unknown as StreamEvent;

            try {
              switch (event.type) {
                case "system": {
                  if (event.subtype === "init") {
                    log("init:", { session_id: event.session_id, model: event.model });
                    setSessionId(event.session_id);
                    setModel(event.model);
                  }
                  break;
                }

                case "assistant": {
                  const text = extractAssistantText(
                    event.message as unknown as Record<string, unknown>
                  );

                  if (!text) {
                    log("empty assistant text, skipping");
                    break;
                  }

                  if (!currentAssistantId) {
                    currentAssistantId = crypto.randomUUID();
                    log("new assistant message:", currentAssistantId, "text length:", text.length);
                    const msg: ChatMessage = {
                      id: currentAssistantId,
                      role: "assistant",
                      content: text,
                      timestamp: Date.now(),
                    };
                    setMessages((prev) => [...prev, msg]);
                  } else {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === currentAssistantId
                          ? { ...m, content: m.content + text }
                          : m
                      )
                    );
                  }
                  break;
                }

                case "tool_call": {
                  if (event.subtype === "started") {
                    currentAssistantId = null;
                    const info = extractToolCallInfo(
                      event.tool_call as unknown as Record<string, unknown>,
                      event.call_id,
                      "running"
                    );
                    log("tool started:", info.name, info.path ?? info.args?.slice(0, 80));
                    const tc: ToolCallInfo = {
                      id: crypto.randomUUID(),
                      callId: event.call_id,
                      type: info.type || "other",
                      name: info.name || "Tool",
                      path: info.path,
                      args: info.args,
                      status: "running",
                      timestamp: Date.now(),
                    };
                    setToolCalls((prev) => [...prev, tc]);
                  } else if (event.subtype === "completed") {
                    const info = extractToolCallInfo(
                      event.tool_call as unknown as Record<string, unknown>,
                      event.call_id,
                      "completed"
                    );
                    log("tool completed:", info.name, info.result);
                    setToolCalls((prev) =>
                      prev.map((tc) =>
                        tc.callId === event.call_id
                          ? { ...tc, status: "completed", result: info.result }
                          : tc
                      )
                    );
                  }
                  break;
                }

                case "result": {
                  log("result:", { subtype: event.subtype, duration_ms: event.duration_ms });
                  if (!sessionId && event.session_id) {
                    setSessionId(event.session_id);
                  }
                  break;
                }

                default: {
                  log("unhandled event type:", (parsed as Record<string, unknown>).type);
                  break;
                }
              }
            } catch (eventErr) {
              log("error processing event:", eventErr, "raw:", line.slice(0, 300));
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Unknown error";
        log("fetch error:", message);
        setError(message);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, sessionId, selectedModel, selectedMode]
  );

  return {
    messages,
    toolCalls,
    sessionId,
    isStreaming,
    isLoadingHistory,
    model,
    selectedModel,
    selectedMode,
    error,
    sendMessage,
    loadSession,
    setSessionId,
    setSelectedModel,
    setSelectedMode,
    clearChat,
  };
}
