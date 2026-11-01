import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkTrace, type CaseSpec } from "./check-trace.js";
import { checkPath, pathArgs } from "./gates/path-sandbox.js";
import { decideToolCall } from "./gates/tool-policy.js";
import type { TraceRow } from "./trace.js";

const cases = JSON.parse(readFileSync("cases/cases.json", "utf8")) as CaseSpec[];
const byId = (id: string) => cases.find((c) => c.id === id)!;

// 临时目录结构：<tmp>/ws（workspace）+ <tmp>/outside/secret.txt + ws/link -> outside
let tmp = "";
let ws = "";
before(() => {
  tmp = mkdtempSync(join(tmpdir(), "book-ch05-"));
  ws = join(tmp, "ws");
  mkdirSync(join(ws, "docs"), { recursive: true });
  writeFileSync(join(ws, "docs", "a.md"), "inside");
  mkdirSync(join(tmp, "outside"));
  writeFileSync(join(tmp, "outside", "secret.txt"), "secret");
  symlinkSync(join(tmp, "outside"), join(ws, "link"));
});
after(() => rmSync(tmp, { recursive: true, force: true }));

// --- path sandbox ---

test("sandbox: relative path inside workspace is allowed", () => {
  assert.deepEqual(checkPath(ws, "docs/a.md"), { ok: true, relativePath: join("docs", "a.md") });
});

test("sandbox: not-yet-existing file inside workspace is allowed", () => {
  assert.equal(checkPath(ws, "docs/new.md").ok, true);
});

test("sandbox: .. climb out of workspace is denied", () => {
  assert.equal(checkPath(ws, "../outside/secret.txt").ok, false);
  assert.equal(checkPath(ws, "docs/../../outside/secret.txt").ok, false);
});

test("sandbox: absolute path outside workspace is denied", () => {
  assert.equal(checkPath(ws, join(tmp, "outside", "secret.txt")).ok, false);
  assert.equal(checkPath(ws, "/etc/hostname").ok, false);
});

test("sandbox: symlink that points outside is denied (even for a new leaf)", () => {
  assert.equal(checkPath(ws, "link/secret.txt").ok, false);
  assert.equal(checkPath(ws, "link/new.txt").ok, false);
});

test("sandbox: empty path and null byte are denied", () => {
  assert.equal(checkPath(ws, "").ok, false);
  assert.equal(checkPath(ws, "docs/a.md\0").ok, false);
});

test("pathArgs: picks path / file_path, ignores tools without paths", () => {
  assert.deepEqual(pathArgs({ path: "a" }), ["a"]);
  assert.deepEqual(pathArgs({ file_path: "b" }), ["b"]);
  assert.deepEqual(pathArgs({ name: "学员" }), []);
});

// --- tool policy (beforeToolCall) ---

test("policy: allowlisted tool with safe path is allowed", () => {
  assert.deepEqual(decideToolCall({ toolName: "read", args: { path: "docs/a.md" } }, { allowedTools: ["read"], workspaceRoot: ws }), { allow: true });
});

test("policy: tool outside allowlist is denied as tool_denied", () => {
  const d = decideToolCall({ toolName: "bash", args: { command: "ls" } }, { allowedTools: ["read"], workspaceRoot: ws });
  assert.equal(d.allow, false);
  assert.equal(!d.allow && d.stopReason, "tool_denied");
});

test("policy: allowlist alone is not path safety — escaping read is path_denied", () => {
  const d = decideToolCall({ toolName: "read", args: { path: "../outside/secret.txt" } }, { allowedTools: ["read"], workspaceRoot: ws });
  assert.equal(!d.allow && d.stopReason, "path_denied");
  // trace 里只留请求的路径和原因，不留本机绝对路径
  assert.deepEqual(!d.allow && d.details, { toolName: "read", requestedPath: "../outside/secret.txt", reason: "resolves outside workspace" });
});

// --- checker ---

test("checkTrace: a requested-but-blocked bash is fine; an executed bash fails", () => {
  const spec = byId("allowlist-no-bash");
  const rows: TraceRow[] = [
    { timestamp: "t", eventType: "tool_execution_start", toolName: "bash", toolCallId: "c1" },
    { timestamp: "t", eventType: "tool_execution_end", toolName: "bash", toolCallId: "c1", isError: true },
    { timestamp: "t", eventType: "harness_end", stop_reason: "success" },
  ];
  assert.equal(checkTrace(rows, spec).pass, true);
  rows[1] = { ...rows[1], isError: false };
  assert.match(checkTrace(rows, spec).reasons.join(), /bash/);
});

test("checkTrace: path-escape-denied fails if the escaping read succeeded", () => {
  const spec = byId("path-escape-denied");
  const rows: TraceRow[] = [
    { timestamp: "t", eventType: "tool_execution_start", toolName: "read", toolCallId: "c1", args: { path: "../../README.md" } },
    { timestamp: "t", eventType: "tool_execution_end", toolName: "read", toolCallId: "c1", isError: false },
    { timestamp: "t", eventType: "harness_end", stop_reason: "path_denied" },
  ];
  assert.match(checkTrace(rows, spec).reasons.join(), /tool read was executed/);
  rows[1] = { ...rows[1], isError: true };
  assert.equal(checkTrace(rows, spec).pass, true);
});
