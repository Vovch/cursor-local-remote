import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execFileSync } from "child_process";

let cached: string | null | undefined;

function tryResolve(): string | null {
  const fromEnv = process.env.CURSOR_AGENT_PATH?.trim() || process.env.AGENT_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  try {
    if (process.platform === "win32") {
      const out = execFileSync("where.exe", ["agent"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 5_000,
      });
      const line = out
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find((s) => s.length > 0);
      if (line && existsSync(line)) return line;
    } else {
      const out = execFileSync("which", ["agent"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 5_000,
      });
      const line = out.trim().split("\n")[0]?.trim();
      if (line && existsSync(line)) return line;
    }
  } catch {
    // not on PATH or lookup failed
  }

  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    const binDirs = [
      join(local, "Programs", "cursor", "resources", "app", "bin"),
      join(local, "Programs", "Cursor", "resources", "app", "bin"),
    ];
    for (const dir of binDirs) {
      for (const name of ["agent.exe", "agent.cmd", "agent"]) {
        const p = join(dir, name);
        if (existsSync(p)) return p;
      }
    }
  }

  if (process.platform === "darwin") {
    const candidates = [
      join("/Applications", "Cursor.app", "Contents", "Resources", "app", "bin", "agent"),
      join(homedir(), ".local", "bin", "agent"),
      "/usr/local/bin/agent",
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  }

  return null;
}

/** Resolved path to the Cursor `agent` binary, or null. Result is cached for the process lifetime. */
export function getAgentExecutableOrNull(): string | null {
  if (cached === undefined) cached = tryResolve();
  return cached;
}

/** Same as getAgentExecutableOrNull but throws with setup instructions. */
export function getAgentExecutable(): string {
  const p = getAgentExecutableOrNull();
  if (!p) {
    throw new Error(
      "Could not find the Cursor 'agent' CLI. In Cursor: Command Palette → \"Shell Command: Install 'cursor' command in PATH\", or set CURSOR_AGENT_PATH to the full path of agent (on Windows often …\\\\Programs\\\\cursor\\\\resources\\\\app\\\\bin\\\\agent.cmd).",
    );
  }
  return p;
}

/** Windows .cmd/.bat shims require shell mode for Node child_process. */
export function getAgentChildOptions(executable: string): { shell?: boolean } {
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(executable)) {
    return { shell: true };
  }
  return {};
}
