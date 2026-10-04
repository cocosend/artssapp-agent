const base = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured");
  return { url: url.replace(/\/$/, ""), key };
};

async function request(path: string, init: RequestInit = {}) {
  const { url, key } = base();
  const response = await fetch(url + path, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function createSession(title = "New Agent Run") {
  const rows = await request("/rest/v1/agent_sessions", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return rows?.[0] ?? null;
}

export async function addMessage(sessionId: string, role: string, content: string) {
  return request("/rest/v1/agent_messages", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, role, content }),
  });
}

export async function createRun(sessionId: string, task: string) {
  const rows = await request("/rest/v1/agent_runs", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, task, status: "running" }),
  });
  return rows?.[0] ?? null;
}

export async function addEvent(runId: string, type: string, message: string, metadata: Record<string, unknown> = {}) {
  return request("/rest/v1/agent_events", {
    method: "POST",
    body: JSON.stringify({ run_id: runId, type, message, metadata }),
  });
}

export async function finishRun(runId: string, status: "completed" | "failed", result: string) {
  return request(`/rest/v1/agent_runs?id=eq.${encodeURIComponent(runId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, result, completed_at: new Date().toISOString() }),
  });
}
