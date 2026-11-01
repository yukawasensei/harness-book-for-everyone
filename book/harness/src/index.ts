// Ch2 · 从零写最小 harness / Minimal harness from scratch
// 只做四件事：选模型、限定工具、跑一次会话、把事件和 stop_reason 写进 trace。
// Ch3 · 增量：注册自定义工具；隔离本机 ~/.pi 全局配置（见 isolated-pi.ts）。
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { createTraceWriter, toTraceRow, type StopReason } from "./trace.js";
import type { CaseSpec } from "./check-trace.js";
import { createIsolatedPi } from "./isolated-pi.js";
import { CUSTOM_TOOLS } from "./tools/hello.js";

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

// 工具白名单写在 harness 里，不靠 prompt；自定义工具也只在白名单里才注册。
const customTools = CUSTOM_TOOLS.filter((tool) => spec.allowed_tools.includes(tool.name));
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

// 开跑前留证：这次到底加载了几个扩展、开放了哪些工具。
writeTrace({
  timestamp: new Date().toISOString(),
  eventType: "harness_start",
  case_id: spec.id,
  extensions: extensionsResult.extensions.length,
  activeTools: session.getActiveToolNames(),
});

const unsubscribe = session.subscribe((event) => {
  writeTrace(toTraceRow(event as unknown as { type: string }));
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

const startedAt = Date.now();
let stopReason: StopReason = "success";
let error: string | undefined;
try {
  await session.prompt(spec.prompt);
  process.stdout.write("\n");
} catch (err) {
  stopReason = "model_error";
  error = err instanceof Error ? err.message : String(err);
  process.exitCode = 1;
} finally {
  writeTrace({
    timestamp: new Date().toISOString(),
    eventType: "harness_end",
    stop_reason: stopReason,
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
