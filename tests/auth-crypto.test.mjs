import test from "node:test";
import assert from "node:assert/strict";
import { verifyAccessPassword, issueSignedSession, verifySignedSession } from "../lib/auth-crypto.ts";

test("scrypt validates correct access code and rejects wrong passwords", async () => {
  const key = "server-owned-independent-secret-not-a-password";
  assert.equal(await verifyAccessPassword("correct-passcode", "correct-passcode", key), true);
  assert.equal(await verifyAccessPassword("incorrect", "correct-passcode", key), false);
  assert.equal(await verifyAccessPassword("", "correct-passcode", key), false);
});

test("signed cookie is unforgeable, unique and expires after 30 days", () => {
  const key = "very-long-server-owned-cookie-secret";
  const t0 = 1800000000;
  const a = issueSignedSession(key, t0), b = issueSignedSession(key, t0);
  assert.notEqual(a, b, "cookie nonces must be random");
  assert.equal(verifySignedSession(a, key, t0 + 10), true);
  assert.equal(verifySignedSession(a, key, t0 + 60 * 60 * 24 * 31), false);
  assert.equal(verifySignedSession(a, "different-signing-key", t0 + 1), false);
  assert.equal(verifySignedSession(a.replace(/.$/, a.endsWith("a") ? "b" : "a"), key, t0), false);
  assert.equal(verifySignedSession("ffffffffffffffffffffffff", key), false);
});

test("legacy SHA256 cookies are rejected and password is not included in cookie", () => {
  const key = "server-secret-v2";
  const token = issueSignedSession(key, 1800000000);
  assert.equal(token.includes("my-secret-password"), false);
  assert.equal(verifySignedSession("a".repeat(64), key, 1800000000), false);
});
