import test from "node:test";
import assert from "node:assert/strict";
import { runModelWithFallback } from "../lib/providers.ts";

const keys = ["OPENAI_API_KEY", "DEEPSEEK_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY",
  "CLAUDE_API_KEY", "MISTRAL_API_KEY", "AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN"];

async function stubbedEnv(values, fetchFn, run) {
  const original = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const oldFetch = globalThis.fetch;
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, values);
    globalThis.fetch = fetchFn;
    await run();
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

const ask = [{ role: "user", content: "Explain this code" }];

test("multiagent report only claims models that actually answered, with real judge synthesis", async () => {
  let judgeCalls = 0;
  await stubbedEnv({ OPENAI_API_KEY: "test", DEEPSEEK_API_KEY: "test", GEMINI_API_KEY: "test" },
    async url => {
      const u = new URL(String(url));
      if (u.origin === "https://api.openai.com") {
        judgeCalls++;
        return new Response(JSON.stringify({ output_text: judgeCalls === 2 ? "combined result" : "openai answer" }), { status: 200 });
      }
      if (u.origin === "https://api.deepseek.com") {
        return new Response(JSON.stringify({ choices: [{ message: { content: "deepseek answer" } }] }), { status: 200 });
      }
      if (u.origin === "https://generativelanguage.googleapis.com") return new Response("unavailable", { status: 503 });
      throw new Error("Unexpected model URL");
    },
    async () => {
      const result = await runModelWithFallback("multi", ask);
      assert.equal(result.text, "combined result");
      assert.equal(result.provider, "multi");
      assert.deepEqual(result.orchestration.attempted, ["openai", "deepseek", "gemini"]);
      assert.deepEqual(result.orchestration.contributors, ["openai", "deepseek"]);
      assert.deepEqual(result.orchestration.failed, ["gemini"]);
      assert.equal(result.orchestration.synthesized, true);
      assert.equal(result.orchestration.judge, "openai");
      assert.equal(judgeCalls, 2);
    });
});

test("multiagent report does not claim synthesis or contributions when one model fails", async () => {
  await stubbedEnv({ OPENAI_API_KEY: "test", DEEPSEEK_API_KEY: "test" },
    async url => {
      const u = new URL(String(url));
      if (u.origin === "https://api.openai.com") return new Response("failed", { status: 502 });
      if (u.origin === "https://api.deepseek.com") return new Response(JSON.stringify({
        choices: [{ message: { content: "deepseek useful answer" } }],
      }), { status: 200 });
      throw new Error("Unexpected URL");
    }, async () => {
      const result = await runModelWithFallback("multi", ask);
      assert.equal(result.provider, "deepseek");
      assert.deepEqual(result.orchestration.attempted, ["openai", "deepseek"]);
      assert.deepEqual(result.orchestration.contributors, ["deepseek"]);
      assert.deepEqual(result.orchestration.failed, ["openai"]);
      assert.equal(result.orchestration.synthesized, false);
    });
});
