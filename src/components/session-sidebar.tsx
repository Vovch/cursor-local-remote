"use client";

import { useEffect, useState, useCallback } from "react";
import type { StoredSession } from "@/lib/types";

interface SessionSidebarProps {
  open: boolean;
  onClose: () => void;
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function SessionSidebar({
  open,
  onClose,
  currentSessionId,
  onSelectSession,
  onNewSession,
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fetchSessions = useCallback(() => {
    setLoading(true);
    const params = showAll ? "?all=true" : "";
    fetch("/api/sessions" + params)
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [showAll]);

  useEffect(() => {
    if (open) fetchSessions();
  }, [open, fetchSessions]);

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    fetch("/api/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).then(() => fetchSessions());
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      )}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-[280px] bg-bg-elevated border-r border-border transform transition-transform duration-150 flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-11 px-3 border-b border-border shrink-0">
          <span className="text-[13px] font-medium text-text-secondary">Sessions</span>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-2 pt-2 pb-1 space-y-1 shrink-0">
          <button
            onClick={() => { onNewSession(); onClose(); }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New session
          </button>
          <button
            onClick={() => setShowAll((v) => !v)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
              showAll ? "text-accent bg-accent-dim" : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {showAll ? "All workspaces" : "All workspaces"}
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-2 pb-2">
          {loading ? (
            <div className="flex items-center gap-2 justify-center py-8 text-text-muted text-[12px]">
              <span className="w-3 h-3 rounded-full border-2 border-text-muted border-t-transparent animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-text-muted text-[12px] text-center py-8">No sessions</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => { onSelectSession(s.id); onClose(); }}
                className={`group w-full text-left px-2.5 py-2 rounded-md mb-px transition-colors relative ${
                  s.id === currentSessionId
                    ? "bg-bg-active text-text"
                    : "hover:bg-bg-hover text-text-secondary"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] truncate flex-1">{s.title}</p>
                  <span className="text-[10px] text-text-muted shrink-0">
                    {timeAgo(s.updatedAt)}
                  </span>
                </div>
                {showAll && (
                  <p className="text-[10px] text-text-muted mt-0.5 font-mono truncate">
                    {s.workspace.split("/").pop()}
                  </p>
                )}
                <button
                  onClick={(e) => handleDelete(e, s.id)}
                  className="absolute top-1.5 right-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-surface text-text-muted hover:text-error transition-all"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
