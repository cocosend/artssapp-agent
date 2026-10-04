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

const REPO = Deno.env.get("GITHUB_REPO") || "cocosend/artssapp-agent";
const SERVICE_KEY = Deno.env.get("AGENT_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GITHUB_WRITE_CONFIGURED = Boolean(Deno.env.get("GITHUB_TOKEN"));
const executionSetting = Deno.env.get("AGENT_EXECUTION_ENABLED");
const EXECUTION_ENABLED = executionSetting === "true" || (executionSetting == null && GITHUB_WRITE_CONFIGURED);
const MAX_MESSAGE_CHARS = 12000;
const MODEL_TIMEOUT_MS = 60000;
const GITHUB_TIMEOUT_MS = 30000;

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-agent-service-key",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

const SYSTEM = `You are Arts Agent, a software-engineering agent.
Inspect repository context before changing code. Never expose secrets.
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
      ["user", "assistant", "system"].includes(m.role) && typeof m.content === "string"
    )
    .slice(-20)
    .map((m) => ({ ...m, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
}

function validatePath(path: string) {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.startsWith(".env") || normalized.includes("/.env")) {
    throw new Error(`Blocked repository path: ${path}`);
  }
  return normalized;
}

function parsePlan(rawText: string): AgentPlan {
  const cleaned = rawText.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return { action: "answer", message: rawText };
  try {
    const value = JSON.parse(cleaned.slice(start, end + 1));
    const message = typeof value.message === "string" ? value.message : "Задача обработана.";
    if (value.action !== "change") return { action: "answer", message };
    const readFiles = Array.isArray(value.readFiles)
      ? value.readFiles.filter((x: unknown) => typeof x === "string").slice(0, 12)
      : [];
    const files = Array.isArray(value.files)
      ? value.files.filter((f: any) => f && typeof f.path === "string" && typeof f.content === "string").slice(0, 30)
      : [];
    return { ...value, action: "change", message, readFiles, files };
  } catch {
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

async function callOpenAI(messages: ChatMessage[]) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";
  const r = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, instructions: SYSTEM, input: messages, store: false }),
  }, MODEL_TIMEOUT_MS);
  const text = await r.text();
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${text.slice(0, 1200)}`);
  return extractOpenAIText(JSON.parse(text));
}

async function callDeepSeek(messages: ChatMessage[]) {
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
  if (!r.ok) throw new Error(`DeepSeek ${r.status}: ${text.slice(0, 1200)}`);
  return JSON.parse(text)?.choices?.[0]?.message?.content ?? "";
}

async function callGemini(messages: ChatMessage[]) {
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
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
      MODEL_TIMEOUT_MS,
    );
    const text = await r.text();
    if (r.ok) return JSON.parse(text)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("\n") ?? "";
    last = `Gemini ${model} ${r.status}: ${text.slice(0, 1200)}`;
    if (![429, 500, 502, 503, 504].includes(r.status)) break;
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
    throw new Error("All providers failed: " + detail);
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
    const ranked = successes.map((x) => ({ ...x, plan: parsePlan(x.text) })).sort((a, b) => {
      const as = (a.plan.action === "change" ? 10 : 0) + (a.plan.files?.length || 0);
      const bs = (b.plan.action === "change" ? 10 : 0) + (b.plan.files?.length || 0);
      return bs - as;
    });
    return { provider: "multi" as const, text: ranked[0].text, contributors: successes.map((x) => x.provider) };
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
  throw lastError instanceof Error ? lastError : new Error("All configured providers failed");
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

async function readRepoFile(path: string, ref = "main") {
  const data = await github(`/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`);
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
    return json({
      ok: true,
      service: "arts-agent-api",
      version: "v4-direct",
      runtime: "supabase-edge",
      repository: REPO,
      providers: configuredProviders(),
      modes: ["multi", ...configuredProviders()],
      executionEnabled: EXECUTION_ENABLED,
      githubWriteConfigured: GITHUB_WRITE_CONFIGURED,
      dedicatedServiceKeyConfigured: Boolean(Deno.env.get("AGENT_SERVICE_KEY")),
      vercelRequired: false,
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!SERVICE_KEY) return json({ error: "Service authentication is not configured" }, 503);
  const supplied = req.headers.get("x-agent-service-key") || "";
  if (supplied !== SERVICE_KEY) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json();
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

    const context = await repoContext();
    let model = provider === "multi"
      ? await runMultiModel([
          ...messages,
          { role: "system", content: `Repository context:\n\n${context}` },
        ])
      : await runModelWithFallback(provider, [
          ...messages,
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
              content: `Repository context already inspected. Additional requested files:\n\n${extra}\n\nReturn the FINAL JSON plan now.`,
            },
          ])
        : await runModelWithFallback(model.provider as ProviderId, [
            ...messages,
            {
              role: "system",
              content: `Repository context already inspected. Additional requested files:\n\n${extra}\n\nReturn the FINAL JSON plan now.`,
            },
          ]);
      plan = parsePlan(model.text);
    }

    if (plan.action !== "change" || !plan.files?.length) {
      return json({ text: plan.message, provider: model.provider, contributors: (model as any).contributors, available, action: "answer" });
    }

    const safeFiles = plan.files.map((f) => ({ path: validatePath(f.path), content: f.content }));

    if (!EXECUTION_ENABLED || !GITHUB_WRITE_CONFIGURED || plan.commit !== true) {
      return json({
        text: plan.message,
        provider: model.provider,
        contributors: (model as any).contributors,
        available,
        action: "preview",
        executionEnabled: EXECUTION_ENABLED,
        githubWriteConfigured: GITHUB_WRITE_CONFIGURED,
        files: safeFiles.map((f) => f.path),
      });
    }

    const branch = `agent/${Date.now()}`;
    await createBranch(branch);
    const commit = await commitFiles(
      safeFiles,
      plan.commitMessage || "chore(agent): apply requested changes",
      branch,
    );

    let prUrl: string | undefined;
    if (plan.createPr !== false) {
      const pr = await createPr(
        plan.prTitle || "Arts Agent: automated changes",
        branch,
        plan.message,
      );
      prUrl = pr?.html_url;
    }

    return json({
      text: plan.message,
      provider: model.provider,
      contributors: (model as any).contributors,
      available,
      action: "executed",
      branch,
      commitSha: commit.sha,
      prUrl,
      deployment: "supabase-edge",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent request failed";
    console.error("[arts-agent-api]", message);
    return json({ error: message }, 500);
  }
});