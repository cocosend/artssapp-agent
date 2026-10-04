import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

const COOKIE = "arts_agent_session";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export async function isAgentAuthenticated() {
  const expected = process.env.AGENT_ACCESS_PASSWORD;
  if (!expected) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  const expectedDigest = digest(expected);
  const tokenDigest = Buffer.from(token, "hex");
  return tokenDigest.length === expectedDigest.length && timingSafeEqual(tokenDigest, expectedDigest);
}

export async function setAgentSession(password: string) {
  const expected = process.env.AGENT_ACCESS_PASSWORD;
  if (!expected) return false;

  const suppliedDigest = digest(password);
  const expectedDigest = digest(expected);
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
