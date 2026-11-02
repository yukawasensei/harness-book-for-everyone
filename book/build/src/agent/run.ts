import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { type Stage } from "../contracts/index.js";
import { ProjectStore } from "../project/store.js";
import { scrubSecrets } from "./model.js";
import { stagePrompt } from "./prompts.js";
import { assertRunnable } from "../workflow/index.js";
import { sessionScriptDraft } from "./session.js";

export const STAGE_TURN_LIMITS: Readonly<Record<Stage, number>> = {
  topic: 8, synopsis: 8, script: 20, bible: 8, storyboard: 8, prompts: 8,
};

/** 单次阶段运行；会话保留原始 SDK 事件，自定义条目记录签收所需的运行摘要。 */
export async function runStage(
  session: AgentSession, store: ProjectStore, projectId: string, stage: Stage,
  additionalInstructions = "", signal?: AbortSignal, reviseFrom?: number,
) {
  const project = store.load(projectId);
  assertRunnable(project.stages, stage);
  const revision = reviseFrom === undefined ? null : store.revisionContext(projectId, stage, reviseFrom);
  const before = project.stages[stage].versions.length;
  const draft = sessionScriptDraft(session);
  draft?.reset(revision ? reviseFrom : undefined);
  const maxTurns = STAGE_TURN_LIMITS[stage];
  const submission = stage === "script"
    ? revision ? "只重交需要修改的场（write_scene），删场用 remove_scene，然后 finalize_draft；原稿全部场已预装，未重交的场由程序原样沿用"
      : "逐场用 write_scene 提交，最后用 finalize_draft 汇总为待审阅版本"
    : "用 write_draft 提交草稿";
  const prompt = `项目标题：${project.title}\n请完成本阶段，并${submission}。本阶段最多 ${maxTurns} 轮模型响应，请预留修正与结束的轮数。`
    + (additionalInstructions.trim() ? `\n\n补充要求：\n${additionalInstructions.trim()}` : "")
    + (revision ? `\n\n按意见修改 v${reviseFrom}。以下是待修改的原稿数据与审阅意见，请提交完整新版本，不覆盖原稿。\n原版本 JSON：\n${revision.original_json}\n修改意见：\n${revision.note}` : "");
  const errors: string[] = [];
  let stopReason = "no_draft";
  let turns = 0;
  const started = Date.now();
  session.sessionManager.appendCustomEntry("stage_run_start", {
    stage, max_turns: maxTurns, model: `${session.model!.provider}/${session.model!.id}`,
    prompt, revise_from: reviseFrom ?? null, system_prompt: stagePrompt(stage), tools: session.getActiveToolNames(),
    context_notes: "全新阶段会话；仅通过 read_upstream 按 stage 读取显式依赖的采用版本；无全局上下文文件",
    ...(draft ? { scene_changes: draft.changes() } : {}),
  });
  const unsubscribe = session.subscribe(event => {
    if (event.type === "tool_execution_end" && event.isError) errors.push(scrubSecrets(JSON.stringify(event.result)));
    if (event.type === "tool_execution_end" && !event.isError && event.toolName === "finalize_draft" && draft) {
      const snapshot = draft.snapshot();
      if (snapshot.finalized_version !== null && snapshot.scene_changes.revise_from !== null) {
        try { store.saveVersionMetadata(projectId, stage, snapshot.finalized_version, { revision: snapshot.scene_changes }); }
        catch (error) { stopReason = "runtime_error"; errors.push(scrubSecrets(String(error))); }
      }
    }
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
    if (turns >= maxTurns && message.stopReason === "toolUse") {
      stopReason = "max_turns";
      return { action: "end" };
    }
  };
  const abort = () => {
    stopReason = "aborted";
    void session.abort().catch(error => errors.push(scrubSecrets(String(error))));
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) stopReason = "aborted";
    else await session.prompt(prompt);
    if (stopReason === "no_draft" && store.load(projectId).stages[stage].versions.length > before) stopReason = "draft_written";
  } catch (error) {
    stopReason = "runtime_error";
    errors.push(scrubSecrets(error instanceof Error ? error.message : String(error)));
  } finally {
    signal?.removeEventListener("abort", abort);
    if (signal?.aborted) stopReason = "aborted";
    unsubscribe();
    session.sessionManager.appendCustomEntry("stage_run_end", {
      stage, duration_ms: Date.now() - started, turns, max_turns: maxTurns, errors, stop_reason: stopReason,
      ...(draft ? { in_progress: draft.snapshot(), scene_changes: draft.changes() } : {}),
    });
  }
  return { stop_reason: stopReason, errors, ...(draft ? { scene_changes: draft.changes() } : {}) };
}
