import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateRuns, formatStabilityReport, parseRepeat, runDirectory, scrubPaths } from "./eval/stability.js";
import { validateModel } from "./eval/model-config.js";
import type { Baseline, CaseResult } from "./eval/baseline.js";

const result = (id: string, pass: boolean, durationMs: number, stop_reason: string | null = "success"): CaseResult => ({
  id, chapter: "ch02", pass, durationMs, stop_reason, tools: ["read"], reasons: pass ? [] : ["expected success"],
});
const run = (results: CaseResult[]): Baseline => ({ model: "ollama/test", startedAt: "t0", finishedAt: "t1", passCount: results.filter(r => r.pass).length, total: results.length, results });

test("repeat defaults to one and rejects ambiguous or invalid CLI arguments", () => {
  assert.equal(parseRepeat([]), 1);
  assert.equal(parseRepeat(["--repeat", "5"]), 5);
  assert.equal(parseRepeat(["--repeat=2"]), 2);
  for (const args of [["--repeat"], ["--repeat", "0"], ["--repeat", "-1"], ["--repeat", "1.5"], ["--repeat", "Infinity"], ["--repeat", "2x"], ["--repeat", "2", "--repeat", "3"], ["--typo"]]) {
    assert.throws(() => parseRepeat(args), /repeat/);
  }
});

test("aggregate keeps every attempt, per-case denominator, stop counts and numeric median", () => {
  const summary = aggregateRuns([
    run([result("a", true, 100), result("b", false, 9, null)]),
    run([result("a", false, 2, "model_error"), result("b", false, 3, "model_error")]),
    run([result("a", true, 10)]),
  ]);
  assert.equal(summary.passCount, 2);
  assert.equal(summary.total, 5);
  const [a, b] = summary.cases;
  assert.equal(a.passCount, 2);
  assert.equal(a.total, 3);
  assert.equal(a.passRate, 2 / 3);
  assert.equal(a.flaky, true);
  assert.equal(a.medianDurationMs, 10);
  assert.deepEqual(a.stopReasons, { success: 2, model_error: 1 });
  assert.equal(a.attempts[1].durationMs, 2);
  assert.equal(b.medianDurationMs, 6);
  assert.equal(b.flaky, true); // 按任务定义，0% 也标 flaky。
  assert.deepEqual(b.stopReasons, { missing: 1, model_error: 1 });
  assert.deepEqual(b.attempts[0].reasons, ["expected success"]);
  const text = formatStabilityReport(summary);
  assert.match(text, /a \| ch02 \| 2\/3 \(66\.67%\) \| yes/);
  assert.match(text, /SIGN-OFF: BLOCKED/);
  assert.match(text, /expected success/);
});

test("old single-run baseline is reportable; all green is stable", () => {
  const summary = aggregateRuns([run([result("a", true, 4)])]);
  assert.equal(summary.cases[0].flaky, false);
  assert.match(formatStabilityReport(summary), /1\/1 \(100\.00%\) \| no/);
  assert.match(formatStabilityReport(summary), /SIGN-OFF: OK/);
  assert.throws(() => aggregateRuns([]), /No runs/);
  assert.throws(() => aggregateRuns([run([])]), /No case/);
  assert.throws(() => aggregateRuns([run([result("a", true, 1)]), { ...run([]), model: "ollama/other" }]), /same model/);
});

test("baseline is reserved for full default-model single runs; slugs cannot escape", () => {
  assert.equal(runDirectory("qwen3.8:27b", 1, false), undefined);
  assert.equal(runDirectory("qwen3.8:27b", 5, false), "evals/runs/qwen3.8-27b");
  assert.equal(runDirectory("qwen3.8:27b", 1, true), "evals/runs/qwen3.8-27b");
  assert.equal(runDirectory("vendor/other:4b", 1, false), "evals/runs/vendor-other-4b");
  assert.ok(!runDirectory("../../escape", 1, false)!.split("/").includes(".."));
});

test("archived paths are relative, including errors and denied paths outside harness", () => {
  assert.equal(scrubPaths("/project/book/harness/lesson-input.md /project/README.md", "/project/book/harness", "/project"), "./lesson-input.md ../../README.md");
});

test("only explicitly registered model ids are accepted", () => {
  const config = { providers: { ollama: { models: [{ id: "registered" }] } } };
  assert.equal(validateModel(config, "registered"), "registered");
  assert.throws(() => validateModel(config, "unknown"), /unknown.*pi-agent\/models.json/);
  assert.throws(() => validateModel({}, "unknown"), /unknown.*pi-agent\/models.json/);
});
