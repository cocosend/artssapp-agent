import type { AgentResponse, ChatMessage, Health, ProviderId } from "./types";

export const GATEWAY =
  "https://hyvsmtxewxpfnlzfjvca.supabase.co/functions/v1/artss-agent";

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const response = await fetch(`${GATEWAY}?health=1`, { signal });
  if (!response.ok) throw new Error(`Health failed: ${response.status}`);
  return response.json();
}

export async function runAgent(
  accessCode: string,
  provider: ProviderId,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<AgentResponse> {
  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-artss-access": accessCode,
    },
    body: JSON.stringify({ provider, messages }),
    signal,
  });

  const body = (await response.json()) as AgentResponse;
  if (response.status === 401) {
    const error = new Error("UNAUTHORIZED");
    error.name = "UnauthorizedError";
    throw error;
  }
  if (!response.ok) throw new Error(body.error || `Request failed: ${response.status}`);
  return body;
}
