import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { CaseSpec } from "./check-trace.js";
import { createBudgetGuard } from "./gates/budget.js";

const cases = JSON.parse(readFileSync("cases/cases.json", "utf8")) as CaseSpec[];
const byId = (id: string) => cases.find((c) => c.id === id)!;

function fakeClock(start = 1_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

test("budget: 0 means unlimited", () => {
  const g = createBudgetGuard({ tokenBudget: 0, latencyBudgetMs: 0 });
  g.recordUsage({ totalTokens: 1e9 });
  assert.equal(g.check(), undefined);
});

test("budget: tokens accumulate across turns (whole run, not per call)", () => {
  const g = createBudgetGuard({ tokenBudget: 1000, latencyBudgetMs: 0 });
  g.recordUsage({ totalTokens: 400 });
  assert.equal(g.check(), undefined);
  g.recordUsage({ totalTokens: 400 });
  assert.equal(g.check(), undefined);
  g.recordUsage({ totalTokens: 400 }); // 每次都不贵，加起来超了
  assert.deepEqual(g.check(), { stopReason: "cost_budget", details: { tokens: 1200, tokenBudget: 1000 } });
});

test("budget: falls back to input+output when totalTokens is missing", () => {
  const g = createBudgetGuard({ tokenBudget: 10, latencyBudgetMs: 0 });
  g.recordUsage({ input: 6, output: 6 });
  assert.equal(g.tokens, 12);
  g.recordUsage(undefined);
  assert.equal(g.tokens, 12);
});

test("budget: latency is wall clock since the run started", () => {
  const clock = fakeClock();
  const g = createBudgetGuard({ tokenBudget: 0, latencyBudgetMs: 1500, now: clock.now });
  clock.advance(1000);
  assert.equal(g.check(), undefined);
  clock.advance(600);
  assert.deepEqual(g.check(), { stopReason: "latency_budget", details: { elapsedMs: 1600, latencyBudgetMs: 1500 } });
});

test("budget: cost is reported before latency when both are over", () => {
  const clock = fakeClock();
  const g = createBudgetGuard({ tokenBudget: 1, latencyBudgetMs: 1, now: clock.now });
  g.recordUsage({ totalTokens: 5 });
  clock.advance(10);
  assert.equal(g.check()?.stopReason, "cost_budget");
});

test("cases: latency case has no per-tool timeout — only the whole-run budget", () => {
  const spec = byId("latency-budget-brake");
  assert.equal(spec.tool_timeout_ms, undefined);
  assert.equal(spec.latency_budget_ms, 1500);
  assert.equal(byId("cost-budget-brake").token_budget, 300);
});
