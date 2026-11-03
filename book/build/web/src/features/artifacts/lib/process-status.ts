import type { Stage } from "../../../../../src/contracts/index.js";
import type { ProjectDetail } from "../../../../../src/server/protocol.js";

export const PROCESS_STAGES: { stage: Stage; label: string }[] = [
  { stage: "story", label: "故事" },
  { stage: "script", label: "剧本" },
  { stage: "bible", label: "设定集" },
  { stage: "board", label: "分镜板" },
];

/** 文案稿第 2 节：未开始 / 进行中 / 待审阅 / 已采用 / 待更新 */
export function processStatusLabel(
  project: Pick<ProjectDetail, "stages" | "running"> | null | undefined,
  stage: Stage,
): string {
  if (!project) return "未开始";
  if (project.running?.stage === stage) return "进行中";
  switch (project.stages[stage]?.status) {
    case "adopted":
      return "已采用";
    case "pending_review":
      return "待审阅";
    case "stale":
      return "待更新";
    default:
      return "未开始";
  }
}

/** 窄屏进度小标签文案，例如「2/4 剧本 · 待审阅」 */
export function progressChip(
  project: Pick<ProjectDetail, "stages" | "running">,
): { stage: Stage; index: number; text: string } {
  let focus = 0;
  if (project.running) {
    focus = PROCESS_STAGES.findIndex(item => item.stage === project.running!.stage);
  } else {
    const priorities = ["pending_review", "stale", "ready"] as const;
    let found = -1;
    for (const priority of priorities) {
      found = PROCESS_STAGES.findIndex(item => project.stages[item.stage].status === priority);
      if (found >= 0) break;
    }
    if (found >= 0) {
      focus = found;
    } else if (PROCESS_STAGES.every(item => project.stages[item.stage].status === "adopted")) {
      focus = PROCESS_STAGES.length - 1;
    }
  }
  if (focus < 0) focus = 0;
  const { stage, label } = PROCESS_STAGES[focus];
  return {
    stage,
    index: focus + 1,
    text: `${focus + 1}/4 ${label} · ${processStatusLabel(project, stage)}`,
  };
}
