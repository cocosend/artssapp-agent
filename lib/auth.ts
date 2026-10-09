import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "arts_agent_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function configuredPasswordDigest(): Buffer | null {
  // Prefer a hashed password: the actual access code must never live in source.
  const hash = process.env.AGENT_ACCESS_PASSWORD_SHA256?.trim();
  if (hash && /^[a-f0-9]{64}$/i.test(hash)) return Buffer.from(hash, "hex");

  // Support existing deployments during migration to the hashed setting.
  const legacyPassword = process.env.AGENT_ACCESS_PASSWORD;
  return legacyPassword ? digest(legacyPassword) : null;
}

function signingKey(): string | null {
  return process.env.AGENT_SESSION_SECRET || process.env.AGENT_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function signature(expiresAt: number, passwordDigest: Buffer, key: string): Buffer {
  return createHmac("sha256", key)
    .update("arts-agent-session/v2\0")
    .update(String(expiresAt))
    .update("\0")
    .update(passwordDigest)
    .digest();
}

export async function isAgentAuthenticated(): Promise<boolean> {
  const passwordDigest = configuredPasswordDigest();
  const key = signingKey();
  if (!passwordDigest || !key) return false;

  const cookie = (await cookies()).get(COOKIE)?.value;
  if (!cookie) return false;
  const match = /^v2\.(\d{10})\.([a-f0-9]{64})$/.exec(cookie);
  if (!match) return false;

  const expiresAt = Number(match[1]);
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt <= now || expiresAt > now + SESSION_LIFETIME_SECONDS) return false;

  const received = Buffer.from(match[2], "hex");
  return timingSafeEqual(received, signature(expiresAt, passwordDigest, key));
}

export async function setAgentSession(password: string): Promise<boolean> {
  const expectedDigest = configuredPasswordDigest();
  const key = signingKey();
  if (!expectedDigest || !key || password.length > 1024) return false;

  if (!timingSafeEqual(digest(password), expectedDigest)) return false;

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  const token = `v2.${expiresAt}.${signature(expiresAt, expectedDigest, key).toString("hex")}`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS,
  });
  return true;
}

export async function clearAgentSession(): Promise<void> {
  (await cookies()).set(COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
