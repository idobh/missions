import { NextResponse } from "next/server";
import { listTasks, spaceStats } from "@/lib/repo";
import { handle } from "@/lib/http";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const raw = new URL(req.url).searchParams.get("spaces");
    const spaceIds = raw === null ? undefined : raw.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
    const today = todayISO();
    const [open, stats] = await Promise.all([
      listTasks({ spaceIds, includeDone: false }),
      spaceStats(spaceIds),
    ]);
    return NextResponse.json({
      today,
      urgent: open.filter((t) => t.priority === "urgent"),
      dueToday: open.filter((t) => t.due_date === today),
      overdue: open.filter((t) => t.due_date !== null && t.due_date < today),
      stats,
    });
  });
}
