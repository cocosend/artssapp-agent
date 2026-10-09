import { NextResponse } from "next/server";
import { setAgentSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "JSON required." }, { status: 415 });
  }
  const body: unknown = await req.json().catch(() => null);
  const password = typeof body === "object" && body !== null && "password" in body &&
    typeof body.password === "string" ? body.password : "";
  if (!password || password.length > 128) {
    return NextResponse.json({ error: "Invalid credentials format." }, {
      status: 400, headers: { "Cache-Control": "no-store" },
    });
  }
  const ok = await setAgentSession(password);
  return NextResponse.json(ok ? { ok: true } : { error: "Invalid agent credentials." }, {
    status: ok ? 200 : 401, headers: { "Cache-Control": "private, no-store" },
  });
}
