const API = "https://api.github.com";
const GITHUB_TIMEOUT_MS = 30_000;

import { getVercelOidcTokenSync } from "@vercel/oidc";

const CONNECTOR_UID = "github/artssapp-agent";
const CONNECT_TOKEN_TIMEOUT_MS = 12_000;
let cachedConnectToken: { value: string; validUntil: number } | undefined;
let inFlightConnectToken: Promise<string> | undefined;

/** Use the project-scoped GitHub App installation; no personal access token is required. */
export async function getGithubToken(): Promise<string | undefined> {
  const personalToken = process.env.GITHUB_TOKEN?.trim();
  if (personalToken) return personalToken;

  let oidc: string | undefined;
  try {
    oidc = getVercelOidcTokenSync() || process.env.VERCEL_OIDC_TOKEN?.trim();
  } catch {
    oidc = process.env.VERCEL_OIDC_TOKEN?.trim();
  }
  if (!oidc) return undefined;

  if (cachedConnectToken && Date.now() < cachedConnectToken.validUntil) {
    return cachedConnectToken.value;
  }
  if (!inFlightConnectToken) {
    inFlightConnectToken = (async () => {
      const connector = process.env.GITHUB_CONNECTOR?.trim() || CONNECTOR_UID;
      const response = await fetch(
        `https://api.vercel.com/v1/connect/token/${encodeURIComponent(connector)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${oidc}`, "Content-Type": "application/json" },
          body: JSON.stringify({ subject: { type: "app" } }),
          cache: "no-store",
          signal: AbortSignal.timeout(CONNECT_TOKEN_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        throw new Error(`GitHub Vercel Connect authorization failed (HTTP ${response.status}).`);
      }
      const data = (await response.json()) as { token?: string; expiresAt?: string | number };
      if (typeof data.token !== "string" || !data.token) {
        throw new Error("GitHub Vercel Connect did not return an installation token.");
      }
      const expiry = typeof data.expiresAt === "number"
        ? data.expiresAt > 1e12 ? data.expiresAt : data.expiresAt * 1000
        : typeof data.expiresAt === "string" ? Date.parse(data.expiresAt) : NaN;
      cachedConnectToken = {
        value: data.token,
        validUntil: Number.isFinite(expiry)
          ? Math.max(Date.now() + 1_000, expiry - 60_000)
          : Date.now() + 60_000,
      };
      return data.token;
    })().finally(() => { inFlightConnectToken = undefined; });
  }
  return inFlightConnectToken;
}

async function authHeaders(method: string) {
  let token: string | undefined;
  try {
    token = await getGithubToken();
  } catch (error) {
    if (method !== "GET") throw error;
    // Public read access must remain functional if Connect is unavailable.
  }
  if (!token && method !== "GET") {
    throw new Error("GitHub write access is unavailable: configure GITHUB_TOKEN or authorize the Vercel Connect GitHub App.");
  }
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export async function github(path: string, init: RequestInit = {}) {
  const r = await fetch(API + path, {
    ...init,
    headers: { ...(await authHeaders((init.method || "GET").toUpperCase())), ...(init.headers || {}) },
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(GITHUB_TIMEOUT_MS),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`GitHub API HTTP ${r.status} while accessing ${path.split("?")[0]}`);
  return text ? JSON.parse(text) : null;
}

export async function getRepo(repo = process.env.GITHUB_REPO || "cocosend/artssapp-agent") {
  return github(`/repos/${repo}`);
}

export async function listRepo(repo = process.env.GITHUB_REPO || "cocosend/artssapp-agent", path = "", ref = "main") {
  const q = `?ref=${encodeURIComponent(ref)}`;
  return github(`/repos/${repo}/contents/${path}${q}`);
}

export async function readRepoFile(repo: string, path: string, ref = "main") {
  return github(`/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`);
}

export async function getBranchHead(repo: string, branch = "main") {
  return github(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
}

export async function createBranch(repo: string, branch: string, from = "main") {
  const base = await getBranchHead(repo, from);
  return github(`/repos/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }),
  });
}

export async function commitFiles(
  repo: string,
  files: Array<{ path: string; content: string }>,
  message: string,
  branch = "main",
) {
  if (!files.length) throw new Error("No files supplied for commit.");

  const head = await getBranchHead(repo, branch);
  const parentSha = head.object.sha;
  const parent = await github(`/repos/${repo}/git/commits/${parentSha}`);
  const baseTree = parent.tree.sha;

  const tree = await github(`/repos/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTree,
      tree: files.map((file) => ({ path: file.path, mode: "100644", type: "blob", content: file.content })),
    }),
  });

  const commit = await github(`/repos/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
  });

  const updated = await github(`/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return { ...commit, ref: updated.ref };
}

export async function commitFile(repo: string, path: string, content: string, message: string, branch = "main", sha?: string) {
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;
  return github(`/repos/${repo}/contents/${path}`, { method: "PUT", body: JSON.stringify(body) });
}

export async function createPullRequest(repo: string, title: string, head: string, base = "main", body = "") {
  return github(`/repos/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, head, base, body }),
  });
}

export async function deployVercel(
  name = process.env.VERCEL_PROJECT_NAME || "artssapp-agent",
  target: "preview" | "production" = "preview",
  ref = "main",
) {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN is not configured");
  const team = process.env.VERCEL_TEAM_ID;
  const params = team ? `?teamId=${encodeURIComponent(team)}` : "";
  const response = await fetch(`https://api.vercel.com/v13/deployments${params}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      target,
      gitSource: { type: "github", repoId: Number(process.env.VERCEL_GITHUB_REPO_ID || "1404333676"), ref },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Vercel ${response.status}: ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : null;
}
