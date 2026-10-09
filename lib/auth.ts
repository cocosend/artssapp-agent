import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

const COOKIE = "arts_agent_session";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function configuredPasswordDigest(): Buffer | null {
  const configuredHash = process.env.AGENT_ACCESS_PASSWORD_SHA256?.trim();
  if (configuredHash && /^[a-f0-9]{64}$/i.test(configuredHash)) {
    return Buffer.from(configuredHash, "hex");
  }
  const legacyPassword = process.env.AGENT_ACCESS_PASSWORD;
  return legacyPassword ? digest(legacyPassword) : null;
}

export async function isAgentAuthenticated() {
  const expectedDigest = configuredPasswordDigest();
  if (!expectedDigest) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const tokenDigest = Buffer.from(token, "hex");
  return timingSafeEqual(tokenDigest, expectedDigest);
}

export async function setAgentSession(password: string) {
  const expectedDigest = configuredPasswordDigest();
  if (!expectedDigest || password.length > 1024) return false;
  const suppliedDigest = digest(password);
  if (!timingSafeEqual(suppliedDigest, expectedDigest)) return false;
  (await cookies()).set(COOKIE, expectedDigest.toString("hex"), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function clearAgentSession() {
  (await cookies()).set(COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
