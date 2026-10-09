import { NextResponse } from "next/server";
import { configuredProviders, gatewayConfigured } from "@/lib/providers";

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
      claude: configured("ANTHROPIC_API_KEY") || configured("CLAUDE_API_KEY") || gatewayConfigured(),
      mistral: configured("MISTRAL_API_KEY") || gatewayConfigured(),
    },
    integrations: {
      github: configured("GITHUB_TOKEN"),
      supabase: configured("SUPABASE_URL") && configured("SUPABASE_SERVICE_ROLE_KEY"),
      vercel: configured("VERCEL_TOKEN"),
    },
    gateway: {
      configured: gatewayConfigured(),
      authMode: configured("AI_GATEWAY_API_KEY") ? "key" : configured("VERCEL_OIDC_TOKEN") ? "oidc" : "none",
    },
    capabilities: {
      publicGithubRead: true,
      githubWriteConfigured: configured("GITHUB_TOKEN"),
      githubExecutionReady: configured("GITHUB_TOKEN") && process.env.AGENT_EXECUTION_ENABLED === "true",
      vercelApiConfigured: configured("VERCEL_TOKEN"),
      imageGenerationConfigured: configured("OPENAI_API_KEY"),
      webSearchConfigured: configured("OPENAI_API_KEY"),
      supabaseConfigured: configured("SUPABASE_URL") && configured("SUPABASE_SERVICE_ROLE_KEY"),
    },
    executionEnabled: process.env.AGENT_EXECUTION_ENABLED === "true" && configured("GITHUB_TOKEN"),
  });
}
