import test from "node:test";
import assert from "node:assert/strict";
import { isAgentServiceAuthorized } from "../lib/service-auth.ts";

test("Eve service bridge accepts only configured server key", () => {
  const old = process.env.AGENT_EVE_BRIDGE_KEY;
  const original = process.env.AGENT_SERVICE_KEY;
  try {
    process.env.AGENT_EVE_BRIDGE_KEY = "test-eve-server-only-secret";
    process.env.AGENT_SERVICE_KEY = "test-legacy-server-only-secret";
    const request = (value) => new Request("https://agent.example/api/agent", {
      headers: value ? { "x-agent-service-key": value } : {},
    });
    assert.equal(isAgentServiceAuthorized(request("test-eve-server-only-secret")), true);
    assert.equal(isAgentServiceAuthorized(request("test-legacy-server-only-secret")), true);
    assert.equal(isAgentServiceAuthorized(request("invalid")), false);
    assert.equal(isAgentServiceAuthorized(request()), false);
    assert.equal(isAgentServiceAuthorized(request("a".repeat(513))), false);
  } finally {
    if (old === undefined) delete process.env.AGENT_EVE_BRIDGE_KEY;
    else process.env.AGENT_EVE_BRIDGE_KEY = old;
    if (original === undefined) delete process.env.AGENT_SERVICE_KEY;
    else process.env.AGENT_SERVICE_KEY = original;
  }
});
