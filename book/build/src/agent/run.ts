import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { type Stage } from "../contracts/index.js";
import { ProjectStore } from "../project/store.js";
import { scrubSecrets } from "./model.js";
import { stagePrompt } from "./prompts.js";

/** 单次阶段运行；会话保留原始 SDK 事件，自定义条目记录签收所需的运行摘要。 */
export async function runStage(session: AgentSession, store: ProjectStore, projectId: string, stage: Stage) {
  const project = store.load(projectId);
  const before = project.stages[stage].versions.length;
  const prompt = `项目标题：${project.title}\n请完成本阶段，并用 write_draft 提交草稿。`;
  const errors: string[] = [];
  let stopReason = "no_draft";
  let turns = 0;
  const started = Date.now();
  session.sessionManager.appendCustomEntry("stage_run_start", {
    stage, model: `${session.model!.provider}/${session.model!.id}`,
    prompt, system_prompt: stagePrompt(stage), tools: session.getActiveToolNames(),
    context_notes: "全新阶段会话；仅通过 read_upstream 按 stage 读取显式依赖的采用版本；无全局上下文文件",
  });
  const unsubscribe = session.subscribe(event => {
    if (event.type === "tool_execution_end" && event.isError) errors.push(scrubSecrets(JSON.stringify(event.result)));
    if (event.type === "message_end" && event.message.role === "assistant") {
      if (event.message.stopReason === "error" || event.message.stopReason === "aborted") {
        stopReason = event.message.stopReason === "error" ? "model_error" : "aborted";
        if (event.message.errorMessage) errors.push(scrubSecrets(event.message.errorMessage));
      }
    }
  });
  // 有界循环：错误草稿可修正，但不能无限调用工具。
  session.agent.finishTurn = ({ message }) => {
    if (message.stopReason === "error" || message.stopReason === "aborted") return;
    turns += 1;
    if (turns >= 8 && message.stopReason === "toolUse") {
      stopReason = "max_turns";
      return { action: "end" };
    }
  };
  try {
    await session.prompt(prompt);
    if (stopReason === "no_draft" && store.load(projectId).stages[stage].versions.length > before) stopReason = "draft_written";
  } catch (error) {
    stopReason = "runtime_error";
    errors.push(scrubSecrets(error instanceof Error ? error.message : String(error)));
  } finally {
    unsubscribe();
    session.sessionManager.appendCustomEntry("stage_run_end", {
      stage, duration_ms: Date.now() - started, turns, errors, stop_reason: stopReason,
    });
  }
  return { stop_reason: stopReason, errors };
}
