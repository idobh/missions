import { NextResponse } from "next/server";
import { resolvePending } from "@/lib/agent";
import { bad, handle } from "@/lib/http";

export function POST(req: Request) {
  return handle(async () => {
    const b = await req.json();
    if (typeof b.id !== "string") return bad("חסר מזהה");
    return NextResponse.json(await resolvePending(b.id, b.approve === true));
  });
}
