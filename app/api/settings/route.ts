import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/repo";
import { bad, handle } from "@/lib/http";

export const dynamic = "force-dynamic";

// Only the dashboard space selection is stored for now. null = all spaces.
export function GET() {
  return handle(async () => NextResponse.json({ dashboardSpaces: await getSetting<number[] | null>("dashboard_spaces", null) }));
}

export function PUT(req: Request) {
  return handle(async () => {
    const b = await req.json();
    const v = b.dashboardSpaces;
    if (v !== null && !(Array.isArray(v) && v.every((x) => Number.isInteger(x)))) return bad("ערך לא תקין");
    await setSetting("dashboard_spaces", v);
    return NextResponse.json({ ok: true });
  });
}
