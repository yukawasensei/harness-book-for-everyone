#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertExpect, loadTrace, summarizeTrace } from "./assert-trace.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(resolve(__dirname, "../cases.json"), "utf8"));

const tracePath = process.argv[2];
const caseId = process.argv[3] ?? "max-turns-brake";

if (!tracePath) {
  console.error("Usage: node src/check-trace.mjs <trace.jsonl> [caseId]");
  process.exit(1);
}

const item = cases.find((c) => c.id === caseId);
if (!item) {
  console.error(`Unknown caseId: ${caseId}`);
  process.exit(1);
}

const rows = loadTrace(resolve(tracePath));
const summary = summarizeTrace(rows);
const failures = assertExpect(item.expect, summary);

if (failures.length > 0) {
  console.error(`FAIL case=${caseId}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `PASS case=${caseId} stop_reason=${summary.stopReason} tools=${JSON.stringify(summary.toolNames)} trace=${tracePath}`,
);
