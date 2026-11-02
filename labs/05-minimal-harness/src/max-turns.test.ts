import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createMaxTurnsGuard,
  finishTurnWhen,
  parseMaxTurns,
  shouldStopForMaxTurns,
} from "./max-turns.js";

describe("pi 1.x finishTurn adapter", () => {
  type Turn = Parameters<ReturnType<typeof finishTurnWhen>>[0];
  const turn = (stopReason: Turn["message"]["stopReason"]): Turn => ({
    message: {
      role: "assistant", api: "openai-completions", provider: "ollama", model: "test",
      content: [], timestamp: 0, stopReason,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    },
    context: { messages: [] }, newMessages: [], toolResults: [],
  });

  it("ends at the cap and preserves scheduling below it", async () => {
    const guard = createMaxTurnsGuard(2);
    const finish = finishTurnWhen(() => guard.recordCompletedTurn());
    assert.equal(await finish(turn("toolUse")), undefined);
    assert.deepEqual(await finish(turn("toolUse")), { action: "end" });
    assert.equal(guard.completedTurnCount, 2);
  });

  it("supports asynchronous stop decisions", async () => {
    assert.deepEqual(await finishTurnWhen(async () => true)(turn("stop")), { action: "end" });
  });

  for (const reason of ["error", "aborted"] as const) {
    it(`preserves ${reason} hard exits without recording a normal turn`, async () => {
      const finish = finishTurnWhen(() => assert.fail("hard exits must skip the predicate"));
      assert.equal(await finish(turn(reason)), undefined);
    });
  }
});

describe("parseMaxTurns", () => {
  it("uses default when unset", () => {
    assert.equal(parseMaxTurns(undefined), 8);
    assert.equal(parseMaxTurns(""), 8);
    assert.equal(parseMaxTurns("  "), 8);
  });

  it("parses positive integers", () => {
    assert.equal(parseMaxTurns("1"), 1);
    assert.equal(parseMaxTurns("12"), 12);
  });

  it("rejects invalid values", () => {
    assert.throws(() => parseMaxTurns("0"), /positive integer/);
    assert.throws(() => parseMaxTurns("-1"), /positive integer/);
    assert.throws(() => parseMaxTurns("abc"), /positive integer/);
  });
});

describe("shouldStopForMaxTurns", () => {
  it("allows turns below the cap", () => {
    assert.equal(shouldStopForMaxTurns(0, 2), false);
    assert.equal(shouldStopForMaxTurns(1, 2), false);
  });

  it("stops at and above the cap", () => {
    assert.equal(shouldStopForMaxTurns(2, 2), true);
    assert.equal(shouldStopForMaxTurns(3, 2), true);
  });
});

describe("createMaxTurnsGuard", () => {
  it("stops after N completed turns", () => {
    const guard = createMaxTurnsGuard(2);
    assert.equal(guard.recordCompletedTurn(), false);
    assert.equal(guard.completedTurnCount, 1);
    assert.equal(guard.hitMaxTurns, false);
    assert.equal(guard.recordCompletedTurn(), true);
    assert.equal(guard.completedTurnCount, 2);
    assert.equal(guard.hitMaxTurns, true);
  });

  it("stops on the first turn when maxTurns is 1", () => {
    const guard = createMaxTurnsGuard(1);
    assert.equal(guard.recordCompletedTurn(), true);
    assert.equal(guard.hitMaxTurns, true);
  });
});
