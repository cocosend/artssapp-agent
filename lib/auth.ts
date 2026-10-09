import { cookies } from "next/headers";
import { issueSignedSession, verifyAccessPassword, verifySignedSession } from "./auth-crypto";

const COOKIE = "arts_agent_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function secret() {
  // An independent server-only secret is required: never sign cookies with the user password.
  return process.env.AGENT_SESSION_SECRET?.trim() || process.env.AGENT_SERVICE_KEY?.trim();
}

export async function isAgentAuthenticated() {
  const key = secret();
  if (!key || !process.env.AGENT_ACCESS_PASSWORD) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  return verifySignedSession(token, key);
}

export async function setAgentSession(password: string) {
  const expected = process.env.AGENT_ACCESS_PASSWORD;
  const key = secret();
  if (!expected || !key) return false;
  const matches = await verifyAccessPassword(password, expected, key);
  if (!matches) return false;
  (await cookies()).set(COOKIE, issueSignedSession(key), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
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
