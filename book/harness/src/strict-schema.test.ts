import assert from "node:assert/strict";
import { test } from "node:test";
import { Type, validateToolArguments } from "@earendil-works/pi-ai";
import { helloTool } from "./tools/hello.js";
import { rejectInvalidArguments } from "./gates/strict-schema.js";
import type { TraceRow } from "./trace.js";
import { checkTrace, parseTrace, type CaseSpec } from "./check-trace.js";
import { readFileSync } from "node:fs";

test("H2: reject original number despite SDK coercion, preserve raw args and audit refusal", () => {
  const raw = { name: 123 };
  assert.equal((validateToolArguments(helloTool as never,
    { type: "toolCall", id: "bad", name: "hello", arguments: raw }) as { name: string }).name, "123");
  const rows: TraceRow[] = [];
  const refusal = rejectInvalidArguments(helloTool, "bad", raw, row => rows.push(row));
  assert.equal(refusal?.block, true);
  assert.match(refusal!.reason, /name.*string/i);
  assert.match(refusal!.reason, /retry/i);
  assert.deepEqual(raw, { name: 123 });
  assert.equal(rows[0].eventType, "schema_validation_rejected");
  assert.equal(rows[0].toolCallId, "bad");
  assert.deepEqual(rows[0].args, raw);
  assert.equal(rejectInvalidArguments(helloTool, "fixed", { name: "123" }, row => rows.push(row)), undefined);
  assert.equal(rows.length, 1);
});

test("H2: strict schema also rejects nested values, missing fields and constraint violations", () => {
  const tool = { name: "nested", description: "test", parameters: Type.Object({
    items: Type.Array(Type.Object({ count: Type.Integer({ minimum: 1 }) })),
  }) };
  for (const args of [{}, { items: [{ count: "1" }] }, { items: [{ count: 0 }] }]) {
    assert.equal(rejectInvalidArguments(tool, "bad", args, () => {})?.block, true);
  }
  assert.equal(rejectInvalidArguments(tool, "ok", { items: [{ count: 1 }] }, () => {}), undefined);
});

test("H2: recovery requires audited rejection AND a later valid successful call", () => {
  const spec = (JSON.parse(readFileSync("cases/cases.json", "utf8")) as CaseSpec[])
    .find(spec => spec.id === "custom-tool-schema-conflict")!;
  const good = parseTrace(readFileSync("fixtures/custom-tool-call.trace.jsonl", "utf8"));
  const rejection: TraceRow[] = [
    { timestamp: "t", eventType: "tool_execution_start", toolName: "hello", toolCallId: "bad", args: { name: 123 } },
    { timestamp: "t", eventType: "schema_validation_rejected", toolName: "hello", toolCallId: "bad", args: { name: 123 } },
    { timestamp: "t", eventType: "tool_execution_end", toolName: "hello", toolCallId: "bad", isError: true,
      error: "Harness schema validation: /name: must be string. Retry." },
  ];
  assert.equal(checkTrace([...rejection, ...good], spec).pass, true);
  assert.equal(checkTrace([...rejection, good.at(-1)!], spec).pass, false);
  assert.equal(checkTrace([rejection[0], rejection[2], ...good], spec).pass, false);
  assert.equal(checkTrace([rejection[0], rejection[1], { ...rejection[2], isError: false }, ...good], spec).pass, false);
  assert.equal(checkTrace([...good, ...rejection], spec).pass, false);
});
