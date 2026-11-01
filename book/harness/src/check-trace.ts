// Ch2 · 验收：trace 是否满足 case 的 expect（工具名 + stop_reason）。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { TraceRow } from "./trace.js";

export type CaseSpec = {
  id: string;
  prompt: string;
  allowed_tools: string[];
  expect: { tool_called?: string; stop_reason: string };
};

export type CheckResult = { pass: boolean; reasons: string[] };

export function parseTrace(text: string): TraceRow[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as TraceRow);
}

export function checkTrace(rows: TraceRow[], spec: CaseSpec): CheckResult {
  const reasons: string[] = [];
  const toolNames = rows
    .filter((r) => r.eventType === "tool_execution_start")
    .map((r) => String(r.toolName));
  const end = rows.filter((r) => r.eventType === "harness_end").at(-1);

  if (!end) reasons.push("missing harness_end");
  else if (end.stop_reason !== spec.expect.stop_reason) {
    reasons.push(`stop_reason=${String(end.stop_reason)}, expected ${spec.expect.stop_reason}`);
  }
  if (spec.expect.tool_called && !toolNames.includes(spec.expect.tool_called)) {
    reasons.push(`tool ${spec.expect.tool_called} not called (saw: ${toolNames.join(",") || "none"})`);
  }
  const outside = toolNames.filter((name) => !spec.allowed_tools.includes(name));
  if (outside.length > 0) reasons.push(`tools outside allowlist: ${outside.join(",")}`);

  return { pass: reasons.length === 0, reasons };
}

// CLI: npm run check -- <trace.jsonl> <case-id>
if (process.argv[1]?.endsWith("check-trace.ts")) {
  const [tracePath = "traces/latest.jsonl", caseId = "read-happy"] = process.argv.slice(2);
  const cases = JSON.parse(readFileSync(resolve("cases/cases.json"), "utf8")) as CaseSpec[];
  const spec = cases.find((c) => c.id === caseId);
  if (!spec) throw new Error(`unknown case ${caseId}`);
  const result = checkTrace(parseTrace(readFileSync(resolve(tracePath), "utf8")), spec);
  console.log(`${result.pass ? "PASS" : "FAIL"} ${caseId}${result.pass ? "" : ` — ${result.reasons.join("; ")}`}`);
  process.exitCode = result.pass ? 0 : 1;
}
