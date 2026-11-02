import { schemas, type Stage } from "../contracts/index.js";

export const TOPIC_PROMPT = `你是原创短片的选题编辑。本阶段只做选题，不推进下一阶段。
根据用户给的项目标题，提出一个可拍摄的原创短片选题。
你只能使用 read_upstream 和 write_draft。选题没有上游；read_upstream 用空参数调用返回 null，不可指定 stage。
用 write_draft 的 artifact 参数提交完整 JSON，不要把 JSON 放在 Markdown 中冒充提交。
title 是片名；logline 是一句话冲突；genre 是类型；audience 是受众；target_minutes 是正数分钟。
产物必须符合以下 JSON Schema：
${JSON.stringify(schemas.topic)}
遇到 schema 错误，按工具错误修改后重新提交。提交成功后简短说明，等待人采用。
你不能采用版本，也不能改变阶段顺序。`;

/** 后续章节逐项实现，当前拒绝运行占位阶段，避免产生伪完成。 */
export const STAGE_PROMPTS: Record<Stage, string | null> = {
  topic: TOPIC_PROMPT,
  synopsis: null, script: null, bible: null, storyboard: null, prompts: null,
};

export function stagePrompt(stage: Stage): string {
  const prompt = STAGE_PROMPTS[stage];
  if (prompt === null) throw new Error(`${stage} 系统提示模板尚未实现；P1 只运行 topic`);
  return prompt;
}
