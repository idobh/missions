import { NextResponse } from "next/server";
import { deleteSpace, isView, updateSpace } from "@/lib/repo";
import { bad, handle, toId } from "@/lib/http";

export function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = toId((await ctx.params).id);
    if (!id) return bad("מזהה לא תקין");
    const b = await req.json();
    const patch: Record<string, string> = {};
    if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim();
    if (typeof b.color === "string" && /^#[0-9a-f]{6}$/i.test(b.color)) patch.color = b.color;
    if (isView(b.view)) patch.view = b.view;
    const space = await updateSpace(id, patch);
    return space ? NextResponse.json(space) : bad("המרחב לא נמצא", 404);
  });
}

export function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = toId((await ctx.params).id);
    if (!id) return bad("מזהה לא תקין");
    await deleteSpace(id);
    return NextResponse.json({ ok: true });
  });
}
