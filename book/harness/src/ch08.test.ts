import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkTrace, type CaseSpec } from "./check-trace.js";
import { decideToolCall } from "./gates/tool-policy.js";
import { denyAllApprover, simulatedApprover } from "./gates/hitl.js";
import type { TraceRow } from "./trace.js";

const cases = JSON.parse(readFileSync("cases/cases.json", "utf8")) as CaseSpec[];
const byId = (id: string) => cases.find((c) => c.id === id)!;
const root = process.cwd();
const policy = { allowedTools: ["write", "read"], workspaceRoot: root, writableDirs: ["workspace/out"] };

// --- write sandbox ---

test("write inside writable_dirs is allowed", () => {
  assert.deepEqual(decideToolCall({ toolName: "write", args: { path: "workspace/out/note.md", content: "x" } }, policy), { allow: true });
});

test("write elsewhere in the workspace is denied: readable ≠ writable", () => {
  const d = decideToolCall({ toolName: "write", args: { path: "src/hacked.ts", content: "x" } }, policy);
  assert.equal(!d.allow && d.stopReason, "path_denied");
  assert.equal(!d.allow && d.details.reason, "not in writable_dirs");
});

test("writing the writable dir itself (not a file in it) is denied", () => {
  assert.equal(decideToolCall({ toolName: "write", args: { path: "workspace/out", content: "x" } }, policy).allow, false);
});

test("write with ../ climbing out of writable dir is denied", () => {
  assert.equal(decideToolCall({ toolName: "edit", args: { path: "workspace/out/../../src/index.ts", edits: [] } }, policy).allow, false);
});

test("no writable_dirs means no writes at all", () => {
  const d = decideToolCall({ toolName: "write", args: { path: "workspace/out/a.md" } }, { ...policy, writableDirs: [] });
  assert.equal(d.allow, false);
});

test("read is not restricted by writable_dirs", () => {
  assert.deepEqual(decideToolCall({ toolName: "read", args: { path: "src/index.ts" } }, policy), { allow: true });
});

// --- approvers ---

test("simulated approver follows the case decision and says it is simulated", async () => {
  assert.deepEqual(await simulatedApprover("approve")({ toolName: "write", args: {} }), { approved: true, by: "simulated", reason: "case hitl_decision=approve" });
  assert.equal((await simulatedApprover("deny")({ toolName: "write", args: {} })).approved, false);
});

test("safe default: without an approver every confirm request is denied", async () => {
  assert.equal((await denyAllApprover({ toolName: "write", args: {} })).approved, false);
});

// --- cases + checker ---

test("cases: write cases confirm writes and only allow workspace/out", () => {
  for (const id of ["hitl-approve-write", "hitl-denied-brake", "write-outside-writable-denied"]) {
    assert.deepEqual(byId(id).confirm_tools, ["write"]);
    assert.deepEqual(byId(id).writable_dirs, ["workspace/out"]);
  }
});

test("checkTrace: tools_succeeded fails when the write never succeeded", () => {
  const spec = byId("hitl-approve-write");
  const rows: TraceRow[] = [
    { timestamp: "t", eventType: "hitl_request" },
    { timestamp: "t", eventType: "hitl_decision", approved: true },
    { timestamp: "t", eventType: "tool_execution_start", toolName: "write", toolCallId: "c1" },
    { timestamp: "t", eventType: "tool_execution_end", toolName: "write", toolCallId: "c1", isError: true },
    { timestamp: "t", eventType: "harness_end", stop_reason: "success" },
  ];
  assert.match(checkTrace(rows, spec).reasons.join(), /tool write never succeeded/);
  rows[3] = { ...rows[3], isError: false };
  assert.equal(checkTrace(rows, spec).pass, true);
});
