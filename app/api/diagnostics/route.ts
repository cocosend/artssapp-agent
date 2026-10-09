import { NextResponse } from "next/server";
import { isAgentAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 25;

type Probe = { state: "ok" | "missing_key" | "http_error" | "timeout"; status?: number };
type DiagnosticName = "openai" | "deepseek" | "gemini" | "claude" | "mistral" | "github" | "supabase" | "vercel";

const timeoutMs = 6500;

async function probe(url: string, key: string | undefined, headers: Record<string, string>): Promise<Probe> {
  if (!key?.trim()) return { state: "missing_key" };
  try {
    const response = await fetch(url, { method: "GET", headers, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    return response.ok ? { state: "ok", status: response.status } : { state: "http_error", status: response.status };
  } catch {
    return { state: "timeout" };
  }
}

export async function GET() {
  if (!(await isAgentAuthenticated())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const github = process.env.GITHUB_TOKEN?.trim();
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const vercel = process.env.VERCEL_TOKEN?.trim();
  const team = process.env.VERCEL_TEAM_ID?.trim();
  const repo = process.env.GITHUB_REPO || "cocosend/artssapp-agent";
  const project = process.env.VERCEL_PROJECT_ID || "prj_LclUIsfqljGOjbYJmAXLxYkVv6xS";

  const jobs: Record<DiagnosticName, Promise<Probe>> = {
    openai: probe("https://api.openai.com/v1/models", process.env.OPENAI_API_KEY,
      { Authorization: "Bearer " + (process.env.OPENAI_API_KEY || "") }),
    deepseek: probe("https://api.deepseek.com/models", process.env.DEEPSEEK_API_KEY,
      { Authorization: "Bearer " + (process.env.DEEPSEEK_API_KEY || "") }),
    gemini: probe("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", process.env.GEMINI_API_KEY,
      { "x-goog-api-key": process.env.GEMINI_API_KEY || "" }),
    claude: probe("https://api.anthropic.com/v1/models?limit=1", process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
      { "x-api-key": process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "", "anthropic-version": "2023-06-01" }),
    mistral: probe("https://api.mistral.ai/v1/models", process.env.MISTRAL_API_KEY,
      { Authorization: "Bearer " + (process.env.MISTRAL_API_KEY || "") }),
    github: probe("https://api.github.com/repos/" + repo,
      // Public repository read-only is supported even if write credentials are absent.
      "public-access",
      { Accept: "application/vnd.github+json", ...(github ? { Authorization: "Bearer " + github } : {}), "X-GitHub-Api-Version": "2022-11-28" }),
    supabase: probe((supabaseUrl || "https://invalid.example").replace(/\/$/, "") + "/rest/v1/agent_runs?select=id&limit=1",
      supabase && supabaseUrl ? supabase : undefined,
      { apikey: supabase || "", Authorization: "Bearer " + (supabase || "") }),
    vercel: probe("https://api.vercel.com/v9/projects/" + encodeURIComponent(project) +
      (team ? "?teamId=" + encodeURIComponent(team) : ""), vercel,
      { Authorization: "Bearer " + (vercel || "") }),
  };

  const entries = await Promise.all(Object.entries(jobs).map(async ([name, job]) => [name, await job] as const));
  const results = Object.fromEntries(entries) as Record<DiagnosticName, Probe>;
  const executionEnabled = process.env.AGENT_EXECUTION_ENABLED === "true";
  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    results,
    githubRead: results.github.state === "ok",
    githubWrite: github ? (results.github.state === "ok" ? "token_present_not_write_tested" : "unavailable") : "missing_key",
    agentExecution: executionEnabled && Boolean(github) ? "configured_not_write_tested" : "disabled",
    vercelDeploy: results.vercel.state === "ok" && executionEnabled && Boolean(github) ? "configured_not_tested" : "unavailable",
    note: "GET probes confirm basic API authentication, not successful AI inference, code writes or deployments.",
  }, { headers: { "Cache-Control": "private, no-store" } });
}
