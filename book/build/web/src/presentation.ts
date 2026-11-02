import type { ProjectDetail, RunInfo, RunResult } from "../../src/server/protocol.js";
import type { Stage } from "../../src/contracts/index.js";
import type { StageStatus, ReviewStatus } from "../../src/workflow/index.js";
import type { TimelineRow } from "./timeline.js";

export const stageNames: Record<Stage, string> = {
  topic: "选题", synopsis: "梗概", script: "剧本", bible: "设定集", storyboard: "分镜脚本", prompts: "分镜提示词",
};
export const reviewLabels: Record<ReviewStatus, string> = {
  pending: "待审阅", adopted: "已采用", discarded: "已丢弃", changes_requested: "要求修改",
};
const stageLabels: Record<StageStatus, string> = {
  locked: "锁定", ready: "可运行", pending_review: reviewLabels.pending, adopted: reviewLabels.adopted,
};
export function stageBadge(status: StageStatus | undefined, stage: Stage, running: Pick<RunInfo, "stage"> | null) {
  return running?.stage === stage ? { text: "运行中", className: "running" }
    : { text: status ? stageLabels[status] : "加载中", className: status ?? "" };
}

/** 服务端保留技术原因；页面用读者能理解的说法呈现。 */
export function readerMessage(text: string): string {
  return text.replace(/不能运行 (\w+)：当前状态 adopted；已采用阶段的返工留到 P\d+/g,
    (_match, stage: Stage) => `${stageNames[stage] ?? stage}已采用，暂不支持再次运行。`)
    .replace(/；(?:已采用阶段的)?返工留到 P\d+/g, "；已采用的版本暂不支持修改")
    .replace(/待采用|待确认/g, "待审阅");
}

export const DEMO_CHANGE_NOTE = "把孩子换成一位老站长，保留空白格的意象。";
export const DEMO_REVISION_NOTICE = "离线演示的修改结果为预设内容";
export function demoRevisionNotice(demo: boolean, note: string): string | null {
  return demo && note !== DEMO_CHANGE_NOTE ? DEMO_REVISION_NOTICE : null;
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

export function toolErrorText(result: unknown): string {
  if (result && typeof result === "object" && "content" in result && Array.isArray(result.content)) {
    const texts = result.content.flatMap((item: unknown) => {
      if (item && typeof item === "object" && "type" in item && item.type === "text" && "text" in item && typeof item.text === "string" && item.text.trim()) {
        return [item.text];
      }
      return [];
    });
    if (texts.length) return readerMessage(texts.join("\n"));
  }
  return "工具执行被拒绝；未收到可读原因，请展开查看原始结果。";
}

export function missingEventsNotice(project: ProjectDetail | null, rows: TimelineRow[]): string | null {
  if (!project) return null;
  const run = project.last_run ?? project.running;
  const unseen = run
    ? !rows.some(row => row.id === run.id || row.id.startsWith(`${run.id}:`))
    : !rows.length && Object.values(project.stages).some(stage => stage.versions.length > 0);
  return unseen ? "刷新前的实时事件未保存，可在会话记录中查看。" : null;
}
