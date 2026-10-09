import { NextResponse } from "next/server";
import { isAgentAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const authenticated = await isAgentAuthenticated();
  return NextResponse.json({ authenticated }, {
    status: authenticated ? 200 : 401,
    headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" },
  });
}
