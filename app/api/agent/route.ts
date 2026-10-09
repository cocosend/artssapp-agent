import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { configuredProviders, runModelWithFallback, type ChatMessage, type ProviderId, type AgentMode } from "@/lib/providers";
import { addEvent, addMessage, createRun, createSession, finishRun } from "@/lib/supabase";
import { createBranch, createPullRequest, deployVercel, listRepo, readRepoFile, commitFiles } from "@/lib/github";
import { parsePlan, validatePath } from "@/lib/agent-plan";
import { isAgentAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";

const REPO = process.env.GITHUB_REPO || "cocosend/artssapp-agent";
const MAX_MESSAGE_CHARS = 12_000;
const SYSTEM_APPEND = `
Return ONLY valid JSON, with no markdown fences.
Schema:
{"action":"answer"|"change","message":"string","commit":boolean,"createPr":boolean,"deploy":boolean,"deployTarget":"preview"|"production","branch":"string","commitMessage":"string","prTitle":"string","readFiles":["path"],"files":[{"path":"string","content":"complete file contents"}]}
For action=answer, files may be [].
For action=change, use readFiles when you need the server to inspect additional repository files before producing the final edit plan.
After inspection context is provided, return the final change plan with complete contents for every file that must be changed.
Do not include secrets, .env files, tokens, credentials, or private keys.
Set commit=true when the user asks to save, commit, implement, or apply the requested code changes. Set commit=false for preview-only requests.
Set createPr=true when changes should be proposed through a pull request; otherwise false.
Set deploy=true only when the user explicitly asks for deployment. Use deployTarget=preview unless production deployment is explicitly requested.
Never write directly to main. The execution engine always creates an agent branch.
If the repository context is insufficient and no specific files can be identified, return action=answer and explain what is missing.
`;

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m): m is ChatMessage =>
      Boolean(m) &&
      typeof m === "object" &&
      ["user", "assistant"].includes((m as ChatMessage).role) &&
      typeof (m as ChatMessage).content === "string",
    )
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
}

async function repoContext() {
  try {
    const root = await listRepo(REPO, "", "main");
    const names = Array.isArray(root) ? root.map((x: any) => x.path).slice(0, 100) : [];
    const important = [
      "package.json",
      "README.md",
      "app/page.tsx",
      "app/globals.css",
      "app/api/agent/route.ts",
      "lib/agent-plan.ts",
      "lib/providers.ts",
      "lib/github.ts",
      "lib/supabase.ts",
    ];
    const files = await Promise.all(important.map(async (path) => {
      try {
        const data = await readRepoFile(REPO, path, "main");
        return `FILE: ${path}\n${Buffer.from(data.content, "base64").toString("utf8").slice(0, 18_000)}`;
      } catch {
        return `FILE: ${path}\n<not found>`;
      }
    }));
    return `REPOSITORY: ${REPO}\nROOT: ${names.join(", ")}\n\n${files.join("\n\n")}`;
  } catch (error) {
    return `REPOSITORY: ${REPO}\nGitHub context unavailable: ${error instanceof Error ? error.message : "unknown error"}`;
  }
}

async function inspectRequestedFiles(paths: string[]) {
  const safePaths = paths.map(validatePath).slice(0, 12);
  const results = await Promise.all(safePaths.map(async (path) => {
    try {
      const data = await readRepoFile(REPO, path, "main");
      return `FILE: ${path}\n${Buffer.from(data.content, "base64").toString("utf8").slice(0, 18_000)}`;
    } catch (error) {
      return `FILE: ${path}\n<unavailable: ${error instanceof Error ? error.message : "unknown error"}>`;
    }
  }));
  return results.join("\n\n");
}

