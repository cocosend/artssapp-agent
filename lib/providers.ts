import { getVercelOidcTokenSync } from "@vercel/oidc";

export type ProviderId = "openai" | "deepseek" | "gemini" | "claude" | "mistral";
export type AgentMode = ProviderId | "multi";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

const SYSTEM = `You are Arts Agent, a personal software-engineering agent.
Work as a pragmatic senior engineer. Prefer small safe changes, inspect before editing,
keep existing architecture, and explain what changed. You can write code for any language
or framework requested by the user. Never expose secrets. When a task requires repository
changes, return the structured JSON plan requested by the server.`;

const MODEL_TIMEOUT_MS = 60_000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(MODEL_TIMEOUT_MS) });
}

function extractOpenAIText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  const parts = data?.output ?? [];
  return parts.flatMap((item: any) => item?.content ?? [])
    .map((part: any) => part?.text ?? "")
    .filter(Boolean).join("\n");
}

async function callOpenAI(messages: ChatMessage[], model: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const r = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, instructions: SYSTEM, input: messages, store: false }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  return extractOpenAIText(await r.json());
}

async function callDeepSeek(messages: ChatMessage[], model: string) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not configured");
  const response = await fetchWithTimeout("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM }, ...messages], stream: false }),
  });
  if (!response.ok) throw new Error("DeepSeek request failed (" + response.status + ")");
  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callGemini(messages: ChatMessage[], model: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const contents = messages.filter((m) => m.role !== "system").map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const r = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents }),
    },
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("\n") ?? "";
}


/** Supports gateway-issued OIDC on Vercel deployments. No secret is persisted in source. */
export function getGatewayToken() {
  if (process.env.AI_GATEWAY_API_KEY?.trim()) return process.env.AI_GATEWAY_API_KEY.trim();
  try {
    // On Vercel a fresh OIDC token may live in the request context, not process.env.
    return getVercelOidcTokenSync();
  } catch {
    return process.env.VERCEL_OIDC_TOKEN?.trim();
  }
}

export function gatewayConfigured() {
  return Boolean(getGatewayToken());
}

async function callGateway(messages: ChatMessage[], model: string) {
  const token = getGatewayToken();
  if (!token) throw new Error("AI Gateway authentication is unavailable");
  const response = await fetchWithTimeout("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      model, stream: false,
      messages: [{ role: "system", content: SYSTEM }, ...messages],
      max_tokens: 4000,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("AI Gateway request failed (" + response.status + ")");
  const data = await response.json();
  const output = data?.choices?.[0]?.message?.content;
  if (typeof output !== "string" || !output.trim()) throw new Error("AI Gateway returned no text");
  return output;
}

async function callClaude(messages: ChatMessage[], model: string) {
  const key = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
  const system = [SYSTEM, ...messages.filter(message => message.role === "system").map(message => message.content)].join("\n\n");
  const chat = messages.filter(message => message.role !== "system").map(message => ({
    role: message.role as "user" | "assistant", content: message.content,
  }));
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 8192, system, messages: chat }),
  });
  if (!response.ok) throw new Error("Claude request failed (" + response.status + ")");
  const data = await response.json();
  return (data?.content ?? []).filter((part: { type?: string }) => part.type === "text")
    .map((part: { text?: string }) => part.text ?? "").join("\n");
}

async function callMistral(messages: ChatMessage[], model: string) {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error("MISTRAL_API_KEY is not configured");
  const response = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false, messages: [
      { role: "system", content: SYSTEM }, ...messages,
    ] }),
  });
  if (!response.ok) throw new Error("Mistral request failed (" + response.status + ")");
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : Array.isArray(content)
    ? content.map((part: { text?: string }) => part.text ?? "").join("\n") : "";
}

export async function runModel(provider: ProviderId, messages: ChatMessage[]) {
  if (provider === "deepseek") return callDeepSeek(messages, process.env.DEEPSEEK_MODEL || "deepseek-flash");
  if (provider === "gemini") return callGemini(messages, process.env.GEMINI_MODEL || "gemini-3.8-flash");
  if (provider === "claude") return (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY)
    ? callClaude(messages, process.env.CLAUDE_MODEL || "claude-sonnet-5-5")
    : callGateway(messages, process.env.GATEWAY_CLAUDE_MODEL || "anthropic/claude-sonnet-5.5");
  if (provider === "mistral") return process.env.MISTRAL_API_KEY
    ? callMistral(messages, process.env.MISTRAL_MODEL || "mistral-large-latest")
    : callGateway(messages, process.env.GATEWAY_MISTRAL_MODEL || "mistral/mistral-large-4");
  return callOpenAI(messages, process.env.OPENAI_MODEL || "gpt-5.6-luna");
}

