import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCostLatencyBudgetGuard,
  decideBudgetStop,
  estimateCostUnits,
  parseCostBudgetUnits,
  parseInjectCostUnits,
  parseInjectElapsedMs,
  parseLatencyBudgetMs,
  shouldStopForCostBudget,
  shouldStopForLatencyBudget,
} from "./cost-latency-budget.js";

describe("parsers", () => {
  it("defaults budgets to 0 (off)", () => {
    assert.equal(parseCostBudgetUnits(undefined), 0);
    assert.equal(parseLatencyBudgetMs(""), 0);
    assert.equal(parseInjectCostUnits(undefined), 0);
    assert.equal(parseInjectElapsedMs(""), 0);
  });
  it("parses non-negative integers", () => {
    assert.equal(parseCostBudgetUnits("100"), 100);
    assert.equal(parseLatencyBudgetMs("2500"), 2500);
    assert.equal(parseInjectCostUnits("500"), 500);
    assert.equal(parseInjectElapsedMs("9000"), 9000);
  });
  it("rejects invalid", () => {
    assert.throws(() => parseCostBudgetUnits("-1"), /integer >= 0/);
    assert.throws(() => parseLatencyBudgetMs("x"), /integer >= 0/);
  });
});

describe("estimateCostUnits / shouldStop", () => {
  it("uses turns × unitsPerTurn as proxy", () => {
    assert.equal(estimateCostUnits({ completedTurns: 3, unitsPerTurn: 10 }), 30);
  });
  it("budget 0 means gate off", () => {
    assert.equal(shouldStopForCostBudget(999, 0), false);
    assert.equal(shouldStopForLatencyBudget(9999, 0), false);
  });
  it("stops when used exceeds budget", () => {
    assert.equal(shouldStopForCostBudget(101, 100), true);
    assert.equal(shouldStopForCostBudget(100, 100), false);
    assert.equal(shouldStopForLatencyBudget(1001, 1000), true);
    assert.equal(shouldStopForLatencyBudget(1000, 1000), false);
  });
});

describe("decideBudgetStop", () => {
  it("prefers cost_budget when both over", () => {
    assert.deepEqual(
      decideBudgetStop({
        usedUnits: 200,
        costBudgetUnits: 100,
        elapsedMs: 9000,
        latencyBudgetMs: 1000,
      }),
      { stop: true, stopReason: "cost_budget" },
    );
  });
  it("returns latency_budget when only wall-clock over", () => {
    assert.deepEqual(
      decideBudgetStop({
        usedUnits: 10,
        costBudgetUnits: 100,
        elapsedMs: 5000,
        latencyBudgetMs: 1000,
      }),
      { stop: true, stopReason: "latency_budget" },
    );
  });
});

describe("createCostLatencyBudgetGuard", () => {
  it("accumulates usage and elapsed then stops", () => {
    const guard = createCostLatencyBudgetGuard({
      costBudgetUnits: 50,
      latencyBudgetMs: 1000,
    });
    guard.recordUsage(40);
    assert.equal(guard.check().stop, false);
    guard.recordUsage(20);
    const overCost = guard.check();
    assert.equal(overCost.stopReason, "cost_budget");
    const latencyOnly = createCostLatencyBudgetGuard({ latencyBudgetMs: 100 });
    latencyOnly.recordElapsed(101);
    assert.equal(latencyOnly.check().stopReason, "latency_budget");
  });
});
