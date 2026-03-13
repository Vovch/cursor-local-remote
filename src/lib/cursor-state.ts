import { execFileSync } from "child_process";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir, platform } from "os";
import type { AgentMode } from "@/lib/types";

function getWorkspaceStorageDir(): string | null {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "Cursor", "User", "workspaceStorage");
    case "linux":
      return join(home, ".config", "Cursor", "User", "workspaceStorage");
    default:
      return null;
  }
}

function findStateDb(workspace: string): string | null {
  const storageDir = getWorkspaceStorageDir();
  if (!storageDir || !existsSync(storageDir)) return null;

  const folderUri = `file://${workspace}`;

  for (const entry of readdirSync(storageDir)) {
    const wsFile = join(storageDir, entry, "workspace.json");
    if (!existsSync(wsFile)) continue;

    try {
      const data = JSON.parse(readFileSync(wsFile, "utf-8"));
      if (data.folder === folderUri) {
        const db = join(storageDir, entry, "state.vscdb");
        return existsSync(db) ? db : null;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function sqliteQuery(dbPath: string, sql: string): string {
  return execFileSync("sqlite3", [dbPath, sql], {
    encoding: "utf-8",
    timeout: 5000,
  });
}

function sqliteExec(dbPath: string, sql: string): void {
  execFileSync("sqlite3", [dbPath], {
    encoding: "utf-8",
    timeout: 5000,
    input: sql,
  });
}

function modeToUnifiedMode(mode?: AgentMode): string {
  switch (mode) {
    case "plan": return "plan";
    case "ask": return "chat";
    default: return "agent";
  }
}

export function registerInCursorState(
  sessionId: string,
  workspace: string,
  prompt: string,
  mode?: AgentMode
): boolean {
  try {
    const dbPath = findStateDb(workspace);
    if (!dbPath) {
      console.error("[clr] cursor-state: could not find state.vscdb for workspace", workspace);
      return false;
    }

    const raw = sqliteQuery(
      dbPath,
      "SELECT value FROM ItemTable WHERE key = 'composer.composerData';"
    ).trim();

    if (!raw) {
      console.error("[clr] cursor-state: composerData key is empty");
      return false;
    }

    const data = JSON.parse(raw);
    if (!data.allComposers || !Array.isArray(data.allComposers)) {
      console.error("[clr] cursor-state: allComposers not found or not an array");
      return false;
    }

    if (data.allComposers.some((c: { composerId: string }) => c.composerId === sessionId)) {
      return true;
    }

    const now = Date.now();
    const entry = {
      type: "head",
      composerId: sessionId,
      name: prompt.slice(0, 60) || "Remote session",
      createdAt: now,
      lastUpdatedAt: now,
      unifiedMode: modeToUnifiedMode(mode),
      forceMode: "edit",
      hasUnreadMessages: false,
      isArchived: false,
      isDraft: false,
      isWorktree: false,
      worktreeStartedReadOnly: false,
      isSpec: false,
      isProject: false,
      isBestOfNSubcomposer: false,
      numSubComposers: 0,
      referencedPlans: [],
      branches: [],
    };

    data.allComposers.unshift(entry);

    const jsonStr = JSON.stringify(data);
    const sqlSafe = jsonStr.replace(/'/g, "''");
    sqliteExec(
      dbPath,
      `UPDATE ItemTable SET value = '${sqlSafe}' WHERE key = 'composer.composerData';`
    );

    const verify = sqliteQuery(
      dbPath,
      "SELECT value FROM ItemTable WHERE key = 'composer.composerData';"
    ).trim();
    const verifyData = JSON.parse(verify);
    const found = verifyData.allComposers?.some(
      (c: { composerId: string }) => c.composerId === sessionId
    );

    if (!found) {
      console.error("[clr] cursor-state: write verification failed — session not found after write");
      return false;
    }

    return true;
  } catch (err) {
    console.error("[clr] cursor-state: failed to register session —", err instanceof Error ? err.message : err);
    return false;
  }
}
