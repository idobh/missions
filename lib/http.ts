import { NextResponse } from "next/server";

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e: unknown) => {
    console.error(e);
    return bad(e instanceof Error ? e.message : "server error", 500);
  });
}

export function toId(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
