import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_PREFIX = "v2";

function purposeKey(secret: string, purpose: string): Buffer {
  return createHmac("sha256", secret).update(purpose).digest();
}

function passwordSalt(secret: string): Buffer {
  return purposeKey(secret, "ARTSS credential-check salt v2");
}

export async function verifyAccessPassword(input: string, expected: string, secret: string): Promise<boolean> {
  if (!input || !expected || !secret || input.length > 128) return false;
  const salt = passwordSalt(secret);
  const [a, b] = await Promise.all([
    scrypt(input, salt, 64) as Promise<Buffer>,
    scrypt(expected, salt, 64) as Promise<Buffer>,
  ]);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function issueSignedSession(secret: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const nonce = randomBytes(24).toString("base64url");
  const body = SESSION_PREFIX + "." + nowSeconds + "." + nonce;
  const signingKey = purposeKey(secret, "ARTSS cookie-signing key v2");
  const signature = createHmac("sha256", signingKey).update(body).digest("hex");
  return body + "." + signature;
}

export function verifySignedSession(token: string | undefined, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!token || !secret || token.length > 250) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== SESSION_PREFIX || !/^\d{10}$/.test(parts[1]) ||
      !/^[a-zA-Z0-9_-]{32}$/.test(parts[2]) || !/^[0-9a-f]{64}$/.test(parts[3])) return false;
  const issued = Number(parts[1]);
  const age = nowSeconds - issued;
  if (age < -120 || age > SESSION_TTL_SECONDS) return false;
  const body = parts.slice(0, 3).join(".");
  const signingKey = purposeKey(secret, "ARTSS cookie-signing key v2");
  const expected = createHmac("sha256", signingKey).update(body).digest();
  return timingSafeEqual(Buffer.from(parts[3], "hex"), expected);
}
