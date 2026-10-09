import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type ProviderId = "openai" | "deepseek" | "gemini";
type AgentMode = ProviderId | "multi";
type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
type AgentFile = { path: string; content: string };
type AgentPlan = {
  action: "answer" | "change";
  message: string;
  commit?: boolean;
  createPr?: boolean;
  commitMessage?: string;
  prTitle?: string;
  readFiles?: string[];
  files?: AgentFile[];
};

const REPO = "cocosend/artssapp-agent";
const SERVICE_KEY = resolveServiceKey(Deno.env.get("AGENT_SERVICE_KEY") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
async function resolveServiceKey(dedicated: string, databaseKey: string): Promise<string> {
  if (dedicated) return dedicated;
  if (!databaseKey) return "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(databaseKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("artss-agent-api/service-auth/v1"));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
const GITHUB_TOKEN_CONFIGURED = Boolean(Deno.env.get("GITHUB_TOKEN"));
const executionSetting = Deno.env.get("AGENT_EXECUTION_ENABLED");
const EXECUTION_REQUESTED = executionSetting === "true" || (executionSetting == null && GITHUB_TOKEN_CONFIGURED);
type GithubAccess = { configured: boolean; reachable: boolean; push: boolean; status?: number; reason?: string };
let githubAccessCache: { at: number; value: GithubAccess } | null = null;
const MAX_MESSAGE_CHARS = 12000;
const MODEL_TIMEOUT_MS = 60000;
const GITHUB_TIMEOUT_MS = 30000;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://hyvsmtxewxpfnlzfjvca.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENAI_WEB_SEARCH_ENABLED = Deno.env.get("OPENAI_WEB_SEARCH_ENABLED") !== "false";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-agent-service-key",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

const SYSTEM = `You are ARTSS Agent, a private autonomous product-engineering system.
Operate like a senior engineer, researcher, reviewer and product designer. Inspect repository context and durable skill memory before changing code.
Internally plan, critique and verify your solution before returning the final result; never reveal hidden chain-of-thought.
Prioritize: correctness, security, iPhone-first UX, accessibility, maintainability, minimal blast radius, and deployability.
Use current web search when fresh external facts or documentation materially affect the answer.
Never expose, print, commit, echo or move secret values into client code. Existing server-side secrets may be used only through their intended server integrations.
For repository changes: branch from main, make coherent complete-file edits, preserve unrelated behavior, and prefer a PR over direct main writes.
For deployment work: distinguish configured from verified; never claim success until the public runtime is actually checked.
Return ONLY JSON with this shape:
{
  "action": "answer" | "change",
  "message": "short user-facing summary",
  "commit": true | false,
  "createPr": true | false,
  "commitMessage": "message",
  "prTitle": "title",
  "readFiles": ["path"],
  "files": [{"path":"path","content":"complete file content"}]
}
For code changes, use action="change". Prefer small safe changes. Never write .env files or credentials.`;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8" },
  });
}