// Persistence must never turn a completed model response into a failed request.
async function safeAddEvent(runId: string, type: string, message: string, metadata: Record<string, unknown> = {}) {
  try { await addEvent(runId, type, message, metadata); } catch { /* Database logging is optional. */ }
}
async function safeFinishRun(runId: string, status: "completed" | "failed", result: string) {
  try { await finishRun(runId, status, result); } catch { /* Database persistence is optional. */ }
}

export async function POST(req: Request) {
  const serviceKey = req.headers.get("x-agent-service-key");
  // Never accept a Supabase service-role key as an agent authentication secret.
  const expectedServiceKey = process.env.AGENT_SERVICE_KEY;
  const serviceAuthorized = Boolean(serviceKey && expectedServiceKey && timingSafeEqual(
    createHash("sha256").update(serviceKey).digest(),
    createHash("sha256").update(expectedServiceKey).digest(),
  ));
  if (!serviceAuthorized && !(await isAgentAuthenticated())) {
    return NextResponse.json({ error: "Authentication required. Open /login." }, { status: 401 });
  }

  let sessionId: string | undefined;
  let runId: string | undefined;

  try {
    const body = await req.json();
    const messages = normalizeMessages(body?.messages);
    const requested = body?.provider as AgentMode | undefined;
    const available = configuredProviders();

    if (!messages.length) return NextResponse.json({ error: "messages is required" }, { status: 400 });
    if (!available.length) {
      return NextResponse.json({
        error: "No AI provider is configured.",
        setup: ["OPENAI_API_KEY", "DEEPSEEK_API_KEY", "GEMINI_API_KEY"],
      }, { status: 503 });
    }

    const provider: AgentMode = requested === "multi" ? "multi" : requested && available.includes(requested as ProviderId) ? requested : available[0];
    const task = messages.filter((m) => m.role === "user").at(-1)?.content || "Agent task";

    try {
      const session = await createSession(task.slice(0, 120));
      sessionId = session?.id;
      if (sessionId) {
        const run = await createRun(sessionId, task);
        runId = run?.id;
        if (runId) await safeAddEvent(runId, "thinking", "Агент аналізує задачу та репозиторій.");
        await addMessage(sessionId, "user", task);
      }
    } catch {
      // Persistence is optional; the agent can continue without Supabase.
    }

    const context = await repoContext();
    const baseMessages: ChatMessage[] = [
      ...messages,
      { role: "system", content: `You have repository context below. ${SYSTEM_APPEND}\n\n${context}` },
    ];

    let modelResult = await runModelWithFallback(provider, baseMessages);
    let plan = parsePlan(modelResult.text);

    if (plan.readFiles?.length) {
      if (runId) await safeAddEvent(runId, "inspecting", `Читаю ${plan.readFiles.length} додаткових файлів репозиторію.`, { files: plan.readFiles });
      const inspected = await inspectRequestedFiles(plan.readFiles);
      const inspectionMessages: ChatMessage[] = [
        ...messages,
        {
          role: "system",
          content: `You already inspected the base repository context. Here are the additional requested files. Produce the FINAL JSON plan now. Do not request more files unless absolutely necessary.\n\n${SYSTEM_APPEND}\n\nADDITIONAL FILES:\n${inspected}`,
        },
      ];
      modelResult = await runModelWithFallback(modelResult.provider, inspectionMessages);
      plan = parsePlan(modelResult.text);
    }

    const activeProvider = modelResult.provider;

    if (plan.action !== "change" || !plan.files?.length) {
      if (runId) {
        await safeAddEvent(runId, "completed", "Задача оброблена без змін у GitHub.");
        await safeFinishRun(runId, "completed", plan.message);
      }
      return NextResponse.json({ text: plan.message, provider: activeProvider, contributors: modelResult.contributors, orchestration: modelResult.orchestration, available, action: "answer" });
    }

    const safeFiles = plan.files.map((file) => ({
      path: validatePath(file.path),
      content: file.content,
    }));

    if (runId) await safeAddEvent(runId, "editing", `Підготовлено ${safeFiles.length} файлів.`, { files: safeFiles.map((f) => f.path) });

    const executionEnabled = process.env.AGENT_EXECUTION_ENABLED === "true" && Boolean(process.env.GITHUB_TOKEN?.trim());
    if (!executionEnabled || plan.commit !== true) {
      const text = `${plan.message}\n\nПідготовлено файли: ${safeFiles.map((f) => f.path).join(", ")}.\n\nРежим preview: зміни не записані в GitHub.${!process.env.GITHUB_TOKEN ? "\nВідсутній токен GitHub для запису." : ""}`;
      if (runId) await safeFinishRun(runId, "completed", text);
      return NextResponse.json({ text, provider: activeProvider, contributors: modelResult.contributors, orchestration: modelResult.orchestration, available, action: "preview", files: safeFiles.map((f) => f.path) });
    }

    // A skipped HTTP request must not start a new GitHub write after the model finishes.
    if (req.signal.aborted) return NextResponse.json({ error: "Request cancelled before GitHub execution." }, { status: 499 });
    if (req.signal.aborted) return NextResponse.json({ error: "Request was cancelled before code changes." }, { status: 499 });
    const branch = `agent/${Date.now()}`;
    await createBranch(REPO, branch, "main");
    if (runId) await safeAddEvent(runId, "branch", `Створено гілку ${branch}.`, { branch });

    if (req.signal.aborted) return NextResponse.json({ error: "Request cancelled before commit." }, { status: 499 });
    if (req.signal.aborted) return NextResponse.json({ error: "Request was cancelled before commit." }, { status: 499 });

    const commit = await commitFiles(
      REPO,
      safeFiles,
      plan.commitMessage || "chore(agent): apply requested changes",
      branch,
    );
    if (runId) await safeAddEvent(runId, "commit", `Створено atomic commit ${commit.sha}.`, { branch, commit: commit.sha });

    let prUrl: string | undefined;
    if (req.signal.aborted) return NextResponse.json({ error: "Request cancelled after commit; branch preserved." }, { status: 499 });
    if (plan.createPr) {
      const pr = await createPullRequest(
        REPO,
        plan.prTitle || "Arts Agent: automated changes",
        branch,
        "main",
        plan.message,
      );
      prUrl = pr?.html_url;
      if (runId) await safeAddEvent(runId, "pr", prUrl || "Pull request created.", { branch });
    }

    let deploymentUrl: string | undefined;
    if (req.signal.aborted) return NextResponse.json({ error: "Request cancelled before deployment." }, { status: 499 });
    if (plan.deploy) {
      const target = plan.deployTarget === "production" ? "production" : "preview";
      if (target === "production") {
        throw new Error("Production deployment is blocked until the agent branch is merged. Request a preview deployment or merge the PR first.");
      }
      if (runId) await safeAddEvent(runId, "deploying", `Запускаю Vercel ${target} deployment для ${branch}.`);
      const deployment = await deployVercel(undefined, target, branch);
      deploymentUrl = deployment?.url ? `https://${deployment.url}` : deployment?.inspectorUrl;
      if (runId) await safeAddEvent(runId, "deployed", deploymentUrl || "Vercel deployment started.", { branch, target });
    }

    const result = `${plan.message}\n\nCommit: ${commit.sha}\nBranch: ${branch}${prUrl ? `\nPR: ${prUrl}` : ""}${deploymentUrl ? `\nDeploy: ${deploymentUrl}` : ""}`;
    if (runId) await safeFinishRun(runId, "completed", result);

    return NextResponse.json({
      text: result,
      provider: activeProvider,
      contributors: modelResult.contributors,
      orchestration: modelResult.orchestration,
      available,
      action: "executed",
      branch,
      commitSha: commit.sha,
      prUrl,
      deploymentUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent request failed";
    if (runId) {
      try {
        await safeAddEvent(runId, "failed", message);
        await safeFinishRun(runId, "failed", message);
      } catch {}
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
