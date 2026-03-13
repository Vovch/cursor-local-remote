export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerShutdownHandler } = await import("@/lib/shutdown");
    registerShutdownHandler();

    const { setProcessExitHook } = await import("@/lib/process-registry");
    const { notifyAllSubscribers } = await import("@/lib/push");
    const { getDb } = await import("@/lib/session-store");

    setProcessExitHook((sessionId, _workspace) => {
      let title = "Agent finished";
      let body = "Response complete";

      try {
        const conn = getDb();
        const row = conn
          .prepare("SELECT title, preview FROM sessions WHERE id = ?")
          .get(sessionId) as { title: string; preview: string } | undefined;
        if (row) {
          title = "Agent finished";
          body = row.preview || row.title;
        }
      } catch {
        // db read failed, use defaults
      }

      void notifyAllSubscribers(title, body);
    });
  }
}
