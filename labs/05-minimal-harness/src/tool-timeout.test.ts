import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseToolTimeoutMs,
  sleep,
  ToolTimeoutError,
  withToolTimeout,
} from "./tool-timeout.js";

describe("parseToolTimeoutMs", () => {
  it("defaults to 0 (disabled) when unset", () => {
    assert.equal(parseToolTimeoutMs(undefined), 0);
    assert.equal(parseToolTimeoutMs(""), 0);
    assert.equal(parseToolTimeoutMs("  "), 0);
  });

  it("parses non-negative integers", () => {
    assert.equal(parseToolTimeoutMs("0"), 0);
    assert.equal(parseToolTimeoutMs("250"), 250);
  });

  it("rejects invalid values", () => {
    assert.throws(() => parseToolTimeoutMs("-1"), /integer >= 0/);
    assert.throws(() => parseToolTimeoutMs("abc"), /integer >= 0/);
  });
});

describe("withToolTimeout", () => {
  it("resolves when work finishes before timeout", async () => {
    const value = await withToolTimeout(sleep(20).then(() => "ok"), 200);
    assert.equal(value, "ok");
  });

  it("rejects with ToolTimeoutError when work exceeds timeout", async () => {
    await assert.rejects(
      () => withToolTimeout(sleep(300), 40),
      (error: unknown) => {
        assert.ok(error instanceof ToolTimeoutError);
        assert.equal(error.timeoutMs, 40);
        return true;
      },
    );
  });

  it("skips timer when timeoutMs is 0", async () => {
    const value = await withToolTimeout(Promise.resolve(7), 0);
    assert.equal(value, 7);
  });
});
