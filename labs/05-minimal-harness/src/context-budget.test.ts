import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPaddingMessage,
  estimateContextChars,
  parseContextBudgetChars,
  parseContextBudgetPolicy,
  parseInjectContextChars,
  shouldStopForContextBudget,
  truncateMessagesToBudget,
  type ContextMessage,
} from "./context-budget.js";

describe("parseContextBudgetChars", () => {
  it("defaults to 0 (gate off) when unset", () => {
    assert.equal(parseContextBudgetChars(undefined), 0);
    assert.equal(parseContextBudgetChars(""), 0);
    assert.equal(parseContextBudgetChars("  "), 0);
  });

  it("parses non-negative integers", () => {
    assert.equal(parseContextBudgetChars("0"), 0);
    assert.equal(parseContextBudgetChars("1000"), 1000);
  });

  it("rejects invalid values", () => {
    assert.throws(() => parseContextBudgetChars("-1"), /integer >= 0/);
    assert.throws(() => parseContextBudgetChars("abc"), /integer >= 0/);
  });
});

describe("parseInjectContextChars", () => {
  it("defaults to 0", () => {
    assert.equal(parseInjectContextChars(undefined), 0);
  });

  it("parses and rejects like budget", () => {
    assert.equal(parseInjectContextChars("5000"), 5000);
    assert.throws(() => parseInjectContextChars("-2"), /integer >= 0/);
  });
});

describe("parseContextBudgetPolicy", () => {
  it("defaults to stop", () => {
    assert.equal(parseContextBudgetPolicy(undefined), "stop");
  });

  it("accepts stop and truncate", () => {
    assert.equal(parseContextBudgetPolicy("stop"), "stop");
    assert.equal(parseContextBudgetPolicy("TRUNCATE"), "truncate");
  });

  it("rejects unknown", () => {
    assert.throws(() => parseContextBudgetPolicy("drop"), /stop\|truncate/);
  });
});

describe("estimateContextChars", () => {
  it("sums string and text-part content", () => {
    const messages: ContextMessage[] = [
      { role: "system", content: "abcd" },
      { role: "user", content: [{ type: "text", text: "ef" }] },
    ];
    assert.equal(estimateContextChars(messages), 6);
  });
});

describe("shouldStopForContextBudget", () => {
  it("never stops when budget is 0 (off)", () => {
    assert.equal(shouldStopForContextBudget(99999, 0), false);
  });

  it("stops only when estimated exceeds budget", () => {
    assert.equal(shouldStopForContextBudget(100, 100), false);
    assert.equal(shouldStopForContextBudget(101, 100), true);
  });
});

describe("truncateMessagesToBudget", () => {
  it("keeps system and newest user messages under budget", () => {
    const messages: ContextMessage[] = [
      { role: "system", content: "SYS" },
      { role: "user", content: "AAAA" },
      { role: "assistant", content: "BB" },
      { role: "user", content: "CC" },
    ];
    // SYS(3)+CC(2)=5 fits budget 5; dropping older AAAA/BB
    const truncated = truncateMessagesToBudget(messages, 5);
    assert.deepEqual(
      truncated.map((m) => m.content),
      ["SYS", "CC"],
    );
  });

  it("returns a copy when already under budget", () => {
    const messages: ContextMessage[] = [{ role: "user", content: "hi" }];
    const truncated = truncateMessagesToBudget(messages, 100);
    assert.deepEqual(truncated, messages);
    assert.notEqual(truncated, messages);
  });
});

describe("buildPaddingMessage", () => {
  it("builds fixed-length padding", () => {
    const msg = buildPaddingMessage(10);
    assert.equal(typeof msg.content, "string");
    assert.equal((msg.content as string).length, 10);
  });
});
