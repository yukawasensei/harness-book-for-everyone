// Ch2 · 从零写最小 harness / Minimal harness from scratch
// 只做四件事：选模型、限定工具、跑一次会话、把事件和 stop_reason 写进 trace。
// Ch3 · 增量：注册自定义工具；隔离本机 ~/.pi 全局配置（见 isolated-pi.ts）。
// Ch4 · 增量：轮数上限 + 工具超时，停机原因统一记在 run-state。
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { createTraceWriter, toTraceRow } from "./trace.js";
import type { CaseSpec } from "./check-trace.js";
import { createIsolatedPi } from "./isolated-pi.js";
import { CUSTOM_TOOLS } from "./tools/index.js";
import { createRunState } from "./run-state.js";
import { createMaxTurnsGuard } from "./gates/max-turns.js";
import { withToolTimeout } from "./gates/tool-timeout.js";

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

// 工具白名单写在 harness 里，不靠 prompt；自定义工具也只在白名单里才注册，并统一套上超时。
const customTools = CUSTOM_TOOLS.filter((tool) => spec.allowed_tools.includes(tool.name)).map((tool) =>
  withToolTimeout(tool, toolTimeoutMs, (info) => run.stop("tool_timeout", info)),
);
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
});

// pi-agent-core 钩子 1：每轮结束后由 harness 决定要不要继续。
session.agent.shouldStopAfterTurn = () => {
  if (run.stopped) return true;
  const stop = turns.recordTurn();
  writeTrace({ timestamp: new Date().toISOString(), eventType: "turn_guard", turn: turns.completed, maxTurns });
  if (stop) run.stop("max_turns", { turn: turns.completed, maxTurns });
  return stop;
};

// pi-agent-core 钩子 2：工具执行完后，若某道闸门已咬住，就结束这一批工具调用。
session.agent.afterToolCall = async () => (run.stopped ? { isError: true, terminate: true } : undefined);

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
