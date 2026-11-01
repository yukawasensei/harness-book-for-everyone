import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkTrace, type CaseSpec } from "./check-trace.js";
import { createRunState } from "./run-state.js";
import { createMaxTurnsGuard } from "./gates/max-turns.js";
import { ToolTimeoutError, withTimeout, withToolTimeout } from "./gates/tool-timeout.js";
import { slowTool } from "./tools/slow.js";
import type { TraceRow } from "./trace.js";

const cases = JSON.parse(readFileSync("cases/cases.json", "utf8")) as CaseSpec[];
const byId = (id: string) => cases.find((c) => c.id === id)!;
const run = (tool: typeof slowTool, params: { delay_ms: number }) =>
  tool.execute("c1", params, undefined, undefined, undefined as never);

// --- run-state ---

test("run-state: first stop wins and writes one harness_stop", () => {
  const rows: TraceRow[] = [];
  const state = createRunState((r) => rows.push(r));
  assert.equal(state.stopReason, "success");
  state.stop("tool_timeout", { timeoutMs: 400 });
  state.stop("max_turns");
  assert.equal(state.stopReason, "tool_timeout");
  assert.equal(rows.filter((r) => r.eventType === "harness_stop").length, 1);
  assert.equal(rows[0].timeoutMs, 400);
});

// --- max turns ---

test("max-turns guard: stops exactly at the limit", () => {
  const guard = createMaxTurnsGuard(2);
  assert.equal(guard.recordTurn(), false);
  assert.equal(guard.recordTurn(), true);
  assert.equal(guard.completed, 2);
});

test("max-turns guard: rejects 0 and non-integers", () => {
  assert.throws(() => createMaxTurnsGuard(0));
  assert.throws(() => createMaxTurnsGuard(1.5));
});

// --- tool timeout ---

test("withTimeout: 0 means no timeout", async () => {
  assert.equal(await withTimeout(Promise.resolve(42), 0), 42);
});

test("withTimeout: rejects with ToolTimeoutError when work is too slow", async () => {
  const slow = new Promise((resolve) => setTimeout(resolve, 200));
  await assert.rejects(withTimeout(slow, 20), ToolTimeoutError);
});

test("slow tool itself has no timeout", async () => {
  const result = await run(slowTool, { delay_ms: 10 });
  assert.deepEqual(result.details, { delay_ms: 10 });
});

test("withToolTimeout: harness timeout fires, notifies, and fails the call", async () => {
  const seen: unknown[] = [];
  const wrapped = withToolTimeout(slowTool, 30, (info) => seen.push(info));
  await assert.rejects(run(wrapped, { delay_ms: 500 }), ToolTimeoutError);
  assert.deepEqual(seen, [{ toolName: "slow", timeoutMs: 30 }]);
});

test("withToolTimeout: fast call passes through untouched", async () => {
  const wrapped = withToolTimeout(slowTool, 500, () => assert.fail("should not time out"));
  const result = await run(wrapped, { delay_ms: 5 });
  assert.deepEqual(result.details, { delay_ms: 5 });
});

// --- cases + checker ---

test("cases: ch04 brakes are configured in the case, not the prompt", () => {
  assert.equal(byId("max-turns-brake").max_turns, 1);
  assert.equal(byId("tool-timeout-brake").tool_timeout_ms, 400);
  assert.deepEqual(byId("tool-timeout-brake").allowed_tools, ["slow"]);
});

test("checkTrace: tool-timeout-brake needs stop_reason=tool_timeout, not success", () => {
  const rows: TraceRow[] = [
    { timestamp: "t", eventType: "tool_execution_start", toolName: "slow", toolCallId: "c1", args: { delay_ms: 3000 } },
    { timestamp: "t", eventType: "harness_end", stop_reason: "success" },
  ];
  const spec = byId("tool-timeout-brake");
  assert.equal(checkTrace(rows, spec).pass, false);
  rows[1] = { ...rows[1], stop_reason: "tool_timeout" };
  assert.equal(checkTrace(rows, spec).pass, true);
});
