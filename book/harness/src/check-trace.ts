// Ch2 · 验收：trace 是否满足 case 的 expect（工具名 + stop_reason）。
// Ch3 · 增量：可断言工具参数的真实类型（arg_types），以 trace 为准，不信最终回答。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { TraceRow } from "./trace.js";

export type CaseSpec = {
  id: string;
  prompt: string;
  allowed_tools: string[];
  /** Ch4：最多几轮（默认 8）。 */
  max_turns?: number;
  /** Ch4：自定义工具超时毫秒（默认 0 = 不设）。 */
  tool_timeout_ms?: number;
  /** Ch7：上下文预算（字符，0 = 不设），超了就停。 */
  context_budget_chars?: number;
  /** Ch7：单次工具结果上限（字符，0 = 不截），超了就截断后继续。 */
  tool_result_max_chars?: number;
  /** Ch7：工具失败后由 harness 重试几次，用完怎么办，退避基数。 */
  max_retries?: number;
  on_exhausted?: "stop" | "degrade";
  retry_backoff_ms?: number;
  /** Ch7：flaky 演示工具前几次必定失败（默认一直失败）。 */
  flaky_fail_times?: number;
  expect: {
    tool_called?: string;
    stop_reason: string;
    /** 例如 { "name": "string" }：每次调用 tool_called 时，参数的 typeof 必须如此。 */
    arg_types?: Record<string, string>;
    /** Ch5：这些工具哪怕被模型请求，也不得执行成功。 */
    tools_not_executed?: string[];
    /** Ch7：trace 里必须出现的事件及最少次数，例如 { "tool_retry": 2 }。 */
    events?: Record<string, number>;
  };
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
  const starts = rows.filter((r) => r.eventType === "tool_execution_start");
  const toolNames = starts.map((r) => String(r.toolName));
  const end = rows.filter((r) => r.eventType === "harness_end").at(-1);

  if (!end) reasons.push("missing harness_end");
  else if (end.stop_reason !== spec.expect.stop_reason) {
    reasons.push(`stop_reason=${String(end.stop_reason)}, expected ${spec.expect.stop_reason}`);
  }
  if (spec.expect.tool_called && !toolNames.includes(spec.expect.tool_called)) {
    reasons.push(`tool ${spec.expect.tool_called} not called (saw: ${toolNames.join(",") || "none"})`);
  }
  // Ch5：白名单外的工具“被请求但被拦下/报错”不算违规；真正执行成功才算。
  const succeeded = new Set(
    rows.filter((r) => r.eventType === "tool_execution_end" && r.isError === false).map((r) => String(r.toolCallId)),
  );
  const outside = starts
    .filter((r) => !spec.allowed_tools.includes(String(r.toolName)) && succeeded.has(String(r.toolCallId)))
    .map((r) => String(r.toolName));
  if (outside.length > 0) reasons.push(`tools outside allowlist: ${outside.join(",")}`);
  for (const name of spec.expect.tools_not_executed ?? []) {
    if (starts.some((r) => r.toolName === name && succeeded.has(String(r.toolCallId)))) {
      reasons.push(`tool ${name} was executed`);
    }
  }

  for (const [eventType, min] of Object.entries(spec.expect.events ?? {})) {
    const count = rows.filter((r) => r.eventType === eventType).length;
    if (count < min) reasons.push(`event ${eventType} x${count}, expected >= ${min}`);
  }

  const argTypes = spec.expect.arg_types;
  if (argTypes && spec.expect.tool_called) {
    for (const start of starts.filter((r) => r.toolName === spec.expect.tool_called)) {
      const args = (start.args ?? {}) as Record<string, unknown>;
      for (const [key, type] of Object.entries(argTypes)) {
        if (typeof args[key] !== type) {
          reasons.push(`arg ${key} is ${typeof args[key]} (${JSON.stringify(args[key])}), expected ${type}`);
        }
      }
    }
  }

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
