import { readSessionMessages } from "@/lib/transcript-reader";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("id");

  if (!sessionId) {
    return Response.json({ error: "id query param required" }, { status: 400 });
  }

  const workspace = getWorkspace();
  const messages = readSessionMessages(workspace, sessionId);

  return Response.json({ messages, sessionId });
}
