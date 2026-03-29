import { spawn, execFileSync, type ChildProcess } from "child_process";
import type { AgentMode } from "@/lib/types";
import { getConfig } from "@/lib/session-store";
import { getAgentChildOptions, getAgentExecutable } from "@/lib/agent-path";

let agentChecked = false;

function ensureAgentOnPath(): void {
  if (agentChecked) return;
  const exe = getAgentExecutable();
  try {
    execFileSync(exe, ["--version"], {
      stdio: "ignore",
      timeout: 5_000,
      ...getAgentChildOptions(exe),
    });
    agentChecked = true;
  } catch {
    throw new Error(
      "Could not run the 'agent' CLI. Check CURSOR_AGENT_PATH or reinstall Cursor shell commands.",
    );
  }
}

export interface AgentOptions {
  prompt: string;
  sessionId?: string;
  workspace?: string;
  model?: string;
  mode?: AgentMode;
}

async function shouldTrust(): Promise<boolean> {
  if (process.env.CURSOR_TRUST === "0") return false;
  if (process.env.CURSOR_TRUST === "1") return true;
  const val = await getConfig("trust");
  return val !== "0";
}

export async function spawnAgent(options: AgentOptions): Promise<ChildProcess> {
  ensureAgentOnPath();
  const args = ["-p", options.prompt, "--output-format", "stream-json", "--stream-partial-output"];

  if (await shouldTrust()) {
    args.push("--trust");
  }
  if (options.sessionId) {
    args.push("--resume", options.sessionId);
  }
  if (options.workspace) {
    args.push("--workspace", options.workspace);
  }
  if (options.model) {
    args.push("--model", options.model);
  }
  if (options.mode && options.mode !== "agent") {
    args.push("--mode", options.mode);
  }

  const exe = getAgentExecutable();
  return spawn(exe, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
    ...getAgentChildOptions(exe),
  });
}