export function configuredProviders(): ProviderId[] {
  const out: ProviderId[] = [];
  if (process.env.OPENAI_API_KEY) out.push("openai");
  if (process.env.DEEPSEEK_API_KEY) out.push("deepseek");
  if (process.env.GEMINI_API_KEY) out.push("gemini");
  if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || gatewayConfigured()) out.push("claude");
  if (process.env.MISTRAL_API_KEY || gatewayConfigured()) out.push("mistral");
  return out;
}

export type OrchestrationReport = {
  strategy: "parallel" | "sequential";
  attempted: ProviderId[];
  contributors: ProviderId[];
  failed: ProviderId[];
  synthesized: boolean;
  judge?: ProviderId;
};

export async function runModelWithFallback(preferred: AgentMode, messages: ChatMessage[]): Promise<{
  provider: AgentMode; text: string; contributors: ProviderId[]; orchestration: OrchestrationReport
}> {
  const configured = configuredProviders();
  if (!configured.length) throw new Error("No AI providers are configured.");

  if (preferred === "multi" && configured.length > 1) {
    // Max 3 actual primary calls. Only count models that really returned text.
    const selected = configured.slice(0, 3);
    const settled = await Promise.allSettled(selected.map(provider => runModel(provider, messages)));
    const successes = settled.flatMap((result, index) =>
      result.status === "fulfilled" && result.value.trim()
        ? [{ provider: selected[index], text: result.value }]
        : []
    );
    const failed = selected.filter(p => !successes.some(s => s.provider === p));
    const attempted = [...selected];
    if (!successes.length) {
      for (const provider of configured.slice(3)) {
        attempted.push(provider);
        try {
          const text = await runModel(provider, messages);
          if (text.trim()) return {
            provider, text, contributors: [provider],
            orchestration: { strategy: "parallel", attempted, contributors: [provider], failed, synthesized: false },
          };
        } catch { failed.push(provider); }
      }
      throw new Error("All configured AI providers failed.");
    }

    const contributors = successes.map(r => r.provider);
    if (successes.length > 1) {
      const judge = successes.find(r => r.provider === "openai") || successes[0];
      const candidates = successes.map((result, index) =>
        "CANDIDATE " + (index + 1) + " (" + result.provider + "):\n" + result.text.slice(0, 16000)
      ).join("\n\n");
      try {
        const synthesis: ChatMessage[] = [
          ...messages,
          { role: "system", content: "Combine and critically evaluate these independent AI outputs for the original request. Preserve valid structured JSON required by the calling application; do not expose provider internals or secrets. Return one complete final answer or one safe coherent JSON edit plan.\n\n" + candidates },
        ];
        const text = await runModel(judge.provider, synthesis);
        if (text.trim()) return {
          provider: "multi", text, contributors,
          orchestration: { strategy: "parallel", attempted, contributors, failed, synthesized: true, judge: judge.provider },
        };
      } catch {
        // Keep the independent output if synthesis fails, but never claim a synthesis occurred.
      }
    }
    return {
      provider: successes[0].provider, text: successes[0].text, contributors,
      orchestration: { strategy: "parallel", attempted, contributors, failed, synthesized: false },
    };
  }

  const order = preferred === "multi" ? configured : [preferred, ...configured.filter(p => p !== preferred)];
  const attempted: ProviderId[] = [];
  const failed: ProviderId[] = [];
  let lastError: unknown;
  for (const provider of order) {
    if (!configured.includes(provider)) continue;
    attempted.push(provider);
    try {
      const text = await runModel(provider, messages);
      if (!text.trim()) throw new Error(provider + " returned an empty response.");
      return {
        provider, text, contributors: [provider],
        orchestration: { strategy: "sequential", attempted, contributors: [provider], failed, synthesized: false },
      };
    } catch (error) {
      failed.push(provider);
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All configured AI providers failed.");
}
