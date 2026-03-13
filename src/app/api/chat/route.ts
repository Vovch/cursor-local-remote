import { spawnAgent, createStreamFromProcess } from "@/lib/cursor-cli";
import { getWorkspace } from "@/lib/workspace";
import { upsertSession } from "@/lib/session-store";
import type { ChatRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEBUG = process.env.NODE_ENV === "development";

function log(...args: unknown[]) {
  if (DEBUG) console.log("[api/chat]", ...args);
}

function createTappedStream(
  source: ReadableStream<Uint8Array>,
  workspace: string,
  prompt: string
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let captured = false;
  let chunkCount = 0;

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        log("tapped stream done");
        controller.close();
        return;
      }

      chunkCount++;
      if (DEBUG && value) {
        const text = new TextDecoder().decode(value);
        log(`tap chunk #${chunkCount}:`, text.slice(0, 200));
      }

      if (!captured && value) {
        const text = new TextDecoder().decode(value);
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "system" && event.subtype === "init" && event.session_id) {
              log("captured session_id:", event.session_id);
              upsertSession(event.session_id, workspace, prompt);
              captured = true;
            }
          } catch {
            log("non-json line in tap:", line.slice(0, 100));
          }
        }
      }

      controller.enqueue(value);
    },
    cancel() {
      reader.cancel();
    },
  });
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const workspace = body.workspace || getWorkspace();

  log("request:", {
    prompt: body.prompt.slice(0, 100),
    sessionId: body.sessionId,
    workspace,
    model: body.model,
    mode: body.mode,
  });

  try {
    const child = spawnAgent({
      prompt: body.prompt,
      sessionId: body.sessionId,
      workspace,
      model: body.model,
      mode: body.mode,
    });

    const rawStream = createStreamFromProcess(child);
    const stream = createTappedStream(rawStream, workspace, body.prompt);

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start agent";
    log("error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
