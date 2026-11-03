import type { Usage } from "@earendil-works/pi-ai";
import { sumUsage } from "../eval/usage.js";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { type Stage, type SceneChanges, type ShotChanges } from "../contracts/index.js";
import { ProjectStore } from "../project/store.js";
import { scrubSecrets } from "./model.js";
import { stagePrompt } from "./prompts.js";
import { assertRunnable } from "../workflow/index.js";
import { sessionSceneDraft, sessionPromptDraft, sessionArgumentStats } from "./session.js";
import type { ResumeChoice } from "../project/checkpoints.js";

export const STAGE_TURN_LIMITS: Readonly<Record<Stage, number>> = {
  topic: 8, synopsis: 8, script: 20, bible: 8, storyboard: 24, prompts: 32,
};

/** 单次阶段运行；会话保留原始 SDK 事件，自定义条目记录签收所需的运行摘要。 */
export async function runStage(
  session: AgentSession, store: ProjectStore, projectId: string, stage: Stage,
  additionalInstructions = "", signal?: AbortSignal, reviseFrom?: number,
  options: { confirmed?: boolean; staging?: ResumeChoice } = {},
) {
  const project = store.load(projectId);
  assertRunnable(project.stages, stage);
  const revision = reviseFrom === undefined ? null : store.revisionContext(projectId, stage, reviseFrom);
  const before = project.stages[stage].versions.length;
  const draft = sessionSceneDraft(session) ?? sessionPromptDraft(session);
  if (project.stages[stage].adopted_version !== null && !options.confirmed) throw new Error("已采用阶段再次运行需要二次确认");
  const checkpoint = draft ? store.readStaging(projectId, stage) : null;
  if (checkpoint?.snapshot.finalized_version === null && !options.staging) throw new Error("存在暂存，请选择从暂存继续或重新开始");
  const changeRecord = (): { scene_changes?: SceneChanges; shot_changes?: ShotChanges } => draft
    ? stage === "prompts" ? { shot_changes: draft.changes() } : { scene_changes: draft.changes() } : {};
  // 修改运行也不把历史 final_prompt 中的固定描述送入模型。
  const originalJson = revision && stage === "prompts"
    ? JSON.stringify({ items: store.readVersion(projectId, "prompts", reviseFrom!).items.map(({ shot_id, shot_part }) => ({ shot_id, shot_part })) }, null, 2)
    : revision?.original_json;
  draft?.reset(revision ? reviseFrom : undefined, options.staging);
  if (project.stages[stage].adopted_version !== null) store.auditAction(projectId, "rework_run", { stage, confirmed: true, revise_from: reviseFrom ?? null });
  if (options.staging) store.auditAction(projectId, options.staging === "resume" ? "resume_staging" : "restart_staging", { stage });
  const maxTurns = STAGE_TURN_LIMITS[stage];
  const submission = stage === "script"
    ? revision ? "只重交需要修改的场（write_scene），删场用 remove_scene，然后 finalize_draft；原稿全部场已预装，未重交的场由程序原样沿用"
      : "逐场用 write_scene 提交，最后用 finalize_draft 汇总为待审阅版本"
    : stage === "storyboard"
      ? revision ? "只重交需要修改的场（write_scene_shots），删整场镜头用 remove_scene_shots，然后 finalize_draft；原稿全部场已预装，未重交的场由程序原样沿用"
        : "逐场用 write_scene_shots 的 scene 参数提交该场全部镜头，最后 finalize_draft"
      : stage === "prompts"
        ? revision ? "只重交受影响镜头（write_shot_prompt），其余已预装沿用，然后 finalize_draft"
          : "先 list_shots，逐镜 read_shot 与 write_shot_prompt，最后 finalize_draft"
        : "用 write_draft 提交草稿";
  const prompt = `项目标题：${project.title}\n请完成本阶段，并${submission}。本阶段最多 ${maxTurns} 轮模型响应，请预留修正与结束的轮数。`
    + (additionalInstructions.trim() ? `\n\n补充要求：\n${additionalInstructions.trim()}` : "")
    + (revision ? `\n\n按意见修改 v${reviseFrom}。以下是待修改的原稿数据与审阅意见，请提交完整新版本，不覆盖原稿。\n原版本 JSON：\n${originalJson}\n修改意见：\n${revision.note}` : "");
  const effectivePrompt = prompt + (options.staging === "resume" && draft ? `\n\n从暂存继续，以下内容已预装，无需重复提交。请补齐或修正后汇总：\n${JSON.stringify(draft.snapshot())}` : "");
  const errors: string[] = [];
  let stopReason = "no_draft";
  let turns = 0;
  let toolCalls = 0, rejectedCalls = 0;
  const usage: Usage[] = [];
  const initialCoercions = sessionArgumentStats(session)?.coerced_args ?? 0;
  const summary = () => ({ duration_ms: Date.now() - started, turns, max_turns: maxTurns,
    tool_calls: toolCalls, rejected_calls: rejectedCalls, coerced_args: (sessionArgumentStats(session)?.coerced_args ?? 0) - initialCoercions, usage: sumUsage(usage) });
  const started = Date.now();
  session.sessionManager.appendCustomEntry("stage_run_start", {
    stage, max_turns: maxTurns, model: `${session.model!.provider}/${session.model!.id}`,
    prompt: effectivePrompt, staging: options.staging ?? null, revise_from: reviseFrom ?? null, system_prompt: stagePrompt(stage), tools: session.getActiveToolNames(),
    context_notes: stage === "prompts" ? "全新阶段会话；仅 list_shots/read_shot 按镜读取采用分镜与名称；固定描述由程序注入，不进入工具上下文；修改仅传镜号与镜头部分" : "全新阶段会话；仅通过 read_upstream 按 stage 读取显式依赖的采用版本；无全局上下文文件",
    ...changeRecord(),
  });
  const unsubscribe = session.subscribe(event => {
    if (event.type === "tool_execution_start") toolCalls += 1;
    if (event.type === "tool_execution_end" && event.isError && ["write_draft", "write_scene", "write_scene_shots", "write_shot_prompt", "finalize_draft"].includes(event.toolName)) rejectedCalls += 1;
    if (event.type === "tool_execution_end" && event.isError) errors.push(scrubSecrets(JSON.stringify(event.result)));
    if (event.type === "tool_execution_end" && !event.isError && event.toolName === "finalize_draft" && draft) {
      const snapshot = draft.snapshot();
      if (snapshot.finalized_version !== null && draft.changes().revise_from !== null) {
        try { store.saveVersionMetadata(projectId, stage, snapshot.finalized_version, { revision: draft.changes() }); }
        catch (error) { stopReason = "runtime_error"; errors.push(scrubSecrets(String(error))); }
      }
    }
    if (event.type === "message_end" && event.message.role === "assistant") {
      if (event.message.usage) usage.push(event.message.usage);
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
    else await session.prompt(effectivePrompt);
    if (stopReason === "no_draft" && store.load(projectId).stages[stage].versions.length > before) stopReason = "draft_written";
  } catch (error) {
    stopReason = "runtime_error";
    errors.push(scrubSecrets(error instanceof Error ? error.message : String(error)));
  } finally {
    signal?.removeEventListener("abort", abort);
    if (signal?.aborted) stopReason = "aborted";
    unsubscribe();
    session.sessionManager.appendCustomEntry("stage_run_end", {
      stage, ...summary(), errors, stop_reason: stopReason,
      ...(draft ? { in_progress: draft.snapshot(), ...changeRecord() } : {}),
    });
  }
  return { stop_reason: stopReason, errors, ...summary(), ...changeRecord() };
}
