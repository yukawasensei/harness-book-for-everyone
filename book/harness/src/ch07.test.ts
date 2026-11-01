import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkTrace, type CaseSpec } from "./check-trace.js";
import { estimateContextChars, TRUNCATION_MARKER, truncateToolContent } from "./gates/context-budget.js";
import { backoffDelay, withRetry } from "./gates/retry.js";
import { createFlakyTool } from "./tools/flaky.js";
import type { TraceRow } from "./trace.js";

const cases = JSON.parse(readFileSync("cases/cases.json", "utf8")) as CaseSpec[];
const byId = (id: string) => cases.find((c) => c.id === id)!;
const call = (tool: ReturnType<typeof createFlakyTool>) =>
  tool.execute("c1", { location: "横店" }, undefined, undefined, undefined as never);
const noEvents = { onRetry: () => {}, onExhausted: () => {} };

// --- context budget ---

test("estimateContextChars counts string and text-part content", () => {
  const chars = estimateContextChars([
    { role: "user", content: "abc" },
    { role: "toolResult", content: [{ type: "text", text: "12345" }, { type: "image" }] },
  ]);
  assert.equal(chars, 8);
});

test("the big fixture really is bigger than the ch07 budget", () => {
  const size = readFileSync("fixtures/big-notes.md", "utf8").length;
  assert.ok(size > (byId("context-budget-brake").context_budget_chars ?? 0) * 2);
});

test("truncateToolContent: under the limit is untouched", () => {
  const content = [{ type: "text", text: "short" }];
  assert.deepEqual(truncateToolContent(content, 100), { content, truncated: false, originalChars: 5 });
});

test("truncateToolContent: over the limit is cut and marked", () => {
  const cut = truncateToolContent([{ type: "text", text: "x".repeat(50) }], 10);
  assert.equal(cut.truncated, true);
  assert.equal(cut.originalChars, 50);
  assert.equal(cut.content[0].text, `${"x".repeat(10)}${TRUNCATION_MARKER}`);
});

// --- retry & degrade ---

test("backoff doubles each retry", () => {
  assert.deepEqual([1, 2, 3].map((n) => backoffDelay(100, n)), [100, 200, 400]);
  assert.equal(backoffDelay(0, 3), 0);
});

test("flaky tool fails the first N calls, then succeeds", async () => {
  const tool = createFlakyTool(1);
  await assert.rejects(call(tool), /unavailable/);
  const ok = await call(tool);
  assert.match(String((ok.content[0] as { text: string }).text), /横店/);
});

test("retry recovers within budget and reports each retry", async () => {
  const retries: number[] = [];
  const tool = withRetry(createFlakyTool(2), { maxRetries: 2, backoffMs: 0, onExhausted: "stop" }, {
    onRetry: (i) => retries.push(i.attempt),
    onExhausted: () => assert.fail("should not exhaust"),
  });
  const ok = await call(tool);
  assert.deepEqual(ok.details, { calls: 3 });
  assert.deepEqual(retries, [1, 2]);
});

test("retry exhausted + stop: throws after maxRetries+1 attempts", async () => {
  const exhausted: unknown[] = [];
  const tool = withRetry(createFlakyTool(Infinity), { maxRetries: 2, backoffMs: 0, onExhausted: "stop" }, {
    onRetry: () => {},
    onExhausted: (i) => exhausted.push(i.attempts),
  });
  await assert.rejects(call(tool), /failed after 3 attempts/);
  assert.deepEqual(exhausted, [3]);
});

test("retry exhausted + degrade: returns a clearly marked fallback instead of throwing", async () => {
  const tool = withRetry(createFlakyTool(Infinity), { maxRetries: 1, backoffMs: 0, onExhausted: "degrade" }, noEvents);
  const result = await call(tool);
  assert.match(String((result.content[0] as { text: string }).text), /^\[degraded\]/);
  assert.deepEqual(result.details, { degraded: true, attempts: 2 });
});

// --- cases + checker ---

test("checkTrace: expect.events requires the retry evidence in the trace", () => {
  const spec = byId("retry-recovers");
  const rows: TraceRow[] = [
    { timestamp: "t", eventType: "tool_execution_start", toolName: "flaky", toolCallId: "c1" },
    { timestamp: "t", eventType: "tool_retry" },
    { timestamp: "t", eventType: "harness_end", stop_reason: "success" },
  ];
  assert.match(checkTrace(rows, spec).reasons.join(), /tool_retry x1, expected >= 2/);
  rows.splice(1, 0, { timestamp: "t", eventType: "tool_retry" });
  assert.equal(checkTrace(rows, spec).pass, true);
});

test("cases: ch07 gate settings live in the case", () => {
  assert.equal(byId("context-budget-brake").context_budget_chars, 6000);
  assert.equal(byId("tool-result-truncate").tool_result_max_chars, 1500);
  assert.equal(byId("retry-degrade").on_exhausted, "degrade");
});
