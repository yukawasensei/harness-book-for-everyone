import type { ProjectDetail, RunInfo, RunResult } from "../../src/server/protocol.js";
import type { SceneChanges, Stage } from "../../src/contracts/index.js";
import type { StageStatus, ReviewStatus } from "../../src/workflow/index.js";
import type { TimelineRow } from "./timeline.js";
import { translateValidationError, type ValidationContext } from "./validation-errors.js";

export const stageNames: Record<Stage, string> = {
  topic: "选题", synopsis: "梗概", script: "剧本", bible: "设定集", storyboard: "分镜脚本", prompts: "分镜提示词",
};
export const reviewLabels: Record<ReviewStatus, string> = {
  pending: "待审阅", adopted: "已采用", discarded: "已丢弃", changes_requested: "要求修改",
};
const stageLabels: Record<StageStatus, string> = {
  locked: "锁定", ready: "可运行", pending_review: reviewLabels.pending, adopted: reviewLabels.adopted,
};
export function stageBadge(status: StageStatus | undefined, stage: Stage, running: Pick<RunInfo, "stage"> | null, implemented = true) {
  if (!implemented) return { text: "暂未开放", className: "unavailable" };
  return running?.stage === stage ? { text: "运行中", className: "running" }
    : { text: status ? stageLabels[status] : "加载中", className: status ?? "" };
}

/** 当前阶段的引导必须与可运行状态、人工采用状态一致。 */
export function artifactGuidance(stage: Stage, implemented: boolean, adoptedVersion: number | null = null) {
  if (!implemented) return {
    empty: `${stageNames[stage]}暂未开放，当前没有可查看的草稿。`,
    footer: `${stageNames[stage]}暂未开放运行。`,
  };
  if (adoptedVersion !== null) return {
    empty: `本阶段已采用 v${adoptedVersion}，请选择版本查看内容。`,
    footer: stage === "prompts" ? `本阶段已采用 v${adoptedVersion}；六阶段文本产物已完成审阅。` : `本阶段已采用 v${adoptedVersion}；下游以此版本为准，暂不支持更换采用版本。`,
  };
  return { empty: "运行后可在这里查看和审阅草稿。", footer: "先查看草稿，再决定采用、丢弃或要求修改。" };
}

/** 服务端保留技术原因；页面用读者能理解的说法呈现。 */
export function readerMessage(text: string): string {
  const unavailable = text.match(/^(\w+) 系统提示模板尚未实现/);
  if (unavailable && unavailable[1] in stageNames) return `${stageNames[unavailable[1] as Stage]}暂未开放运行。`;
  return translateValidationError(text.replace(/不能运行 (\w+)：当前状态 adopted；已采用阶段的返工留到 P\d+/g,
    (_match, stage: Stage) => `${stageNames[stage] ?? stage}已采用，暂不支持再次运行。`)
    .replace(/；(?:已采用阶段的)?返工留到 P\d+/g, "；已采用的版本暂不支持修改")
    .replace(/待采用|待确认/g, "待审阅").replaceAll("重交/新增", "重交")
    .replace(/；(?:重交|沿用|删除) 无(?=[；。]|$)/g, ""))
    .replace(/\b(topic|synopsis|script|bible|storyboard|prompts)\b/g, key => stageNames[key as Stage])
    .replace(/(?:status=)?\b(pending_review|changes_requested|discarded|adopted|pending|locked|ready)\b/g,
      key => ({ ...stageLabels, ...reviewLabels } as Record<string, string>)[key.replace("status=", "")] ?? key);
}

export function revisionDescription(revision?: SceneChanges): string | null {
  if (!revision || revision.revise_from === null) return null;
  const parts = [["重交", revision.resubmitted], ["沿用", revision.reused], ["删除", revision.removed]] as const;
  return `相对 v${revision.revise_from}：${parts.filter(([, ids]) => ids.length).map(([label, ids]) => `${label} ${ids.join("、")}`).join("；") || "没有条目变动"}`;
}

export function currentRunDisplay(running: RunInfo | null | undefined, last: RunResult | null | undefined) {
  if (running) return { stage: running.stage, text: running.abort_requested ? "正在中断" : "运行中", failed: false, stopReason: null, errors: [] as string[] };
  return last ? { stage: last.stage, ...runSummary(last), stopReason: last.stop_reason, errors: last.errors } : null;
}

export function scriptProgress(running: RunInfo | null | undefined, rows: TimelineRow[]): string | null {
  if (running?.stage !== "script" && running?.stage !== "storyboard" && running?.stage !== "prompts") return null;
  for (const row of [...rows].reverse()) {
    if (row.kind !== "tool" || !row.id.startsWith(`${running.id}:`) || row.status !== "success" || !["write_scene", "remove_scene", "write_scene_shots", "remove_scene_shots", "write_shot_prompt"].includes(row.name)) continue;
    const result = row.result;
    if (!result || typeof result !== "object" || !("details" in result)) continue;
    const details = result.details;
    if (!details || typeof details !== "object") continue;
    const count = "shot_count" in details ? details.shot_count : "scene_count" in details ? details.scene_count : null;
    if (typeof count === "number" && Number.isSafeInteger(count) && count >= 0) return `已暂存 ${count} ${running.stage === "prompts" ? "镜" : "场"}`;
  }
  return "等待暂存进度";
}

