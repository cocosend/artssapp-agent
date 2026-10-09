import test from "node:test";
import assert from "node:assert/strict";
import { runModel, runModelWithFallback } from "../lib/providers.ts";

const secrets = ["OPENAI_API_KEY", "DEEPSEEK_API_KEY", "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "MISTRAL_API_KEY", "AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN"];
async function withMocks(environment, fetchMock, task) {
  const old = Object.fromEntries(secrets.map(key => [key, process.env[key]]));
  const previousFetch = globalThis.fetch;
  try {
    for (const key of secrets) delete process.env[key];
    Object.assign(process.env, environment);
    globalThis.fetch = fetchMock;
    await task();
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of secrets) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
}

test("Gemini receives repository and safety context in systemInstruction, not as a user message", async () => {
  await withMocks({ GEMINI_API_KEY: "mock-gemini-key" }, async (url, init) => {
    assert.equal(new URL(String(url)).origin, "https://generativelanguage.googleapis.com");
    const body = JSON.parse(init.body);
    const instructions = body.systemInstruction.parts[0].text;
    assert.match(instructions, /ARTSS repository context/);
    assert.match(instructions, /Return ONLY valid JSON/);
    assert.match(instructions, /senior engineer/);
    assert.equal(body.contents.length, 1);
    assert.equal(body.contents[0].parts[0].text, "Improve the function");
    assert.equal(body.contents[0].role, "user");
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Gemini answer" }] } }] }), { status: 200 });
  }, async () => {
    const text = await runModel("gemini", [
      { role: "user", content: "Improve the function" },
      { role: "system", content: "ARTSS repository context. Return ONLY valid JSON." },
    ]);
    assert.equal(text, "Gemini answer");
  });
});

test("skip signal stops in-flight model requests without trying more models", async () => {
  const controller = new AbortController();
  const called = [];
  await withMocks({ OPENAI_API_KEY: "mock-openai", DEEPSEEK_API_KEY: "mock-deepseek", GEMINI_API_KEY: "mock-gemini" },
    async (url, init) => {
      called.push(new URL(String(url)).origin);
      return new Promise((resolve, reject) => {
        if (init.signal?.aborted) { reject(init.signal.reason); return; }
        init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true });
      });
    }, async () => {
      const running = runModelWithFallback("multi", [{ role: "user", content: "Test cancellation" }], controller.signal);
      queueMicrotask(() => controller.abort());
      await assert.rejects(running, { name: "AbortError" });
      assert.equal(called.length, 3, "only initial three models should be called");
    });
});
