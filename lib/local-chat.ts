// Keep only opt-in TEXT conversation history in sessionStorage; never retain image data,
// raw provider responses or external source URLs. No server-side persistence is added.
export type LocalChatTurn = { role: "user" | "assistant"; content: string; meta?: string };
const MAX_TURNS = 24;
const MAX_TURN_CHARS = 4800;
const MAX_TOTAL_CHARS = 32000;

export function sanitizeLocalChat(input: unknown): LocalChatTurn[] {
  if (!Array.isArray(input)) return [];
  let budget = MAX_TOTAL_CHARS;
  const result: LocalChatTurn[] = [];
  for (const candidate of input.slice(-MAX_TURNS).reverse()) {
    if (budget <= 0) break;
    if (!candidate || typeof candidate !== "object" ||
        (candidate.role !== "user" && candidate.role !== "assistant") ||
        typeof candidate.content !== "string") continue;
    const content = candidate.content.slice(0, Math.min(MAX_TURN_CHARS, budget)).trim();
    if (!content) continue;
    budget -= content.length;
    const meta = typeof candidate.meta === "string" ? candidate.meta.slice(0, 100) : undefined;
    result.push({ role: candidate.role, content, ...(meta ? { meta } : {}) });
  }
  return result.reverse();
}

export function encodeLocalChat(input: unknown): string {
  return JSON.stringify({ version: 1, messages: sanitizeLocalChat(input) });
}

export function decodeLocalChat(raw: string | null): LocalChatTurn[] {
  if (!raw || raw.length > 60000) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("version" in value) ||
        value.version !== 1 || !("messages" in value)) return [];
    return sanitizeLocalChat(value.messages);
  } catch {
    return [];
  }
}
