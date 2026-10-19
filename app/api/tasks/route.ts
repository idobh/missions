import { NextResponse } from "next/server";
import { createTask, getSpace, isISODate, isPriority, isStatus, listTasks } from "@/lib/repo";
import { bad, handle, toId } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const sp = new URL(req.url).searchParams;
    const spaceId = toId(sp.get("spaceId"));
    return NextResponse.json(await listTasks(spaceId ? { spaceIds: [spaceId] } : {}));
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const b = await req.json();
    const spaceId = toId(b.space_id);
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (!spaceId || !(await getSpace(spaceId))) return bad("מרחב לא תקין");
    if (!title) return bad("חסרה כותרת");
    const task = await createTask({
      space_id: spaceId,
      title,
      description: typeof b.description === "string" ? b.description : "",
      priority: isPriority(b.priority) ? b.priority : "medium",
      status: isStatus(b.status) ? b.status : "new",
      due_date: isISODate(b.due_date) ? b.due_date : null,
    });
    return NextResponse.json(task);
  });
}
