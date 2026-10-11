import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeLocalChat, encodeLocalChat, decodeLocalChat } from "../lib/local-chat.ts";

test("session restore only retains bounded text, never images, files or external source URLs", () => {
  const stored = [
    { role: "user", content: "  Build a feature  ", imageUrl: "data:image/png;base64,AAAA", file: { name: ".env" } },
    { role: "assistant", content: "Feature ready", sources: [{ url: "https://example.org/private" }], meta: "Multi AI" },
  ];
  const recovered = decodeLocalChat(encodeLocalChat(stored));
  assert.deepEqual(recovered, [
    { role: "user", content: "Build a feature" },
    { role: "assistant", content: "Feature ready", meta: "Multi AI" },
  ]);
  assert.equal(encodeLocalChat(stored).includes("base64"), false);
  assert.deepEqual(Object.keys(recovered[1]).sort(), ["content", "meta", "role"]);
});

test("file importer contents are never stored in the browser session", () => {
  const data = [{ role: "user", content: "Файл: private-settings.md\n\nSECRET_FILE_CONTENT" },
    { role: "user", content: "Ordinary safe chat" }];
  const encoded = encodeLocalChat(data);
  assert.equal(encoded.includes("SECRET_FILE_CONTENT"), false);
  assert.deepEqual(decodeLocalChat(encoded), [{ role: "user", content: "Ordinary safe chat" }]);
});

test("malformed or oversized browser storage cannot crash chat hydration", () => {
  assert.deepEqual(decodeLocalChat("{not json"), []);
  assert.deepEqual(decodeLocalChat(JSON.stringify({ version: 999, messages: [{ role: "user", content: "a" }] })), []);
  assert.deepEqual(decodeLocalChat("x".repeat(60001)), []);
  assert.deepEqual(sanitizeLocalChat([{ role: "system", content: "instruction" }, { role: "user", content: "" }]), []);
});

test("payload stays within mobile PWA memory limits", () => {
  const turns = Array.from({ length: 100 }, (_, i) => ({ role: "user", content: String(i) + " x".repeat(7000) }));
  const cleaned = sanitizeLocalChat(turns);
  assert.ok(cleaned.length <= 24);
  assert.ok(cleaned.every(x => x.content.length <= 4800));
  assert.ok(cleaned.reduce((total, x) => total + x.content.length, 0) <= 32000);
  assert.equal(decodeLocalChat(encodeLocalChat(turns)).length, cleaned.length);
});
