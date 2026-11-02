import type { Baseline, CaseResult } from "./baseline.js";
import type { Usage } from "@earendil-works/pi-ai";
import { sumUsage } from "./usage.js";

export const DEFAULT_MODEL = "ollama/qwen3.8:27b";
export type Attempt = CaseResult & { attempt?: number; tracePath?: string; exitCode?: number | null; error?: string; usage?: Usage };
export type CaseSummary = {
  id: string;
  chapter?: string;
  passCount: number;
  total: number;
  passRate: number;
  flaky: boolean;
  stopReasons: Record<string, number>;
  medianDurationMs: number;
  attempts: Attempt[];
};
export type StabilitySummary = {
  model: string;
  startedAt: string;
  finishedAt: string;
  passCount: number;
  total: number;
  cases: CaseSummary[];
  usage?: Usage;
};

export function parseRepeat(args: string[]): number {
  if (args.length === 0) return 1;
  const value = args.length === 2 && args[0] === "--repeat" ? args[1]
    : args.length === 1 && args[0].startsWith("--repeat=") ? args[0].slice(9) : "";
  const repeat = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(repeat) || repeat < 1) {
    throw new Error("Usage: npm run eval -- --repeat N (N must be a positive integer)");
  }
  return repeat;
}

/** 默认本地结果不参与提交；签收基线另由 UPDATE_BASELINE 显式更新。 */
export function runDirectory(modelId: string, archive = false): string {
  // Keep existing Ollama artifact paths stable; remote providers retain their prefix.
  const slug = modelId.replace(/^ollama\//, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "") || "model";
  return `evals/runs/${archive ? "" : "local/"}${slug}`;
}

/** 只改变归档文本；验收仍使用未改写的 trace 和本轮真实产物。 */
export function scrubPaths(text: string, harnessRoot: string, repoRoot: string): string {
  return text.split(harnessRoot).join(".").split(repoRoot).join("../..");
}

/** 输入也支持旧版 baseline。重复运行逐条保留，绝不按 case id 覆盖。 */
export function aggregateRuns(runs: (Baseline | StabilitySummary)[]): StabilitySummary {
  if (runs.length === 0) throw new Error("No runs to report");
  if (runs.some(r => r.model !== runs[0].model)) throw new Error("All runs must use the same model; report models separately");
  const grouped = new Map<string, Attempt[]>();
  for (const run of runs) {
    const results = "cases" in run ? run.cases.flatMap(c => c.attempts) : run.results;
    for (const result of results) {
      const attempts = grouped.get(result.id) ?? [];
      attempts.push({ ...result, attempt: attempts.length + 1 });
      grouped.set(result.id, attempts);
    }
  }
  if (grouped.size === 0) throw new Error("No case results to report");
  const cases = [...grouped].map(([id, attempts]): CaseSummary => {
    const passCount = attempts.filter(r => r.pass).length;
    const durations = attempts.map(r => r.durationMs).sort((a, b) => a - b);
    const mid = Math.floor(durations.length / 2);
    const stopReasons: Record<string, number> = {};
    for (const r of attempts) {
      const reason = r.stop_reason ?? "missing";
      stopReasons[reason] = (stopReasons[reason] ?? 0) + 1;
    }
    return {
      id, chapter: attempts[0].chapter, passCount, total: attempts.length,
      passRate: passCount / attempts.length, flaky: passCount < attempts.length,
      stopReasons, medianDurationMs: durations.length % 2 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2,
      attempts,
    };
  });
  return {
    model: runs[0].model,
    startedAt: runs.map(r => r.startedAt).sort()[0],
    finishedAt: runs.map(r => r.finishedAt).sort().at(-1)!,
    passCount: cases.reduce((n, c) => n + c.passCount, 0),
    total: cases.reduce((n, c) => n + c.total, 0), cases,
    usage: sumUsage(cases.flatMap(c => c.attempts.flatMap(a => a.usage ? [a.usage] : []))),
  };
}

const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
export function formatStabilityReport(summary: StabilitySummary): string {
  const lines = [
    `model=${summary.model}  pass=${summary.passCount}/${summary.total}  startedAt=${summary.startedAt}  finishedAt=${summary.finishedAt}`,
    ...(summary.usage ? [`Provider-reported tokens: input=${summary.usage.input}, output=${summary.usage.output}, cacheRead=${summary.usage.cacheRead}, cacheWrite=${summary.usage.cacheWrite}, total=${summary.usage.totalTokens}; catalog-estimated USD=$${summary.usage.cost.total.toFixed(6)} (not an invoice).`] : []),
    "", "| case id | chapter | pass / attempts (rate) | flaky | stop_reason distribution | median (ms) |",
    "| --- | --- | --- | --- | --- | ---: |",
    ...summary.cases.map(c => `| ${cell(c.id)} | ${cell(c.chapter ?? "—")} | ${c.passCount}/${c.total} (${(c.passRate * 100).toFixed(2)}%) | ${c.flaky ? "yes" : "no"} | ${Object.entries(c.stopReasons).map(([k, v]) => `${cell(k)}: ${v}`).join(", ")} | ${c.medianDurationMs} |`),
    "", "flaky = pass rate <100%（含 0%；按本实验定义）。耗时包含子进程启动和验收。",
    "", summary.passCount === summary.total ? "SIGN-OFF: OK（全部 PASS）" : "SIGN-OFF: BLOCKED（有 FAIL）",
    "", "每次运行 / Attempts", "",
    "| case id | attempt | result | stop_reason | duration (ms) | trace | reasons / error |",
    "| --- | ---: | --- | --- | ---: | --- | --- |",
    ...summary.cases.flatMap(c => c.attempts.map((r, i) => `| ${cell(c.id)} | ${i + 1} | ${r.pass ? "PASS" : "FAIL"} | ${cell(r.stop_reason ?? "missing")} | ${r.durationMs} | ${cell(r.tracePath ?? "—")} | ${cell([...r.reasons, ...(r.error ? [r.error] : [])].join("; "))} |`)),
  ];
  return lines.join("\n");
}
