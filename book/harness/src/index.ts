// Ch2 · 从零写最小 harness / Minimal harness from scratch
// 只做四件事：选模型、限定工具、跑一次会话、把事件和 stop_reason 写进 trace。
// Ch3 · 增量：注册自定义工具；隔离本机 ~/.pi 全局配置（见 isolated-pi.ts）。
// Ch4 · 增量：轮数上限 + 工具超时，停机原因统一记在 run-state。
// Ch5 · 增量：beforeToolCall 里执行白名单复核 + 路径沙箱。
// Ch7 · 增量：上下文预算（超了停 / 工具结果截断）+ 工具重试与降级。
// Ch8 · 增量：第一次开放写入（只能写 writable_dirs）+ 人机确认门。
// Ch9 · 增量：整次运行的成本（token）与延迟预算。
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { createTraceWriter, toTraceRow } from "./trace.js";
import type { CaseSpec } from "./check-trace.js";
import { createIsolatedPi } from "./isolated-pi.js";
import { CUSTOM_TOOLS } from "./tools/index.js";
import { createRunState } from "./run-state.js";
import { createMaxTurnsGuard, finishTurnWhen } from "./gates/max-turns.js";
import { withToolTimeout } from "./gates/tool-timeout.js";
import { decideToolCall } from "./gates/tool-policy.js";
import { estimateContextChars, truncateToolContent } from "./gates/context-budget.js";
import { withRetry } from "./gates/retry.js";
import { createFlakyTool } from "./tools/flaky.js";
import { denyAllApprover, simulatedApprover, ttyApprover } from "./gates/hitl.js";
import { createBudgetGuard } from "./gates/budget.js";

if (process.platform !== "linux") throw new Error("Run the harness inside Linux/WSL");

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const caseId = process.env.CASE_ID ?? "read-happy";
const cases = JSON.parse(readFileSync(resolve(cwd, "cases/cases.json"), "utf8")) as CaseSpec[];
const spec = cases.find((c) => c.id === caseId);
if (!spec) throw new Error(`unknown case ${caseId}`);

const writeTrace = createTraceWriter(resolve(cwd, "traces/latest.jsonl"));
const { agentDir, modelRuntime, settingsManager, resourceLoader } = await createIsolatedPi(cwd);
const modelId = process.env.MODEL_ID ?? "qwen3.8:27b";
const model = modelRuntime.getModel("ollama", modelId);
if (!model) throw new Error(`ollama/${modelId} not configured in pi-agent/models.json`);

const run = createRunState(writeTrace);
const maxTurns = spec.max_turns ?? 8;
const toolTimeoutMs = spec.tool_timeout_ms ?? 0;
const turns = createMaxTurnsGuard(maxTurns);
const contextBudgetChars = spec.context_budget_chars ?? 0;
const toolResultMaxChars = spec.tool_result_max_chars ?? 0;
const retry = { maxRetries: spec.max_retries ?? 0, backoffMs: spec.retry_backoff_ms ?? 0, onExhausted: spec.on_exhausted ?? "stop" } as const;
const now = () => new Date().toISOString();
const budget = createBudgetGuard({ tokenBudget: spec.token_budget ?? 0, latencyBudgetMs: spec.latency_budget_ms ?? 0 });
const writableDirs = spec.writable_dirs ?? [];
const confirmTools = spec.confirm_tools ?? [];
const approver =
  process.env.HITL_MODE === "tty"
    ? ttyApprover(Number(process.env.HITL_TIMEOUT_MS ?? 60_000))
    : spec.hitl_decision
      ? simulatedApprover(spec.hitl_decision)
      : denyAllApprover;

// 每次运行前清空可写目录，保证产物只来自这一次运行。
for (const dir of writableDirs) {
  rmSync(resolve(cwd, dir), { recursive: true, force: true });
  mkdirSync(resolve(cwd, dir), { recursive: true });
}

// 工具白名单写在 harness 里，不靠 prompt；自定义工具也只在白名单里才注册，
// 并统一套上：重试（内层，每次尝试）→ 超时（外层，罩住全部尝试）。
const registry = [...CUSTOM_TOOLS, createFlakyTool(spec.flaky_fail_times ?? Number.POSITIVE_INFINITY)];
const customTools = registry
  .filter((tool) => spec.allowed_tools.includes(tool.name))
  .map((tool) =>
    withRetry(tool, retry, {
      onRetry: (info) => writeTrace({ timestamp: now(), eventType: "tool_retry", ...info }),
      onExhausted: (info) => {
        writeTrace({ timestamp: now(), eventType: info.action === "degrade" ? "tool_degraded" : "retry_exhausted", ...info });
        if (info.action === "stop") run.stop("retry_exhausted", info);
      },
    }),
  )
  .map((tool) => withToolTimeout(tool, toolTimeoutMs, (info) => run.stop("tool_timeout", info)));
const { session, extensionsResult } = await createAgentSession({
  cwd,
  agentDir,
  model,
  modelRuntime,
  settingsManager,
  resourceLoader,
  thinkingLevel: "off",
  tools: spec.allowed_tools,
  customTools,
  sessionManager: SessionManager.inMemory(cwd),
});

