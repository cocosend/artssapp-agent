import { NextResponse } from "next/server";
import { clearAgentSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await clearAgentSession();
  return NextResponse.json({ ok: true });
}
