import { NextResponse } from "next/server";
import { setAgentSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";
  const ok = await setAgentSession(password);
  if (!ok) {
    return NextResponse.json({ error: "Invalid agent credentials." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
