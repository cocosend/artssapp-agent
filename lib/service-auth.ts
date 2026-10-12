import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Authorize server-to-server calls without accepting database service-role keys.
 * Both secrets are server-only. Never expose their values through responses or logs.
 */
export function isAgentServiceAuthorized(request: Request): boolean {
  const supplied = request.headers.get("x-agent-service-key")?.trim();
  if (!supplied || supplied.length > 512) return false;

  const input = createHash("sha256").update(supplied).digest();
  return ["AGENT_SERVICE_KEY", "AGENT_EVE_BRIDGE_KEY"].some((name) => {
    const expected = process.env[name]?.trim();
    if (!expected) return false;
    return timingSafeEqual(input, createHash("sha256").update(expected).digest());
  });
}