async function dbRequest(path: string, init: RequestInit = {}) {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase service role is not configured");
  const r = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  }, 15000);
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase REST ${r.status}`);
  return text ? JSON.parse(text) : null;
}

function durableMemoryPath(limit: 0 | 32) {
  return `agent_memory?scope=eq.global&key=not.in.(last_user_request,last_agent_result)&or=(expires_at.is.null,expires_at.gt.${encodeURIComponent(new Date().toISOString())})&select=kind,key,value,importance,updated_at&order=importance.desc,updated_at.desc&limit=${limit}`;
}

async function checkDurableMemoryRead() {
  const rows = await dbRequest(durableMemoryPath(0));
  if (!Array.isArray(rows) || rows.length !== 0) throw new Error("Invalid durable memory health response");
}

async function loadDurableMemory() {
  const rows = await dbRequest(durableMemoryPath(32));
  if (!Array.isArray(rows)) throw new Error("Invalid durable memory response");
  return rows.filter((row) => row && typeof row === "object" && !["last_user_request", "last_agent_result"].includes(row.key));
}

async function loadSkills() {
  const rows = await dbRequest(
    "agent_skills?enabled=eq.true&select=slug,title,description,instructions,priority&order=priority.desc,slug.asc&limit=24"
  );
  if (!Array.isArray(rows)) throw new Error("Invalid skills response");
  return rows;
}

async function remember(key: string, value: unknown, kind = "state", importance = 60) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    await dbRequest("agent_memory?on_conflict=scope,key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{
        scope: "global",
        kind,
        key,
        value,
        importance,
        updated_at: new Date().toISOString(),
      }]),
    });
    return true;
  } catch {
    console.warn("[arts-agent-api] Durable memory write failed");
    return false;
  }
}

function configuredProviders(): ProviderId[] {
  const out: ProviderId[] = [];
  if (Deno.env.get("OPENAI_API_KEY")) out.push("openai");
  if (Deno.env.get("DEEPSEEK_API_KEY")) out.push("deepseek");
  if (Deno.env.get("GEMINI_API_KEY")) out.push("gemini");
  return out;
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m) => m && typeof m === "object")
    .map((m: any) => ({ role: m.role, content: m.content }))
    .filter((m): m is ChatMessage =>
      ["user", "assistant"].includes(m.role) && typeof m.content === "string"
    )
    .slice(-20)
    .map((m) => ({ ...m, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
}

function validatePath(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (!normalized || normalized.startsWith("/") || /^[a-z]:/i.test(normalized) ||
      /[\x00-\x1f?#]/.test(normalized) || segments.some((part) =>
        !part || part === "." || part === ".." || /^(?:\.git|\.env)/i.test(part) ||
        /^(?:credentials|secrets)(?:\.|$)/i.test(part) ||
        /\.(?:pem|key|p12|pfx)$/i.test(part))) {
    throw new Error(`Blocked repository path: ${path}`);
  }
  return normalized;
}

class PlanValidationError extends Error {}

function parsePlan(rawText: string): AgentPlan {
  const cleaned = rawText.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return { action: "answer", message: rawText };
  try {
    const value = JSON.parse(cleaned.slice(start, end + 1));
    if (!value || typeof value !== "object" || Array.isArray(value)) return { action: "answer", message: rawText };
    const message = typeof value.message === "string" ? value.message : "Задача обработана.";
    if (value.action !== "change") return { action: "answer", message };
    if (value.readFiles != null && (!Array.isArray(value.readFiles) ||
        value.readFiles.length > 12 || value.readFiles.some((path: unknown) => typeof path !== "string"))) {
      throw new PlanValidationError("Invalid inspection plan");
    }
    if (value.files != null && (!Array.isArray(value.files) || value.files.length > 30 ||
        value.files.some((file: any) => !file || typeof file.path !== "string" || typeof file.content !== "string"))) {
      throw new PlanValidationError("Invalid change plan");
    }
    const readFiles = value.readFiles ?? [];
    const files = value.files ?? [];
    if (!files.length && !readFiles.length) throw new PlanValidationError("Change plan has no files");
    return {
      action: "change", message, readFiles, files,
      commit: value.commit === true,
      createPr: true,
      commitMessage: typeof value.commitMessage === "string" ? value.commitMessage : undefined,
      prTitle: typeof value.prTitle === "string" ? value.prTitle : undefined,
    };
  } catch (error) {
    if (error instanceof PlanValidationError) throw error;
    return { action: "answer", message: rawText };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  return fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(ms) });
}

function extractOpenAIText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  return (data?.output ?? [])
    .flatMap((item: any) => item?.content ?? [])
    .map((part: any) => part?.text ?? "")
    .filter(Boolean)
    .join("\n");
}

const providerCooldowns = new Map<ProviderId, number>();
function requireProviderReady(provider: ProviderId) {
  const until = providerCooldowns.get(provider) ?? 0;
  if (until > Date.now()) throw new Error(`${provider} is temporarily unavailable`);
  providerCooldowns.delete(provider);
}

function providerFailure(provider: ProviderId, status: number, body: string) {
  let code = "";
  try { code = JSON.parse(body)?.error?.code ?? ""; } catch { /* Non-JSON errors still use HTTP status. */ }
  const billing = status === 402 || (status === 429 &&
    ["credit_balance_exhausted", "insufficient_quota", "billing_hard_limit_reached"].includes(code));
  if (billing || status === 401) providerCooldowns.set(provider, Date.now() + (billing ? 300_000 : 60_000));
  return new Error(`${provider} request failed (${status})`);
}

async function callOpenAI(messages: ChatMessage[]) {
  requireProviderReady("openai");
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const preferred = Deno.env.get("OPENAI_MODEL") || "gpt-6-astra";
  const models = [preferred, "gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-luna"].filter((v, i, a) => a.indexOf(v) === i);
  let last = "";
  for (const model of models) {
    const makeBody = (withSearch: boolean, withReasoning: boolean) => ({
      model,
      instructions: SYSTEM,
      input: messages,
      store: false,
      ...(withSearch ? { tools: [{ type: "web_search" }] } : {}),
      ...(withReasoning ? { reasoning: { effort: "high" } } : {}),
    });
    for (const variant of [
      { search: OPENAI_WEB_SEARCH_ENABLED, reasoning: true },
      { search: OPENAI_WEB_SEARCH_ENABLED, reasoning: false },
      { search: false, reasoning: false },
    ]) {
      const r = await fetchWithTimeout("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify(makeBody(variant.search, variant.reasoning)),
      }, MODEL_TIMEOUT_MS);
      const text = await r.text();
      if (r.ok) return extractOpenAIText(JSON.parse(text));
      const failure = providerFailure("openai", r.status, text);
      last = failure.message;
      if (![400, 404, 422].includes(r.status)) throw failure;
      if (r.status === 404) break;
    }
  }
  throw new Error(last || "OpenAI request failed");
}
async function callVercelGateway(messages: ChatMessage[]) {
  const serviceKey = await SERVICE_KEY;
  if (!serviceKey) throw new Error("Vercel Gateway bridge authentication is unavailable");
  const gatewayUrl = Deno.env.get("VERCEL_GATEWAY_URL");
  if (!gatewayUrl) throw new Error("Vercel Gateway fallback is not configured");
  const gateway = new URL(gatewayUrl);
  if (gateway.protocol !== "https:" || gateway.username || gateway.password) throw new Error("Invalid Vercel Gateway URL");
  const r = await fetchWithTimeout(gateway.toString(), {
    method: "POST",
    headers: { "content-type": "application/json", "x-agent-service-key": serviceKey },
    body: JSON.stringify({ messages, system: SYSTEM }),
  }, MODEL_TIMEOUT_MS);
  const text = await r.text();
  if (!r.ok) throw new Error(`Vercel AI Gateway ${r.status}: ${text.slice(0, 1200)}`);
  const data = JSON.parse(text);
  if (typeof data?.text !== "string" || !data.text.trim()) throw new Error("Vercel AI Gateway returned empty output");
  return data.text;
}

async function callDeepSeek(messages: ChatMessage[]) {
  requireProviderReady("deepseek");
  const key = Deno.env.get("DEEPSEEK_API_KEY");
  if (!key) throw new Error("DEEPSEEK_API_KEY is not configured");
  const model = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-pro";
  const r = await fetchWithTimeout("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM }, ...messages],
      stream: false,
      response_format: { type: "json_object" },
    }),
  }, MODEL_TIMEOUT_MS);
  const text = await r.text();
  if (!r.ok) throw providerFailure("deepseek", r.status, text);
  return JSON.parse(text)?.choices?.[0]?.message?.content ?? "";
}

async function callGemini(messages: ChatMessage[]) {
  requireProviderReady("gemini");
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const preferred = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
  const models = [preferred, "gemini-3.7-flash", "gemini-3.6-flash"].filter((v, i, a) => a.indexOf(v) === i);
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  let last = "";
  for (const model of models) {
    const r = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: [SYSTEM, ...messages.filter((m) => m.role === "system").map((m) => m.content)].join("\n\n") }] },
          contents,
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
      MODEL_TIMEOUT_MS,
    );
    const text = await r.text();
    if (r.ok) return JSON.parse(text)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("\n") ?? "";
    const failure = providerFailure("gemini", r.status, text);
    last = failure.message;
    if (providerCooldowns.has("gemini")) throw failure;
    if (![404, 429, 500, 502, 503, 504].includes(r.status)) break;
  }
  throw new Error(last || "Gemini request failed");
}

async function runMultiModel(messages: ChatMessage[]) {
  const configured = configuredProviders();
  if (!configured.length) throw new Error("No AI provider is configured");
  const settled = await Promise.all(configured.map(async (provider) => {
    try {
      const text = provider === "openai" ? await callOpenAI(messages) : provider === "deepseek" ? await callDeepSeek(messages) : await callGemini(messages);
      if (!text.trim()) throw new Error(provider + " returned empty output");
      return { provider, text, ok: true as const };
    } catch (error) {
      return { provider, text: "", ok: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  }));
  const successes = settled.filter((x): x is { provider: ProviderId; text: string; ok: true } => x.ok);
  if (!successes.length) {
    const detail = settled.map((x: any) => x.provider + ": " + (x.error || "failed")).join(" | ");
    try {
      const text = await callVercelGateway(messages);
      return { provider: "vercel-gateway" as const, text, contributors: ["vercel-gateway"] };
    } catch (gatewayError) {
      const gateway = gatewayError instanceof Error ? gatewayError.message : String(gatewayError);
      throw new Error("All providers failed: " + detail + " | vercel-gateway: " + gateway);
    }
  }
  if (successes.length === 1) return { provider: successes[0].provider, text: successes[0].text, contributors: [successes[0].provider] };
  const candidates = successes.map((x, i) => "CANDIDATE " + (i + 1) + " (" + x.provider + "):\n" + x.text).join("\n\n");
  const judgeMessages: ChatMessage[] = [
    ...messages,
    { role: "system", content: "You are the lead reviewer for a multi-agent coding team. Below are independent candidate JSON plans from multiple providers. Synthesize the safest, most complete FINAL JSON plan using the required Arts Agent schema. Do not mention the review process. Preserve repository safety constraints.\n\n" + candidates },
  ];
  try {
    const judgePreferred = successes.find((x) => x.provider === "openai")?.provider ?? successes[0].provider;
    const judge = await runModelWithFallback(judgePreferred, judgeMessages);
    return { provider: "multi" as const, text: judge.text, contributors: successes.map((x) => x.provider) };
  } catch {
    // Unreviewed candidates must never trigger repository writes.
    const candidate = successes[0];
    const preview = parsePlan(candidate.text);
    return {
      provider: "multi" as const,
      text: JSON.stringify({ ...preview, commit: false, createPr: true }),
      contributors: successes.map((x) => x.provider),
    };
  }
}
async function runModelWithFallback(preferred: ProviderId, messages: ChatMessage[]) {
  const configured = configuredProviders();
  const order = [preferred, ...configured.filter((p) => p !== preferred)];
  let lastError: unknown;
  for (const provider of order) {
    if (!configured.includes(provider)) continue;
    try {
      const text = provider === "openai"
        ? await callOpenAI(messages)
        : provider === "deepseek"
          ? await callDeepSeek(messages)
          : await callGemini(messages);
      if (!text.trim()) throw new Error(`${provider} returned empty output`);
      return { provider, text };
    } catch (error) {
      lastError = error;
    }
  }
  try {
    const text = await callVercelGateway(messages);
    return { provider: "vercel-gateway" as const, text };
  } catch (gatewayError) {
    if (lastError instanceof Error) throw new Error(lastError.message + " | vercel-gateway: " + (gatewayError instanceof Error ? gatewayError.message : String(gatewayError)));
    throw gatewayError;
  }
}

function githubHeaders(write = false) {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (write && !token) throw new Error("GITHUB_TOKEN is not configured");
  return {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    "content-type": "application/json",
  };
}

async function github(path: string, init: RequestInit = {}, write = false) {
  const r = await fetchWithTimeout(`https://api.github.com${path}`, {
    ...init,
    headers: { ...githubHeaders(write), ...(init.headers || {}) },
  }, GITHUB_TIMEOUT_MS);
  const text = await r.text();
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${text.slice(0, 1200)}`);
  return text ? JSON.parse(text) : null;
}

async function checkGithubWriteAccess(force = false): Promise<GithubAccess> {
  if (!GITHUB_TOKEN_CONFIGURED) return { configured: false, reachable: false, push: false, reason: "token_missing" };
  const now = Date.now();
  if (!force && githubAccessCache && now - githubAccessCache.at < 60_000) return githubAccessCache.value;
  try {
    const r = await fetchWithTimeout(`https://api.github.com/repos/${REPO}`, {
      method: "GET",
      headers: githubHeaders(false),
      cache: "no-store",
    }, GITHUB_TIMEOUT_MS);
    const text = await r.text();
    let body: any = {};
    try { body = text ? JSON.parse(text) : {}; } catch {}
    const value: GithubAccess = {
      configured: true,
      reachable: r.ok,
      push: r.ok && body?.permissions?.push === true,
      status: r.status,
      reason: r.ok ? undefined : (body?.message || "github_access_failed"),
    };
    githubAccessCache = { at: now, value };
    return value;
  } catch (error) {
    const value: GithubAccess = {
      configured: true,
      reachable: false,
      push: false,
      reason: error instanceof Error ? error.message : "github_access_failed",
    };
    githubAccessCache = { at: now, value };
    return value;
  }
}

