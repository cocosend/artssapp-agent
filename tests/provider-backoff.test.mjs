import test from "node:test";
import assert from "node:assert/strict";
import { runModelWithFallback } from "../lib/providers.ts";

test("provider cooldown avoids repeating 402 and 429 failures but permits explicit retry", async () => {
  const names = [
    "OPENAI_API_KEY", "DEEPSEEK_API_KEY", "GEMINI_API_KEY",
    "ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "MISTRAL_API_KEY",
    "AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN",
  ];
  const originals = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  const hits = { openai: 0, deepseek: 0 };
  try {
    for (const name of names) delete process.env[name];
    process.env.OPENAI_API_KEY = "test-openai";
    process.env.DEEPSEEK_API_KEY = "test-deepseek";
    globalThis.fetch = async url => {
      const origin = new URL(String(url)).origin;
      if (origin === "https://api.openai.com") {
        hits.openai++;
        return new Response("private-openai-error-body", { status: 429 });
      }
      if (origin === "https://api.deepseek.com") {
        hits.deepseek++;
        return new Response("private-deepseek-error-body", { status: 402 });
      }
      throw new Error("Unexpected upstream " + origin);
    };
    const ask = [{ role: "user", content: "Check the repository" }];
    for (let i = 0; i < 2; i++) {
      await assert.rejects(() => runModelWithFallback("multi", ask), error => {
        assert.match(error.message, /openai: HTTP 429/);
        assert.match(error.message, /deepseek: HTTP 402/);
        assert.doesNotMatch(error.message, /private-openai-error-body|private-deepseek-error-body/);
        return true;
      });
    }
    assert.deepEqual(hits, { openai: 1, deepseek: 1 }, "repeated multi requests must not re-hit blocked providers");
    await assert.rejects(() => runModelWithFallback("openai", ask), /All configured AI providers failed/);
    assert.deepEqual(hits, { openai: 2, deepseek: 1 }, "explicit user choice must be re-probed");
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) {
      if (originals[name] === undefined) delete process.env[name];
      else process.env[name] = originals[name];
    }
  }
});
