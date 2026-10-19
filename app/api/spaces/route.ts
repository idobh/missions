import { NextResponse } from "next/server";
import { createSpace, isView, listSpaces } from "@/lib/repo";
import { bad, handle } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => NextResponse.json(await listSpaces()));
}

export function POST(req: Request) {
  return handle(async () => {
    const b = await req.json();
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return bad("חסר שם למרחב");
    const view = isView(b.view) ? b.view : "kanban";
    const color = typeof b.color === "string" && /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : "#6366f1";
    return NextResponse.json(await createSpace({ name, color, view }));
  });
}