async function readRepoFile(path: string, ref = "main") {
  const data = await github(`/repos/${REPO}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`);
  if (!data?.content) return "";
  const binary = atob(String(data.content).replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function repoContext() {
  const important = [
    "package.json",
    "README.md",
    "app/page.tsx",
    "app/api/agent/route.ts",
    "lib/providers.ts",
    "lib/github.ts",
    "lib/agent-plan.ts",
  ];
  let root = "";
  try {
    const entries = await github(`/repos/${REPO}/contents/?ref=main`);
    root = Array.isArray(entries) ? entries.map((x: any) => x.path).slice(0, 100).join(", ") : "";
  } catch {}
  const files = await Promise.all(important.map(async (path) => {
    try {
      return `FILE: ${path}\n${(await readRepoFile(path)).slice(0, 16000)}`;
    } catch {
      return `FILE: ${path}\n<unavailable>`;
    }
  }));
  return `REPOSITORY: ${REPO}\nROOT: ${root}\n\n${files.join("\n\n")}`;
}

async function inspectFiles(paths: string[]) {
  const safe = paths.map(validatePath).slice(0, 12);
  const parts = await Promise.all(safe.map(async (path) => {
    try {
      return `FILE: ${path}\n${(await readRepoFile(path)).slice(0, 16000)}`;
    } catch (e) {
      return `FILE: ${path}\n<unavailable: ${e instanceof Error ? e.message : "error"}>`;
    }
  }));
  return parts.join("\n\n");
}

async function getBranchHead(branch = "main") {
  return github(`/repos/${REPO}/git/ref/heads/${encodeURIComponent(branch)}`);
}

async function createBranch(branch: string, from = "main") {
  const base = await getBranchHead(from);
  return github(`/repos/${REPO}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }),
  }, true);
}

async function commitFiles(files: AgentFile[], message: string, branch: string) {
  const head = await getBranchHead(branch);
  const parentSha = head.object.sha;
  const parent = await github(`/repos/${REPO}/git/commits/${parentSha}`);
  const tree = await github(`/repos/${REPO}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: parent.tree.sha,
      tree: files.map((f) => ({
        path: validatePath(f.path),
        mode: "100644",
        type: "blob",
        content: f.content,
      })),
    }),
  }, true);
  const commit = await github(`/repos/${REPO}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
  }, true);
  await github(`/repos/${REPO}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  }, true);
  return commit;
}

