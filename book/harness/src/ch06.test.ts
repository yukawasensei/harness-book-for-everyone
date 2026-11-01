import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canSignOff, compareBaselines, formatReport, summarize, type CaseResult } from "./eval/baseline.js";
import type { CaseSpec } from "./check-trace.js";

const meta = { model: "ollama/qwen3.8:27b", startedAt: "t0", finishedAt: "t1" };
const r = (id: string, pass: boolean, stop = pass ? "success" : "model_error"): CaseResult => ({
  id, pass, stop_reason: stop, tools: [], reasons: pass ? [] : ["x"], durationMs: 1,
});

test("summarize counts passes", () => {
  const b = summarize(meta, [r("a", true), r("b", false)]);
  assert.equal(b.passCount, 1);
  assert.equal(b.total, 2);
});

test("compare: PASS→FAIL is a regression and blocks sign-off", () => {
  const prev = summarize(meta, [r("a", true), r("b", true)]);
  const curr = summarize(meta, [r("a", true), r("b", false)]);
  const changes = compareBaselines(prev, curr);
  assert.deepEqual(changes, [{ id: "b", kind: "regressed", before: "success", after: "model_error" }]);
  assert.equal(canSignOff(curr, changes), false);
});

test("compare: FAIL→PASS is a fix; new and removed cases are listed", () => {
  const prev = summarize(meta, [r("a", false), r("gone", true)]);
  const curr = summarize(meta, [r("a", true), r("added", true)]);
  const kinds = compareBaselines(prev, curr).map((c) => `${c.kind}:${c.id}`).sort();
  assert.deepEqual(kinds, ["fixed:a", "new:added", "removed:gone"]);
});

test("sign-off needs every case green, even with no previous baseline", () => {
  const curr = summarize(meta, [r("a", true)]);
  assert.equal(canSignOff(curr, compareBaselines(undefined, curr)), true);
  const red = summarize(meta, [r("a", false)]);
  assert.equal(canSignOff(red, compareBaselines(undefined, red)), false);
});

test("report shows FAIL reasons and the sign-off verdict", () => {
  const curr = summarize(meta, [r("a", true), r("b", false)]);
  const text = formatReport(curr, []);
  assert.match(text, /pass=1\/2/);
  assert.match(text, /b\s+FAIL.*← x/);
  assert.match(text, /SIGN-OFF: BLOCKED/);
});

test("every case has id, chapter, prompt, allowed_tools and expect.stop_reason", () => {
  const cases = JSON.parse(readFileSync("cases/cases.json", "utf8")) as (CaseSpec & { chapter?: string })[];
  const ids = new Set<string>();
  for (const c of cases) {
    assert.ok(c.id && !ids.has(c.id), `duplicate or empty id ${c.id}`);
    ids.add(c.id);
    assert.match(String(c.chapter), /^ch\d\d$/);
    assert.ok(c.prompt.length > 0);
    assert.ok(Array.isArray(c.allowed_tools) && c.allowed_tools.length > 0);
    assert.ok(c.expect.stop_reason);
  }
});
