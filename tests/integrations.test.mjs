import test from "node:test";
import assert from "node:assert/strict";
import { configuredProviders, gatewayConfigured, runModel } from "../lib/providers.ts";
import { github } from "../lib/github.ts";

function withEnv(names, run) {
  const originals = Object.fromEntries(names.map(name => [name, process.env[name]]));
  return Promise.resolve().then(run).finally(() => {
    for (const name of names) {
      if (originals[name] === undefined) delete process.env[name];
      else process.env[name] = originals[name];
    }
  });
}

test("gateway authentication adds Claude and Mistral without provider-specific credentials", async () => {
  await withEnv(["AI_GATEWAY_API_KEY","VERCEL_OIDC_TOKEN","ANTHROPIC_API_KEY","CLAUDE_API_KEY","MISTRAL_API_KEY"], () => {
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    process.env.VERCEL_OIDC_TOKEN = "unit-test-oidc";
    assert.equal(gatewayConfigured(), true);
    assert.ok(configuredProviders().includes("claude"));
    assert.ok(configuredProviders().includes("mistral"));
  });
});

test("Claude and Mistral use the OIDC gateway for explicit model requests", async () => {
  await withEnv(["AI_GATEWAY_API_KEY","VERCEL_OIDC_TOKEN","ANTHROPIC_API_KEY","CLAUDE_API_KEY","MISTRAL_API_KEY"], async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    process.env.VERCEL_OIDC_TOKEN = "unit-test-oidc";
    const originalFetch = globalThis.fetch;
    const sent = [];
    globalThis.fetch = async (url, opts) => {
      assert.equal(String(url), "https://ai-gateway.vercel.sh/v1/chat/completions");
      assert.equal(opts.headers.Authorization, "Bearer unit-test-oidc");
      const data = JSON.parse(opts.body);
      sent.push(data.model);
      return new Response(JSON.stringify({ choices: [{ message: { content: "Provider mock response" } }] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    };
    try {
      assert.equal(await runModel("claude", [{ role: "user", content: "test" }]), "Provider mock response");
      assert.equal(await runModel("mistral", [{ role: "user", content: "test" }]), "Provider mock response");
      assert.deepEqual(sent, ["anthropic/claude-sonnet-5.5", "mistral/mistral-large-4"]);
    } finally { globalThis.fetch = originalFetch; }
  });
});

test("GitHub public read is allowed without token, but writes fail closed", async () => {
  await withEnv(["GITHUB_TOKEN"], async () => {
    delete process.env.GITHUB_TOKEN;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      assert.equal(String(url), "https://api.github.com/repos/cocosend/artssapp-agent");
      assert.equal(opts.headers.Authorization, undefined);
      return new Response(JSON.stringify({ full_name: "cocosend/artssapp-agent" }), { status: 200 });
    };
    try {
      const response = await github("/repos/cocosend/artssapp-agent");
      assert.equal(response.full_name, "cocosend/artssapp-agent");
      await assert.rejects(() => github("/repos/cocosend/artssapp-agent/git/refs", { method: "POST" }), /GITHUB_TOKEN/);
    } finally { globalThis.fetch = originalFetch; }
  });
});
