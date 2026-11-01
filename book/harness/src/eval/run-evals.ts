// Ch6 · 跑全部 case → 存每条 trace → 写 evals/baseline.json → 打印报表。
// 用法：npm run eval            （全部）
//       CASES=read-happy,max-turns-brake npm run eval   （只跑部分；不覆盖 baseline）
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCase, parseTrace, type CaseSpec } from "../check-trace.js";
import { compareBaselines, formatReport, summarize, type Baseline, type CaseResult } from "./baseline.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = resolve(root, "../..");
const cases = JSON.parse(readFileSync(resolve(root, "cases/cases.json"), "utf8")) as CaseSpec[];
const only = process.env.CASES?.split(",").map((s) => s.trim()).filter(Boolean);
const selected = only ? cases.filter((c) => only.includes(c.id)) : cases;
if (selected.length === 0) throw new Error(`no case matches CASES=${process.env.CASES}`);

const baselinePath = resolve(root, "evals/baseline.json");
// 全量运行才更新已归档的 trace；只跑部分时写到不入库的 traces/partial/，避免和 baseline 对不上。
const tracesDir = resolve(root, only ? "traces/partial" : "evals/traces");
mkdirSync(tracesDir, { recursive: true });
const previous = existsSync(baselinePath) ? (JSON.parse(readFileSync(baselinePath, "utf8")) as Baseline) : undefined;

/** 公开仓：存档前抹掉本机路径。 */
const scrub = (text: string) => text.split(repoRoot).join("<repo-root>");

const startedAt = new Date().toISOString();
const results: CaseResult[] = [];
for (const spec of selected) {
  const t0 = Date.now();
  process.stderr.write(`[eval] ${spec.id} ... `);
  const child = spawnSync("npx", ["tsx", "src/index.ts"], {
    cwd: root,
    env: { ...process.env, CASE_ID: spec.id, NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" },
    encoding: "utf8",
    timeout: Number(process.env.EVAL_TIMEOUT_MS ?? 300_000),
  });
  const latest = resolve(root, "traces/latest.jsonl");
  const traceText = existsSync(latest) ? scrub(readFileSync(latest, "utf8")) : "";
  writeFileSync(resolve(tracesDir, `${spec.id}.jsonl`), traceText, "utf8");
  const rows = parseTrace(traceText);
  const verdict = rows.length > 0 ? checkCase(rows, spec, root) : { pass: false, reasons: [`no trace (exit=${child.status} ${child.error?.message ?? ""})`] };
  const end = rows.filter((r) => r.eventType === "harness_end").at(-1);
  const tools = rows.filter((r) => r.eventType === "tool_execution_start").map((r) => String(r.toolName));
  results.push({ id: spec.id, chapter: (spec as { chapter?: string }).chapter, pass: verdict.pass, stop_reason: (end?.stop_reason as string) ?? null, tools, reasons: verdict.reasons, durationMs: Date.now() - t0 });
  process.stderr.write(`${verdict.pass ? "PASS" : "FAIL"}\n`);
}

const current = summarize({ model: `ollama/${process.env.MODEL_ID ?? "qwen3.8:27b"}`, startedAt, finishedAt: new Date().toISOString() }, results);
const comparable = previous && only ? { ...previous, results: previous.results.filter((r) => only.includes(r.id)) } : previous;
const changes = compareBaselines(comparable, current);
console.log(formatReport(current, changes));
if (!only) writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
process.exitCode = current.passCount === current.total && !changes.some((c) => c.kind === "regressed") ? 0 : 1;
