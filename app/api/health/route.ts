import { NextResponse } from "next/server";
import { configuredProviders } from "@/lib/providers";

export const runtime = "nodejs";

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  const providers = configuredProviders();

  return NextResponse.json({
    ok: true,
    service: "artssapp-agent",
    timestamp: new Date().toISOString(),
    providers: {
      configured: providers,
      openai: configured("OPENAI_API_KEY"),
      deepseek: configured("DEEPSEEK_API_KEY"),
      gemini: configured("GEMINI_API_KEY"),
      claude: configured("ANTHROPIC_API_KEY") || configured("CLAUDE_API_KEY"),
      mistral: configured("MISTRAL_API_KEY"),
    },
    integrations: {
      github: configured("GITHUB_TOKEN"),
      supabase: configured("SUPABASE_URL") && configured("SUPABASE_SERVICE_ROLE_KEY"),
      vercel: configured("VERCEL_TOKEN"),
    },
    executionEnabled: process.env.AGENT_EXECUTION_ENABLED === "true",
  });
}
