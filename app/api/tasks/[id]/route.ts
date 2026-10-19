import { NextResponse } from "next/server";
import { deleteTasks, getSpace, isISODate, isPriority, isStatus, updateTask, type TaskPatch } from "@/lib/repo";
import { bad, handle, toId } from "@/lib/http";

export function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = toId((await ctx.params).id);
    if (!id) return bad("מזהה לא תקין");
    const b = await req.json();
    const patch: TaskPatch = {};
    if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim();
    if (typeof b.description === "string") patch.description = b.description;
    if (isPriority(b.priority)) patch.priority = b.priority;
    if (isStatus(b.status)) patch.status = b.status;
    if (b.due_date === null || isISODate(b.due_date)) patch.due_date = b.due_date;
    if (b.space_id !== undefined) {
      const sid = toId(b.space_id);
      if (!sid || !(await getSpace(sid))) return bad("מרחב לא תקין");
      patch.space_id = sid;
    }
    const task = await updateTask(id, patch);
    return task ? NextResponse.json(task) : bad("המשימה לא נמצאה", 404);
  });
}

export function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = toId((await ctx.params).id);
    if (!id) return bad("מזהה לא תקין");
    await deleteTasks([id]);
    return NextResponse.json({ ok: true });
  });
}