async function createPr(title: string, branch: string, body: string) {
  return github(`/repos/${REPO}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, head: branch, base: "main", body }),
  }, true);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (req.method === "GET") {
    let skills;
    try { [skills] = await Promise.all([loadSkills(), checkDurableMemoryRead()]); }
    catch { return json({ error: "Durable context is unavailable" }, 503); }
    const githubAccess = await checkGithubWriteAccess();
    const executionEnabled = EXECUTION_REQUESTED && githubAccess.push;
    return json({
      ok: true,
      service: "arts-agent-api",
      version: "2026-10-09-readonly-memory-health",
      runtime: "supabase-edge",
      repository: REPO,
      providers: configuredProviders(),
      modes: ["multi", ...configuredProviders()],
      executionEnabled,
      executionRequested: EXECUTION_REQUESTED,
      githubWriteConfigured: githubAccess.push,
      githubTokenConfigured: githubAccess.configured,
      githubReachable: githubAccess.reachable,
      githubStatus: githubAccess.status,
      dedicatedServiceKeyConfigured: Boolean(Deno.env.get("AGENT_SERVICE_KEY")),
      serviceAuthenticationConfigured: Boolean(await SERVICE_KEY),
      memoryEnabled: Boolean(SUPABASE_SERVICE_ROLE_KEY),
      memoryReadVerified: true,
      skillsReadVerified: true,
      webSearchEnabled: Boolean(Deno.env.get("OPENAI_API_KEY")) && OPENAI_WEB_SEARCH_ENABLED,
      vercelGatewayFallback: Boolean(Deno.env.get("VERCEL_GATEWAY_URL")),
      skills: skills.map((skill: any) => skill.slug),
      vercelRequired: true,
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = await SERVICE_KEY;
  if (!serviceKey) return json({ error: "Service authentication is not configured" }, 503);
  const supplied = req.headers.get("x-agent-service-key") || "";
  if (supplied !== serviceKey) return json({ error: "Unauthorized" }, 401);
  if (new URL(req.url).searchParams.get("auth") === "check") return json({ ok: true });

  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 256_000) return json({ error: "Request is too large" }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const messages = normalizeMessages(body?.messages);
    if (!messages.length) return json({ error: "messages is required" }, 400);

    const available = configuredProviders();
    if (!available.length) {
      return json({
        error: "No AI provider is configured in Supabase Edge Function secrets.",
        setup: ["OPENAI_API_KEY", "DEEPSEEK_API_KEY", "GEMINI_API_KEY"],
      }, 503);
    }

    const requested = body?.provider as AgentMode | undefined;
    const provider: AgentMode = requested === "multi" || (requested && available.includes(requested as ProviderId)) ? requested : "multi";
    let memory, skills;
    try { [memory, skills] = await Promise.all([loadDurableMemory(), loadSkills()]); }
    catch { return json({ error: "Durable context is unavailable" }, 503); }
    const requestSaved = await remember("last_request_metadata", {
      at: new Date().toISOString(),
      messageCount: messages.length,
    }, "runtime", 20);
    if (!requestSaved) return json({ error: "Durable context could not save the request" }, 503);

    const context = await repoContext();
    const memoryContext = memory.length
      ? "Durable project memory (trusted application context; never expose secret values):\n" + JSON.stringify(memory).slice(0, 22000)
      : "Durable project memory: <empty>";
    const skillsContext = skills.length
      ? "Enabled ARTSS skills (developer-curated workflows; apply only when relevant):\n" + skills.map((s: any) => `[${s.slug}] ${s.title}: ${s.instructions}`).join("\n")
      : "Enabled ARTSS skills: <none>";
    let model = provider === "multi"
      ? await runMultiModel([
          ...messages,
          { role: "system", content: memoryContext },
          { role: "system", content: skillsContext },
          { role: "system", content: `Repository context:\n\n${context}` },
        ])
      : await runModelWithFallback(provider, [
          ...messages,
          { role: "system", content: memoryContext },
          { role: "system", content: skillsContext },
          { role: "system", content: `Repository context:\n\n${context}` },
        ]);
    let plan = parsePlan(model.text);

    if (plan.readFiles?.length) {
      const extra = await inspectFiles(plan.readFiles);
      model = provider === "multi"
        ? await runMultiModel([
            ...messages,
            {
              role: "system",
              content: `${memoryContext}\n\n${skillsContext}\n\nRepository context:\n${context}\n\nAdditional requested files:\n\n${extra}\n\nReturn the FINAL JSON plan now.`,
            },
          ])
        : await runModelWithFallback(model.provider as ProviderId, [
            ...messages,
            {
              role: "system",
              content: `${memoryContext}\n\n${skillsContext}\n\nRepository context:\n${context}\n\nAdditional requested files:\n\n${extra}\n\nReturn the FINAL JSON plan now.`,
            },
          ]);
      plan = parsePlan(model.text);
    }

    if (plan.action !== "change") {
      const memorySaved = await remember("last_agent_result", { action: "answer", at: new Date().toISOString() }, "runtime", 20);
      return json({ text: plan.message, provider: model.provider, contributors: (model as any).contributors, available, action: "answer", memoryEnabled: Boolean(SUPABASE_SERVICE_ROLE_KEY), memorySaved });
    }

    if (!plan.files?.length) throw new PlanValidationError("Change plan has no files");
    if (plan.readFiles?.length) return json({ error: "More inspection is required before a commit" }, 422);
    const safeFiles = plan.files.map((f) => ({ path: validatePath(f.path), content: f.content }));
    if (new Set(safeFiles.map((f) => f.path)).size !== safeFiles.length) return json({ error: "Duplicate file paths" }, 422);
    if (safeFiles.some((f) => new TextEncoder().encode(f.content).length > 200_000) ||
        new TextEncoder().encode(JSON.stringify(safeFiles)).length > 1_000_000) {
      return json({ error: "Change plan exceeds file size limits" }, 422);
    }

    const githubAccess = await checkGithubWriteAccess();
    const executionEnabled = EXECUTION_REQUESTED && githubAccess.push;
    if (!executionEnabled || plan.commit !== true) {
      const memorySaved = await remember("last_agent_result", {
        action: "preview",
        fileCount: safeFiles.length,
        githubWriteConfigured: githubAccess.push,
        at: new Date().toISOString(),
      }, "runtime", 20);
      return json({
        text: plan.message,
        provider: model.provider,
        contributors: (model as any).contributors,
        available,
        action: "preview",
        memorySaved,
        executionEnabled,
        executionRequested: EXECUTION_REQUESTED,
        githubWriteConfigured: githubAccess.push,
        githubTokenConfigured: githubAccess.configured,
        githubReachable: githubAccess.reachable,
        files: safeFiles.map((f) => f.path),
      });
    }

    const branch = `agent/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await createBranch(branch);
    const commit = await commitFiles(
      safeFiles,
      plan.commitMessage || "chore(agent): apply requested changes",
      branch,
    );

    let prUrl: string | undefined;
    let prError: string | undefined;
    const compareUrl = `https://github.com/${REPO}/compare/main...${encodeURIComponent(branch)}?expand=1`;
    {
      try {
        const pr = await createPr(
          plan.prTitle || "Arts Agent: automated changes",
          branch,
          plan.message,
        );
        prUrl = pr?.html_url;
      } catch (error) {
        prError = error instanceof Error ? error.message : "Pull request creation failed";
      }
    }

    const memorySaved = await remember("last_agent_result", {
      action: "executed",
      branch,
      commitSha: commit.sha,
      prUrl,
      prError,
      compareUrl,
      at: new Date().toISOString(),
    }, "conversation", 80);
    return json({
      text: plan.message,
      provider: model.provider,
      contributors: (model as any).contributors,
      available,
      action: "executed",
      memorySaved,
      branch,
      commitSha: commit.sha,
      prUrl,
      prError,
      compareUrl,
      deployment: "supabase-edge",
    });
  } catch (error) {
    if (error instanceof PlanValidationError) return json({ error: error.message }, 422);
    const detail = error instanceof Error ? error.message : "Unknown agent failure";
    console.error("[arts-agent-api]", detail);
    return json({ error: "Agent request failed. Check server logs for details." }, 500);
  }
});
