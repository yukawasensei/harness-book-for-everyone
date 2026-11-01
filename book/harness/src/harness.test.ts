import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkTrace, parseTrace, type CaseSpec } from "./check-trace.js";
import { toTraceRow } from "./trace.js";

const cases = JSON.parse(readFileSync("cases/cases.json", "utf8")) as CaseSpec[];
const readHappy = cases.find((c) => c.id === "read-happy")!;
const fixture = parseTrace(readFileSync("fixtures/read-happy.trace.jsonl", "utf8"));

test("cases.json: read-happy is well-formed", () => {
  assert.ok(readHappy);
  assert.deepEqual(readHappy.allowed_tools, ["read"]);
  assert.equal(readHappy.expect.stop_reason, "success");
});

test("toTraceRow keeps tool name, id and isError only", () => {
  const row = toTraceRow(
    { type: "tool_execution_end", toolName: "read", toolCallId: "c1", isError: false, result: "huge" },
    new Date("2026-11-01T00:00:00Z"),
  );
  assert.deepEqual(row, {
    timestamp: "2026-11-01T00:00:00.000Z",
    eventType: "tool_execution_end",
    toolName: "read",
    toolCallId: "c1",
    isError: false,
  });
});

test("toTraceRow records message role", () => {
  const row = toTraceRow({ type: "message_end", message: { role: "assistant", content: "x" } });
  assert.equal(row.role, "assistant");
});

test("checkTrace: fixture passes read-happy", () => {
  assert.deepEqual(checkTrace(fixture, readHappy), { pass: true, reasons: [] });
});

test("checkTrace: missing harness_end fails", () => {
  const rows = fixture.filter((r) => r.eventType !== "harness_end");
  assert.equal(checkTrace(rows, readHappy).pass, false);
});

test("checkTrace: model_error fails", () => {
  const rows = fixture.map((r) => (r.eventType === "harness_end" ? { ...r, stop_reason: "model_error" } : r));
  assert.match(checkTrace(rows, readHappy).reasons.join(), /stop_reason=model_error/);
});

test("checkTrace: answering without calling read fails", () => {
  const rows = fixture.filter((r) => !String(r.eventType).startsWith("tool_execution"));
  assert.match(checkTrace(rows, readHappy).reasons.join(), /tool read not called/);
});

test("checkTrace: tool outside allowlist fails", () => {
  const rows = [
    ...fixture,
    { timestamp: "t", eventType: "tool_execution_start", toolName: "bash", toolCallId: "c2" },
  ];
  assert.match(checkTrace(rows, readHappy).reasons.join(), /outside allowlist: bash/);
});
