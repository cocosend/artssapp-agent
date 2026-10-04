import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "arts-agent-api",
    version: "v1",
    executionEnabled: process.env.AGENT_EXECUTION_ENABLED === "true",
    configuredProviders: [
      ["openai", process.env.OPENAI_API_KEY],
      ["deepseek", process.env.DEEPSEEK_API_KEY],
      ["gemini", process.env.GEMINI_API_KEY],
    ].filter(([, value]) => Boolean(value)).map(([name]) => name),
    timestamp: new Date().toISOString(),
  });
}
