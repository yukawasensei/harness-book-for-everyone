import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createRetryBudgetGuard,
  decideOnRetryExhausted,
  nextBackoffMs,
  parseInjectToolFailures,
  parseMaxRetries,
  parseOnRetryExhausted,
  parseRetryBackoffMs,
  shouldRetryAfterFailure,
} from "./retry-budget.js";

describe("parseMaxRetries", () => {
  it("defaults to 0", () => {
    assert.equal(parseMaxRetries(undefined), 0);
    assert.equal(parseMaxRetries(""), 0);
  });
  it("parses non-negative integers", () => {
    assert.equal(parseMaxRetries("0"), 0);
    assert.equal(parseMaxRetries("3"), 3);
  });
  it("rejects invalid", () => {
    assert.throws(() => parseMaxRetries("-1"), /integer >= 0/);
  });
});

describe("parseRetryBackoffMs / parseOnRetryExhausted / inject", () => {
  it("parses backoff and policies", () => {
    assert.equal(parseRetryBackoffMs(undefined), 0);
    assert.equal(parseRetryBackoffMs("25"), 25);
    assert.equal(parseOnRetryExhausted(undefined), "stop");
    assert.equal(parseOnRetryExhausted("skip_tool"), "skip_tool");
    assert.equal(parseOnRetryExhausted("partial"), "partial");
    assert.equal(parseInjectToolFailures("1"), true);
    assert.equal(parseInjectToolFailures(""), false);
  });
});

describe("shouldRetryAfterFailure", () => {
  it("allows retries while failureCount <= maxRetries", () => {
    assert.equal(shouldRetryAfterFailure(1, 2), true);
    assert.equal(shouldRetryAfterFailure(2, 2), true);
    assert.equal(shouldRetryAfterFailure(3, 2), false);
  });
  it("never retries when maxRetries is 0", () => {
    assert.equal(shouldRetryAfterFailure(1, 0), false);
  });
});

describe("nextBackoffMs", () => {
  it("scales linearly", () => {
    assert.equal(nextBackoffMs(1, 10), 10);
    assert.equal(nextBackoffMs(3, 10), 30);
  });
});

describe("decideOnRetryExhausted", () => {
  it("always surfaces retry_exhausted with degrade action", () => {
    assert.deepEqual(decideOnRetryExhausted("stop"), {
      stopReason: "retry_exhausted",
      degrade: "stop",
    });
    assert.deepEqual(decideOnRetryExhausted("skip_tool"), {
      stopReason: "retry_exhausted",
      degrade: "skip_tool",
    });
  });
});

describe("createRetryBudgetGuard", () => {
  it("exhausts after initial try + maxRetries", () => {
    const guard = createRetryBudgetGuard({ maxRetries: 2, backoffMs: 5 });
    const a = guard.recordFailure();
    assert.equal(a.retry, true);
    assert.equal(a.backoffMs, 5);
    const b = guard.recordFailure();
    assert.equal(b.retry, true);
    assert.equal(b.backoffMs, 10);
    const c = guard.recordFailure();
    assert.equal(c.retry, false);
    assert.equal(c.exhausted, true);
    assert.equal(guard.exhausted, true);
    assert.equal(guard.failureCount, 3);
  });
});
