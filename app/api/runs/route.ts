import { NextResponse } from "next/server";
import { isAgentAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAgentAuthenticated())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    return NextResponse.json({ runs: [], storage: "unconfigured" }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const endpoint = base.replace(/\/$/, "") + "/rest/v1/agent_runs?select=id,task,status,created_at,completed_at&order=created_at.desc&limit=12";
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: "Bearer " + key },
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return NextResponse.json({ runs: [], storage: "unavailable" }, { status: 503 });
    const data: unknown = await response.json();
    const runs = Array.isArray(data) ? data.slice(0, 12).map((run: {
      id?: unknown; task?: unknown; status?: unknown; created_at?: unknown
    }) => ({
      id: String(run.id ?? ""),
      title: typeof run.task === "string" ? run.task.slice(0, 180) : "Agent task",
      status: run.status === "completed" ? "done" : run.status === "failed" ? "error" : "running",
      created_at: typeof run.created_at === "string" ? run.created_at : null,
    })) : [];
    return NextResponse.json({ runs, storage: "connected" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ runs: [], storage: "unavailable" }, { status: 503 });
  }
}
