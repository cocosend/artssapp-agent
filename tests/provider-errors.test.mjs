import test from "node:test";
import assert from "node:assert/strict";
import { runModel } from "../lib/providers.ts";

test("OpenAI failures report HTTP status but do not echo upstream response secrets", async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "unit-test-key";
  globalThis.fetch = async () => new Response("DO_NOT_LEAK_PROVIDER_BODY_123", { status: 401 });
  try {
    await assert.rejects(
      () => runModel("openai", [{role:"user",content:"test"}]),
      error => {
        assert.match(error.message,/HTTP 401/);
        assert.doesNotMatch(error.message,/DO_NOT_LEAK_PROVIDER_BODY_123/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
});