// 开跑前留证：这次到底加载了几个扩展、开放了哪些工具、闸门设成多少。
writeTrace({
  timestamp: new Date().toISOString(),
  eventType: "harness_start",
  case_id: spec.id,
  extensions: extensionsResult.extensions.length,
  activeTools: session.getActiveToolNames(),
  maxTurns,
  toolTimeoutMs,
  contextBudgetChars,
  toolResultMaxChars,
  retry,
  writableDirs,
  confirmTools,
  tokenBudget: spec.token_budget ?? 0,
  latencyBudgetMs: spec.latency_budget_ms ?? 0,
});

// pi-agent-core 钩子 1：每轮结束后由 harness 决定要不要继续。
session.agent.finishTurn = finishTurnWhen(({ context, message }) => {
  budget.recordUsage(message.usage);
  if (run.stopped) return true;
  const stop = turns.recordTurn();
  const contextChars = estimateContextChars(context.messages);
  writeTrace({ timestamp: now(), eventType: "turn_guard", turn: turns.completed, maxTurns, contextChars, tokens: budget.tokens, elapsedMs: budget.elapsedMs() });
  if (stop) run.stop("max_turns", { turn: turns.completed, maxTurns });
  // 上下文超预算：在把它喂给下一轮模型之前停下。
  else if (contextBudgetChars > 0 && contextChars > contextBudgetChars) {
    run.stop("context_budget", { contextChars, contextBudgetChars });
  }
  // 整次运行的成本 / 延迟预算：同样在下一次模型调用之前检查。
  const over = budget.check();
  if (over) run.stop(over.stopReason, over.details);
  return run.stopped;
});

// pi-agent-core 钩子 2：工具执行前过策略（白名单复核 + 路径沙箱）；不过就拦下并停机。
// 策略过了，再看要不要人确认（先挡掉越界的，再去打扰人）。
session.agent.beforeToolCall = async ({ toolCall, args }) => {
  const over = budget.check(); // 已经超时/超支，就别再开始新的工具
  if (over) {
    run.stop(over.stopReason, over.details);
    return { block: true, reason: `Harness: ${over.stopReason}`, terminate: true };
  }
  const decision = decideToolCall({ toolName: toolCall.name, args }, { allowedTools: spec.allowed_tools, workspaceRoot: cwd, writableDirs });
  if (!decision.allow) {
    run.stop(decision.stopReason, decision.details);
    return { block: true, reason: `Harness policy: ${decision.stopReason}`, terminate: true };
  }
  if (!confirmTools.includes(toolCall.name)) return undefined;
  writeTrace({ timestamp: now(), eventType: "hitl_request", toolName: toolCall.name, toolCallId: toolCall.id });
  const verdict = await approver({ toolName: toolCall.name, args });
  writeTrace({ timestamp: now(), eventType: "hitl_decision", toolName: toolCall.name, toolCallId: toolCall.id, ...verdict });
  if (verdict.approved) return undefined;
  run.stop("human_denied", { toolName: toolCall.name, by: verdict.by, reason: verdict.reason });
  return { block: true, reason: "Harness: human denied this action", terminate: true };
};

// pi-agent-core 钩子 3：工具执行完后，若某道闸门已咬住，就结束这一批工具调用。
// 同时负责截断超长的工具结果（包括 pi 内置的 read）。
session.agent.afterToolCall = async ({ toolCall, result }) => {
  if (run.stopped) return { isError: true, terminate: true };
  const cut = truncateToolContent(result.content, toolResultMaxChars);
  if (!cut.truncated) return undefined;
  writeTrace({ timestamp: now(), eventType: "tool_result_truncated", toolName: toolCall.name, originalChars: cut.originalChars, maxChars: toolResultMaxChars });
  return { content: cut.content };
};

const unsubscribe = session.subscribe((event) => {
  writeTrace(toTraceRow(event as unknown as { type: string }));
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

const startedAt = Date.now();
let error: string | undefined;
try {
  await session.prompt(spec.prompt);
  process.stdout.write("\n");
} catch (err) {
  error = err instanceof Error ? err.message : String(err);
  run.stop("model_error", { error });
} finally {
  const stopReason = run.stopReason;
  // 退出码：0 = success；2 = 闸门刹车（预期内的停机）；1 = 模型/运行错误。
  process.exitCode = stopReason === "success" ? 0 : stopReason === "model_error" ? 1 : 2;
  writeTrace({
    timestamp: new Date().toISOString(),
    eventType: "harness_end",
    stop_reason: stopReason,
    turns: turns.completed,
    tokens: budget.tokens,
    case_id: spec.id,
    model: `ollama/${modelId}`,
    tools: spec.allowed_tools,
    durationMs: Date.now() - startedAt,
    ...(error ? { error } : {}),
  });
  console.error(`[harness] case=${spec.id} stop_reason=${stopReason} trace=traces/latest.jsonl`);
  unsubscribe();
  session.dispose();
}
