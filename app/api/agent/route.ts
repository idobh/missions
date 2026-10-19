import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { bad, handle, toId } from "@/lib/http";
import type { AgentScope, ChatMessage } from "@/lib/types";

export const maxDuration = 60;

export function POST(req: Request) {
  return handle(async () => {
    const b = await req.json();
    const history: ChatMessage[] = Array.isArray(b.messages)
      ? b.messages
          .filter((m: ChatMessage) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [];
    if (!history.length || history[history.length - 1].role !== "user") return bad("חסרה הודעה");
    const sid = toId(b.scope?.spaceId);
    const scope: AgentScope = b.scope?.type === "space" && sid ? { type: "space", spaceId: sid } : { type: "all" };
    try {
      return NextResponse.json(await runAgent(history, scope));
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ reply: `אירעה שגיאה בחיבור לסוכן: ${msg.slice(0, 200)}`, changed: false, error: true });
    }
  });
}
