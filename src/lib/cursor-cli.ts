import { spawn, type ChildProcess } from "child_process";
import type { AgentMode } from "@/lib/types";

const DEBUG = process.env.NODE_ENV === "development";

function log(...args: unknown[]) {
  if (DEBUG) console.log("[cursor-cli]", ...args);
}

export interface AgentOptions {
  prompt: string;
  sessionId?: string;
  workspace?: string;
  model?: string;
  mode?: AgentMode;
  force?: boolean;
}

export function spawnAgent(options: AgentOptions): ChildProcess {
  const args = [
    "-p",
    options.prompt,
    "--output-format",
    "stream-json",
    "--stream-partial-output",
    "--trust",
  ];

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
  if (options.force !== false) {
    args.push("--force");
  }

  log("spawning:", "agent", args.join(" "));

  const child = spawn("agent", args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  log("pid:", child.pid);

  child.on("error", (err) => {
    log("spawn error:", err.message);
  });

  child.on("close", (code, signal) => {
    log("process closed, code:", code, "signal:", signal);
  });

  return child;
}

export function createStreamFromProcess(child: ChildProcess): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      let buffer = "";
      let chunkCount = 0;

      child.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        chunkCount++;
        log(`stdout chunk #${chunkCount} (${text.length} bytes):`, text.slice(0, 200));

        buffer += text;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            controller.enqueue(encoder.encode(line + "\n"));
          }
        }
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        log("stderr:", text.slice(0, 500));
        const errorEvent = JSON.stringify({
          type: "error",
          message: text,
        });
        controller.enqueue(encoder.encode(errorEvent + "\n"));
      });

      child.on("close", (code) => {
        log("stream closing, exit code:", code, "remaining buffer:", buffer.length, "bytes");
        if (buffer.trim()) {
          controller.enqueue(encoder.encode(buffer + "\n"));
        }
        controller.close();
      });

      child.on("error", (err) => {
        log("stream error:", err.message);
        const errorEvent = JSON.stringify({
          type: "error",
          message: err.message,
        });
        controller.enqueue(encoder.encode(errorEvent + "\n"));
        controller.close();
      });
    },

    cancel() {
      log("stream cancelled, killing process");
      child.kill("SIGTERM");
    },
  });
}
