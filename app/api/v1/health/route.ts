import { NextResponse } from "next/server";
import { getGithubToken } from "@/lib/github";

export const runtime = "nodejs";

export async function GET() {
  const githubReady = Boolean(await getGithubToken().catch(() => undefined));
  return NextResponse.json({
    ok: true,
    service: "arts-agent-api",
    version: "v1",
    executionEnabled: process.env.AGENT_EXECUTION_ENABLED === "true" && githubReady,
    configuredProviders: [
      ["openai", process.env.OPENAI_API_KEY],
      ["deepseek", process.env.DEEPSEEK_API_KEY],
      ["gemini", process.env.GEMINI_API_KEY],
    ].filter(([, value]) => Boolean(value)).map(([name]) => name),
    timestamp: new Date().toISOString(),
  });
}
