import assert from "node:assert/strict";
import { test } from "node:test";
import { rejectInvalidJsonWrite } from "./gates/json-write.js";
import type { TraceRow } from "./trace.js";

test("H3: invalid JSON is rejected with line/column and a retry instruction", () => {
  const rows: TraceRow[] = [];
  const args = { path: "workspace/out/board.json", content: '{\n  "shots": [}\n' };
  const refusal = rejectInvalidJsonWrite("write", "bad", args, row => rows.push(row));
  assert.equal(refusal?.block, true);
  assert.match(refusal!.reason, /line 2, column 13/);
  assert.match(refusal!.reason, /retry/i);
  assert.equal(rows[0].eventType, "json_write_rejected");
  assert.equal(rows[0].toolCallId, "bad");
  assert.equal(rows[0].line, 2);
  assert.equal(rows[0].column, 13);
});

test("H3: valid JSON and other extensions pass; empty/truncated JSON fails", () => {
  const check = (path: string, content: string) => rejectInvalidJsonWrite("write", "c", { path, content }, () => {});
  for (const content of ['{"shots":[]}', "null", "[]", '"text"', "12"]) assert.equal(check("file.JSON", content), undefined);
  assert.equal(check("script.md", "# script"), undefined);
  assert.equal(rejectInvalidJsonWrite("read", "c", { path: "file.json" }, () => {}), undefined);
  for (const content of ["", '{"shots":', "```json\n{}\n```", '{"text":"bad "quotes""}']) {
    assert.equal(check("file.json", content)?.block, true);
  }
});
