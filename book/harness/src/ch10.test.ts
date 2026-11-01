import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCase, type CaseSpec } from "./check-trace.js";
import { checkArtifact, checkWriteOrder, successfulWrites } from "./check-artifacts.js";
import type { TraceRow } from "./trace.js";

const cases = JSON.parse(readFileSync("cases/cases.json", "utf8")) as CaseSpec[];
const capstone = cases.find((c) => c.id === "capstone-set-clerk")!;
const failStop = cases.find((c) => c.id === "capstone-fail-stop")!;

let root = "";
before(() => {
  root = mkdtempSync(join(tmpdir(), "book-ch10-"));
  mkdirSync(join(root, "workspace/out"), { recursive: true });
});
after(() => rmSync(root, { recursive: true, force: true }));
const put = (rel: string, text: string) => writeFileSync(join(root, rel), text);

const write = (id: string, path: string, ok = true): TraceRow[] => [
  { timestamp: "t", eventType: "tool_execution_start", toolName: "write", toolCallId: id, args: { path } },
  { timestamp: "t", eventType: "tool_execution_end", toolName: "write", toolCallId: id, isError: !ok },
];

test("artifact: missing file", () => {
  assert.deepEqual(checkArtifact(root, { path: "workspace/out/none.json", json_keys: ["a"] }), ["workspace/out/none.json missing"]);
});

test("artifact: invalid JSON is reported, not thrown", () => {
  put("workspace/out/bad.json", "```json\n{}\n```");
  assert.deepEqual(checkArtifact(root, { path: "workspace/out/bad.json", json_keys: ["a"] }), ["workspace/out/bad.json is not valid JSON"]);
});

test("artifact: keys, min items and item keys", () => {
  put("workspace/out/board.json", JSON.stringify({ scenes: [], shots: [{ shot_id: 1, scene: "a", description: "x" }, { shot_id: 2 }] }));
  const reasons = checkArtifact(root, { path: "workspace/out/board.json", json_keys: ["scenes", "shots"], min_items: { shots: 3 }, item_keys: { shots: ["shot_id", "scene", "description"] } });
  assert.deepEqual(reasons, [
    "workspace/out/board.json shots has 2 items, expected >= 3",
    'workspace/out/board.json shots[1] missing "scene"',
    'workspace/out/board.json shots[1] missing "description"',
  ]);
});

test("artifact: markdown headings must be whole lines", () => {
  put("workspace/out/script.md", "# 脚本\n## 标题\n正文里提到 ## 正文 不算\n");
  assert.deepEqual(checkArtifact(root, { path: "workspace/out/script.md", headings: ["# 脚本", "## 正文"] }), ['workspace/out/script.md missing heading "## 正文"']);
});

test("write order: only successful writes count; rewrites are fine", () => {
  const rows = [...write("1", "a"), ...write("2", "b", false), ...write("3", "b"), ...write("4", "a"), ...write("5", "c")];
  assert.deepEqual(successfulWrites(rows), ["a", "b", "a", "c"]);
  assert.deepEqual(checkWriteOrder(rows, ["a", "b", "c"]), []);
  assert.match(checkWriteOrder(rows, ["b", "a", "c"]).join(), /a written before b/);
  assert.match(checkWriteOrder(write("1", "a"), ["a", "b"]).join(), /missing b/);
});

test("checkCase: capstone needs both a clean trace and correct artifacts", () => {
  const order = capstone.expect.write_order!;
  const rows: TraceRow[] = [
    { timestamp: "t", eventType: "tool_execution_start", toolName: "read", toolCallId: "r", args: { path: "fixtures/brief.json" } },
    { timestamp: "t", eventType: "tool_execution_end", toolName: "read", toolCallId: "r", isError: false },
    ...order.flatMap((p, i) => [{ timestamp: "t", eventType: "hitl_decision", approved: true }, ...write(`w${i}`, p)]),
    { timestamp: "t", eventType: "harness_end", stop_reason: "success" },
  ];
  // trace 全对，但产物没写对 → 不过
  rmSync(join(root, "workspace/out"), { recursive: true, force: true });
  mkdirSync(join(root, "workspace/out"), { recursive: true });
  assert.equal(checkCase(rows, capstone, root).pass, false);
  put("workspace/out/topic.json", JSON.stringify({ title: "t", hook: "h", audience: "a", duration_sec: 45, platforms: [] }));
  put("workspace/out/script.md", "# 脚本\n## 标题\n## 开场钩子\n## 正文\n");
  put("workspace/out/board.json", JSON.stringify({ scenes: ["s"], shots: [1, 2, 3].map((n) => ({ shot_id: n, scene: "s", description: "d" })) }));
  assert.deepEqual(checkCase(rows, capstone, root), { pass: true, reasons: [] });
});

test("checkCase: fail-stop case fails if any half-finished artifact is left", () => {
  const rows: TraceRow[] = [
    { timestamp: "t", eventType: "tool_execution_start", toolName: "write", toolCallId: "w", args: { path: "workspace/out/topic.json" } },
    { timestamp: "t", eventType: "tool_execution_end", toolName: "write", toolCallId: "w", isError: true },
    { timestamp: "t", eventType: "harness_end", stop_reason: "human_denied" },
  ];
  rmSync(join(root, "workspace/out"), { recursive: true, force: true });
  mkdirSync(join(root, "workspace/out"), { recursive: true });
  assert.equal(checkCase(rows, failStop, root).pass, true);
  put("workspace/out/topic.json", "{}");
  assert.match(checkCase(rows, failStop, root).reasons.join(), /topic.json should not exist/);
});
