import type { ProjectDetail, RunResult } from "../../src/server/protocol.js";
import type { TimelineRow } from "./timeline.js";

export function runSummary(run: RunResult): { text: string; failed: boolean } {
  if (run.stop_reason === "draft_written") {
    return { text: `已写入草稿${run.errors.length ? `；过程中被校验拒绝 ${run.errors.length} 次` : ""}`, failed: false };
  }
  const labels: Record<string, string> = {
    no_draft: "未写入草稿", aborted: "运行已中断", max_turns: "达到运行轮数上限",
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
    if (texts.length) return texts.join("\n");
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
