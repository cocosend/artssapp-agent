export type ProviderId = "openai" | "deepseek" | "gemini";

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
  const r = await fetchWithTimeout("https://api.deepseek.com/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, instructions: SYSTEM, input: messages, stream: false }),
  });
  if (!r.ok) throw new Error(`DeepSeek ${r.status}: ${await r.text()}`);
  return extractOpenAIText(await r.json());
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

export async function runModel(provider: ProviderId, messages: ChatMessage[]) {
  if (provider === "deepseek") return callDeepSeek(messages, process.env.DEEPSEEK_MODEL || "deepseek-v4-pro");
  if (provider === "gemini") return callGemini(messages, process.env.GEMINI_MODEL || "gemini-3.8-flash");
  return callOpenAI(messages, process.env.OPENAI_MODEL || "gpt-5.6-luna");
}

export function configuredProviders(): ProviderId[] {
  const out: ProviderId[] = [];
  if (process.env.OPENAI_API_KEY) out.push("openai");
  if (process.env.DEEPSEEK_API_KEY) out.push("deepseek");
  if (process.env.GEMINI_API_KEY) out.push("gemini");
  return out;
}

export async function runModelWithFallback(preferred: ProviderId, messages: ChatMessage[]) {
  const configured = configuredProviders();
  const order = [preferred, ...configured.filter((p) => p !== preferred)];
  let lastError: unknown;

  for (const provider of order) {
    if (!configured.includes(provider)) continue;
    try {
      const text = await runModel(provider, messages);
      if (!text.trim()) throw new Error(`${provider} returned an empty response.`);
      return { provider, text };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All configured AI providers failed.");
}
