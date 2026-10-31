import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createMaxTurnsGuard,
  parseMaxTurns,
  shouldStopForMaxTurns,
} from "./max-turns.js";

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
