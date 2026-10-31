import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createHitlGate,
  decideHitlOutcome,
  parseHitlRequiredTools,
  parseHitlTimeoutMs,
  parseInjectHitlDecision,
  toolRequiresHitl,
} from "./hitl-gate.js";

describe("parseHitlRequiredTools", () => {
  it("defaults to confirm_gate, write, bash", () => {
    assert.deepEqual(parseHitlRequiredTools(undefined), [
      "confirm_gate",
      "write",
      "bash",
    ]);
  });
  it("parses comma list", () => {
    assert.deepEqual(parseHitlRequiredTools("confirm_gate, write"), [
      "confirm_gate",
      "write",
    ]);
  });
});

describe("parseInjectHitlDecision / parseHitlTimeoutMs", () => {
  it("parses inject decisions", () => {
    assert.equal(parseInjectHitlDecision(undefined), null);
    assert.equal(parseInjectHitlDecision(""), null);
    assert.equal(parseInjectHitlDecision("deny"), "deny");
    assert.equal(parseInjectHitlDecision("TIMEOUT"), "timeout");
    assert.equal(parseInjectHitlDecision("approve"), "approve");
    assert.throws(() => parseInjectHitlDecision("maybe"), /approve\|deny\|timeout/);
  });
  it("parses timeout ms", () => {
    assert.equal(parseHitlTimeoutMs(undefined), 0);
    assert.equal(parseHitlTimeoutMs("5000"), 5000);
  });
});

describe("toolRequiresHitl", () => {
  it("matches case-insensitively", () => {
    assert.equal(toolRequiresHitl("confirm_gate", ["confirm_gate"]), true);
    assert.equal(toolRequiresHitl("WRITE", ["write", "bash"]), true);
    assert.equal(toolRequiresHitl("read", ["confirm_gate", "write"]), false);
  });
});

describe("decideHitlOutcome", () => {
  it("approve continues; deny and timeout stop with distinct reasons", () => {
    assert.deepEqual(decideHitlOutcome("approve"), {
      allow: true,
      stopReason: null,
    });
    assert.deepEqual(decideHitlOutcome("deny"), {
      allow: false,
      stopReason: "human_denied",
    });
    assert.deepEqual(decideHitlOutcome("timeout"), {
      allow: false,
      stopReason: "awaiting_human",
    });
  });
});

describe("createHitlGate", () => {
  it("blocks high-risk tools on injected deny", () => {
    const gate = createHitlGate({ requiredTools: ["confirm_gate"] });
    assert.equal(gate.requiresApproval("confirm_gate"), true);
    assert.equal(gate.requiresApproval("read"), false);
    const denied = gate.resolve("confirm_gate", "deny");
    assert.equal(denied.allow, false);
    assert.equal(denied.stopReason, "human_denied");
    const timedOut = gate.resolve("confirm_gate", "timeout");
    assert.equal(timedOut.stopReason, "awaiting_human");
    const ok = gate.resolve("confirm_gate", "approve");
    assert.equal(ok.allow, true);
  });
});
