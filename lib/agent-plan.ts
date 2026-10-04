export type AgentAction = "answer" | "change";

export type AgentFile = {
  path: string;
  content: string;
};

export type AgentPlan = {
  action: AgentAction;
  message: string;
  commit?: boolean;
  createPr?: boolean;
  deploy?: boolean;
  deployTarget?: "preview" | "production";
  branch?: string;
  commitMessage?: string;
  prTitle?: string;
  readFiles?: string[];
  files?: AgentFile[];
};

export function parsePlan(raw: string): AgentPlan {
  const cleaned = raw.trim().replace(/^\`\`\`(?:json)?/i, "").replace(/\`\`\`$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return { action: "answer", message: raw };

  try {
    const value = JSON.parse(cleaned.slice(start, end + 1)) as AgentPlan;
    const message = value.message || "Задача оброблена.";
    const readFiles = Array.isArray(value.readFiles)
      ? value.readFiles.filter((p): p is string => typeof p === "string").slice(0, 12)
      : [];
    const files = Array.isArray(value.files)
      ? value.files.filter((f) => f && typeof f.path === "string" && typeof f.content === "string").slice(0, 30)
      : [];

    if (value.action !== "change") return { action: "answer", message };

    return { ...value, action: "change", message, readFiles, files };
  } catch {
    return { action: "answer", message: raw };
  }
}

export function validatePath(path: string) {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.startsWith(".env") || normalized.includes("/.env")) {
    throw new Error(`Blocked repository path: ${path}`);
  }
  return normalized;
}
