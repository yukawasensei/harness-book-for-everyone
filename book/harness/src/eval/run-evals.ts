// Ch6 · 串行跑 case × repeat；默认写本地忽略目录，签收基线须显式更新。
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCase, parseTrace, type CaseSpec } from "../check-trace.js";
import { compareBaselines, formatReport, summarize, type Baseline } from "./baseline.js";
import { configuredModel } from "./model-config.js";
import { scrubSecrets } from "../secrets.js";
import type { Usage } from "@earendil-works/pi-ai";
import { aggregateRuns, DEFAULT_MODEL, formatStabilityReport, parseRepeat, runDirectory, scrubPaths, type Attempt } from "./stability.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = resolve(root, "../..");
const repeat = parseRepeat(process.argv.slice(2));
const modelId = configuredModel(root); // 先检查；未登记时绝不创建结果目录或沿用旧 trace。
const timeout = Number(process.env.EVAL_TIMEOUT_MS ?? 300_000);
if (!Number.isSafeInteger(timeout) || timeout <= 0) throw new Error("EVAL_TIMEOUT_MS must be a positive integer");
const updateBaseline = process.env.UPDATE_BASELINE === "1";
if (updateBaseline && (modelId !== DEFAULT_MODEL || repeat !== 1 || process.env.CASES !== undefined)) {
  throw new Error("UPDATE_BASELINE=1 requires full default Qwen, repeat=1, and CASES unset");
}
const cases = JSON.parse(readFileSync(resolve(root, "cases/cases.json"), "utf8")) as CaseSpec[];
const only = process.env.CASES?.split(",").map(s => s.trim()).filter(Boolean);
if (only?.some(id => !cases.some(c => c.id === id))) throw new Error(`unknown CASES id: ${only.filter(id => !cases.some(c => c.id === id)).join(",")}`);
const selected = only ? cases.filter(c => only.includes(c.id)) : cases;
if (selected.length === 0) throw new Error(`no case matches CASES=${process.env.CASES}`);

const baselinePath = resolve(root, "evals/baseline.json");
const previous = modelId === DEFAULT_MODEL && existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, "utf8")) as Baseline : undefined;
const startedAt = new Date().toISOString();
const directory = runDirectory(modelId, process.env.EVAL_ARCHIVE === "1");
const runDir = resolve(root, directory, `${startedAt.replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`);
const tracesDir = resolve(runDir, "traces");
mkdirSync(tracesDir, { recursive: true });
mkdirSync(resolve(root, "traces"), { recursive: true });
const scrub = (text: string) => scrubPaths(scrubSecrets(text), root, repoRoot);
const results: Attempt[] = [];
for (const spec of selected) {
  for (let attempt = 1; attempt <= repeat; attempt++) {
    const latest = resolve(root, "traces/latest.jsonl");
    writeFileSync(latest, "", "utf8"); // 防止启动失败把上一轮的 trace 当成本轮。
    const t0 = Date.now();
    process.stderr.write(`[eval] ${spec.id} ${attempt}/${repeat} ... `);
    const child = spawnSync(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: root,
      env: { ...process.env, MODEL_ID: modelId, CASE_ID: spec.id, NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" },
      encoding: "utf8", timeout,
    });
    const rawTrace = readFileSync(latest, "utf8");
    let rows: ReturnType<typeof parseTrace> = [];
    let verdict = { pass: false, reasons: [] as string[] };
    let error: string | undefined;
    try {
      rows = parseTrace(rawTrace);
      // 用真实路径和本轮产物验收，再改写归档路径。
      verdict = rows.length ? checkCase(rows, spec, root) : { pass: false, reasons: ["no trace"] };
    } catch (err) {
      verdict = { pass: false, reasons: [`invalid trace: ${err instanceof Error ? err.message : String(err)}`] };
    }
    const end = rows.filter(r => r.eventType === "harness_end").at(-1);
    if (child.error || child.signal || (child.status !== 0 && child.status !== 2)) {
      error = scrub([end?.error, child.error?.message, child.signal, `exit=${child.status}`, child.stderr?.trim()].filter(Boolean).join("; "));
      verdict = { pass: false, reasons: [...verdict.reasons, error] };
    }
    const tracePath = relative(root, resolve(tracesDir, `${spec.id}-${attempt}.jsonl`));
    const context = JSON.stringify({ eventType: "eval_context", timestamp: new Date(t0).toISOString(), model: modelId, attempt, repeat, prompt: spec.prompt, tools: spec.allowed_tools, contextNotes: { case: spec, timeoutMs: timeout, config: "pi-agent/models.json", isolation: "createIsolatedPi; in-memory session; thinking off" } });
    const archived = `${scrub(context)}\n${scrub(rawTrace)}`;
    writeFileSync(resolve(root, tracePath), archived, "utf8");
    writeFileSync(latest, archived, "utf8");
    results.push({
      id: spec.id, chapter: (spec as { chapter?: string }).chapter, attempt, tracePath,
      pass: verdict.pass, stop_reason: (end?.stop_reason as string) ?? null,
      tools: rows.filter(r => r.eventType === "tool_execution_start").map(r => String(r.toolName)),
      reasons: verdict.reasons.map(scrub), durationMs: Date.now() - t0, exitCode: child.status, ...(error ? { error } : {}),
      ...(end?.usage ? { usage: end.usage as Usage } : {}),
    });
    process.stderr.write(`${verdict.pass ? "PASS" : "FAIL"} (${results.at(-1)!.durationMs}ms, stop=${end?.stop_reason ?? "missing"})\n`);
  }
}

// Scrub once more across complete summaries/reports, not just archived trace rows.
const current = JSON.parse(scrub(JSON.stringify(summarize({ model: modelId, startedAt, finishedAt: new Date().toISOString() }, results)))) as Baseline;
const stability = aggregateRuns([current]);
// 基线对比按 case 聚合：任何一次失败都阻止签收。
const perCase = summarize(current, stability.cases.map(c => ({ ...(c.attempts.find(r => !r.pass) ?? c.attempts[0]), pass: !c.flaky })));
const comparable = previous && only ? { ...previous, results: previous.results.filter(r => only.includes(r.id)) } : previous;
const changes = compareBaselines(comparable, perCase);
const report = `${formatStabilityReport(stability)}\n\n${formatReport(perCase, changes)}\n`;
console.log(report);
writeFileSync(resolve(runDir, "summary.json"), `${JSON.stringify({ ...stability, repeat, timeoutMs: timeout, partial: Boolean(only) }, null, 2)}\n`, "utf8");
writeFileSync(resolve(runDir, "report.md"), report, "utf8");
console.log(`Artifacts: ${relative(root, runDir)}/{summary.json,report.md,traces/}`);
process.exitCode = stability.passCount === stability.total && !changes.some(c => c.kind === "regressed") ? 0 : 1;
if (updateBaseline && process.exitCode === 0) {
  mkdirSync(resolve(root, "evals/traces"), { recursive: true });
  const baselineResults = current.results.map(result => {
    const tracePath = `evals/traces/${result.id}.jsonl`;
    copyFileSync(resolve(tracesDir, `${result.id}-1.jsonl`), resolve(root, tracePath));
    return { ...result, tracePath };
  });
  writeFileSync(baselinePath, `${JSON.stringify({ ...current, results: baselineResults }, null, 2)}\n`, "utf8");
  console.log("Updated baseline: evals/baseline.json and evals/traces/");
}
