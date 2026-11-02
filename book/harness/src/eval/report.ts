// 只读报表；支持旧 baseline、repeat summary，以及同模型的多份结果。
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Baseline } from "./baseline.js";
import { aggregateRuns, formatStabilityReport, type StabilitySummary } from "./stability.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const paths = process.argv.slice(2);
const runs = (paths.length ? paths : ["evals/baseline.json"]).map(path => {
  const input = resolve(root, path);
  const json = statSync(input).isDirectory() ? resolve(input, "summary.json") : input;
  return JSON.parse(readFileSync(json, "utf8")) as Baseline | StabilitySummary;
});
console.log(formatStabilityReport(aggregateRuns(runs)));
