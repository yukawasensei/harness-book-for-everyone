import type { Stage } from "../../../../../src/contracts/index.js";

/** 对话流交稿摘要（文案稿第 3 节）。剧本/分镜板可带条目数。 */
export function submissionSummary(stage: Stage, version: number, itemCount?: number): string {
  if (stage === "story") return `故事草稿（第 ${version} 版）已交稿，包含片名、核心冲突与四幕脉络。`;
  if (stage === "script") {
    return itemCount != null
      ? `剧本草稿（第 ${version} 版）已交稿，共 ${itemCount} 场。`
      : `剧本草稿（第 ${version} 版）已交稿。`;
  }
  if (stage === "bible") return `设定集草稿（第 ${version} 版）已交稿，已整理剧本中的角色、场景与道具外观。`;
  return itemCount != null
    ? `分镜板草稿（第 ${version} 版）已交稿，共 ${itemCount} 个镜头，已拼入设定集外观描述。`
    : `分镜板草稿（第 ${version} 版）已交稿，已拼入设定集外观描述。`;
}

/** 右栏采用主按钮：写出采用后的下一步后果（文案稿第 4 节）。 */
export const adoptActionLabels: Record<Stage, string> = {
  story: "采用并开始写剧本",
  script: "采用并开始整理设定集",
  bible: "采用并开始制作分镜板",
  board: "采用并完成",
};
export const ADOPT_ACTION_HINT = "将当前版本设为正式采用版本，作为后续工序的唯一依据。";
export const DISCARD_ACTION_HINT = "将当前版本归档为已丢弃，不进入下游工序；历史记录仍会保留。";
export const REQUEST_CHANGES_HINT = "请写明要改动的地方（也可直接在下方输入框输入），助手会在当前版本基础上修改。";
export const reviewDisableReasons = {
  busy: "正在生成新版本，完成后可审阅。",
  adopted: "当前版本已采用，无需重复确认。",
  discarded: "此版本已丢弃，不可采用。如需恢复可基于其它版本要求修改。",
  upstream: "上游工序尚未采用定稿，请先完成上游审阅。",
  emptyNote: "请先填写具体的修改意见。",
  quota: "今日生成次数已用完，暂时无法发起按意见修改。",
} as const;

export function looksLikeUpstreamBlock(reason: string | null): boolean {
  return Boolean(reason && /上游|上一道|锁定|尚未采用|先完成/.test(reason));
}

export function looksLikeQuota(reason: string | null): boolean {
  return Boolean(reason && /配额|今日|次数|429/.test(reason));
}
