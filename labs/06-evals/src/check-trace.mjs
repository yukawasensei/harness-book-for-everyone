#!/usr/bin/env node
/**
 * Optional lab05 hook: given a JSONL trace, check stop_reason / tool names
 * against one case id from cases.json. No model calls.
 *
 * Usage:
 *   node src/check-trace.mjs <trace.jsonl> [caseId]
 * Default caseId: max-turns-brake if MAX_TURNS was 1, else read-lesson-input
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

const rows = readFileSync(resolve(tracePath), "utf8")
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line));

const toolNames = rows
  .filter((row) => row.eventType === "tool_execution_start")
  .map((row) => row.toolName)
  .filter(Boolean);

const endRow = [...rows]
  .reverse()
  .find((row) => row.eventType === "harness_end" || row.eventType === "harness_stop");
const stopReason = endRow?.stop_reason;

const expect = item.expect;
const failures = [];

if (expect.stop_reason !== undefined && stopReason !== expect.stop_reason) {
  failures.push(`stop_reason want=${expect.stop_reason} got=${stopReason}`);
}
if (expect.stop_reason_in !== undefined && !expect.stop_reason_in.includes(stopReason)) {
  failures.push(`stop_reason ${stopReason} not in ${JSON.stringify(expect.stop_reason_in)}`);
}
if (expect.tool_names_include) {
  for (const name of expect.tool_names_include) {
    if (!toolNames.includes(name)) {
      failures.push(`missing tool ${name}; saw ${JSON.stringify(toolNames)}`);
    }
  }
}
if (expect.tool_names_exclude) {
  for (const name of expect.tool_names_exclude) {
    if (toolNames.includes(name)) {
      failures.push(`forbidden tool present: ${name}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`FAIL case=${caseId}`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(
  `PASS case=${caseId} stop_reason=${stopReason} tools=${JSON.stringify(toolNames)} trace=${tracePath}`,
);
