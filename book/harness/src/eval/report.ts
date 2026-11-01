// Ch6 · 只读报表：读 evals/baseline.json，不跑模型。签字前先看这个。
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatReport, type Baseline } from "./baseline.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const baseline = JSON.parse(readFileSync(resolve(root, "evals/baseline.json"), "utf8")) as Baseline;
console.log(formatReport(baseline, []));