export const DEMO_CHANGE_NOTE = "把孩子换成一位老站长，保留空白格的意象。";
export const DEMO_SCRIPT_CHANGE_NOTE = "只修改 S02：让程禾先询问陆岑是否愿意讲述，其他场保持原样。";
export const DEMO_BIBLE_CHANGE_NOTE = "保留角色与出场场次，只把程禾外套改为深灰色。";
export const DEMO_STORYBOARD_CHANGE_NOTE = "只修改 S02：首镜缓慢推近程禾，先征求陆岑讲述意愿，其余场保持原样。";
export const DEMO_PROMPTS_CHANGE_NOTE = "只修改 S02-01：动作之后停顿，构图留白，其他镜头保持原样。";
export const demoChangeNote = (stage: Stage) => stage === "prompts" ? DEMO_PROMPTS_CHANGE_NOTE : stage === "storyboard" ? DEMO_STORYBOARD_CHANGE_NOTE : stage === "script" ? DEMO_SCRIPT_CHANGE_NOTE : stage === "bible" ? DEMO_BIBLE_CHANGE_NOTE : DEMO_CHANGE_NOTE;
export const DEMO_REVISION_NOTICE = "离线演示的修改结果为预设内容";
export function demoRevisionNotice(demo: boolean, note: string, stage: Stage = "topic"): string | null {
  return demo && note !== demoChangeNote(stage) ? DEMO_REVISION_NOTICE : null;
}

export function runRequestText(stage: Stage, instructions: string, revision?: { version: number; note: string }): string {
  if (!revision) return instructions.trim() || `运行${stageNames[stage]}`;
  return `按意见修改${stageNames[stage]} v${revision.version}\n修改意见：\n${revision.note}`
    + (instructions.trim() ? `\n\n补充要求：\n${instructions.trim()}` : "");
}

export function runSummary(run: RunResult): { text: string; failed: boolean } {
  if (run.stop_reason === "draft_written") {
    return { text: `草稿已保存，待审阅${run.errors.length ? `；过程中被校验拒绝 ${run.errors.length} 次` : ""}`, failed: false };
  }
  const labels: Record<string, string> = {
    no_draft: "未生成草稿", aborted: "运行已中断", max_turns: "达到运行轮数上限",
    model_error: "模型请求失败", runtime_error: "运行异常",
  };
  return { text: labels[run.stop_reason] ?? `运行结束：${run.stop_reason}`, failed: run.stop_reason !== "aborted" };
}

function resultText(result: unknown): string | null {
  if (result && typeof result === "object" && "content" in result && Array.isArray(result.content)) {
    const texts = result.content.flatMap((item: unknown) => {
      if (item && typeof item === "object" && "type" in item && item.type === "text" && "text" in item && typeof item.text === "string" && item.text.trim()) {
        return [item.text];
      }
      return [];
    });
    if (texts.length) return texts.join("\n");
  }
  return null;
}

/** 会话错误可能是序列化工具结果；结构只留在技术详情。 */
export function readableError(raw: string, context?: ValidationContext): string {
  let current: unknown = raw;
  for (let depth = 0; depth < 8; depth += 1) {
    if (typeof current === "string") {
      const text = current;
      try { current = JSON.parse(text); continue; }
      catch {
        const translated = readerMessage(translateValidationError(text, context));
        return /[\u3400-\u9fff]/.test(translated) ? translated : "运行失败，请查看技术详情。";
      }
    }
    if (current && typeof current === "object") {
      const text = resultText(current);
      if (text) { current = text; continue; }
      if ("message" in current && typeof current.message === "string") { current = current.message; continue; }
    }
    break;
  }
  return "未收到可读错误原因，请查看技术详情。";
}

export function toolResultText(result: unknown): string | null {
  const text = resultText(result);
  return text ? readerMessage(text) : null;
}

export function toolErrorText(result: unknown, context?: ValidationContext): string {
  const raw = resultText(result);
  return raw ? readableError(raw, context) : "工具执行被拒绝；未收到可读原因，请在技术详情中展开查看原始结果。";
}

export function missingEventsNotice(project: ProjectDetail | null, rows: TimelineRow[]): string | null {
  if (!project) return null;
  const run = project.running ?? project.last_run;
  const unseen = run
    ? !rows.some(row => row.id === run.id || row.id.startsWith(`${run.id}:`))
    : !rows.length && Object.values(project.stages).some(stage => stage.versions.length > 0);
  return unseen ? "刷新前的实时事件未保存，可在会话记录中查看。" : null;
}
