// Ch2 · 从零写最小 harness / Minimal harness from scratch
// 只做四件事：选模型、限定工具、跑一次会话、把事件和 stop_reason 写进 trace。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { createTraceWriter, toTraceRow, type StopReason } from "./trace.js";
import type { CaseSpec } from "./check-trace.js";

if (process.platform !== "linux") throw new Error("Run the harness inside Linux/WSL");

const cwd = process.cwd();
const caseId = process.env.CASE_ID ?? "read-happy";
const cases = JSON.parse(readFileSync(resolve(cwd, "cases/cases.json"), "utf8")) as CaseSpec[];
const spec = cases.find((c) => c.id === caseId);
if (!spec) throw new Error(`unknown case ${caseId}`);

const writeTrace = createTraceWriter(resolve(cwd, "traces/latest.jsonl"));
const modelRuntime = await ModelRuntime.create();
const modelId = process.env.MODEL_ID ?? "qwen3.8:27b";
const model = modelRuntime.getModel("ollama", modelId);
if (!model) throw new Error(`ollama/${modelId} not configured in pi models.json`);

// 工具白名单写在 harness 里，不靠 prompt。
const { session } = await createAgentSession({
  cwd,
  model,
  modelRuntime,
  thinkingLevel: "off",
  tools: spec.allowed_tools,
  sessionManager: SessionManager.inMemory(cwd),
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
