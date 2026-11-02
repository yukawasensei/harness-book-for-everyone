import { Type } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-coding-agent";
import type { ProjectStore } from "../project/store.js";
import { shotContext, shotList, SHOT_PART_LIMITS } from "../contracts/prompts.js";
import { assertRunnable } from "../workflow/index.js";
import type { PromptDraft } from "./prompt-draft.js";

export function createPromptTools(store: ProjectStore, projectId: string, draft: PromptDraft) {
  const board = () => {
    assertRunnable(store.load(projectId).stages, "prompts");
    return store.readAdopted(projectId, "storyboard");
  };
  return [
    defineTool({
      name: "list_shots", label: "列镜头 / List shots",
      description: "列出采用分镜的 shot_id 与最多 60 字动作摘要，不返回设定描述。无参数。",
      parameters: Type.Object({}, { additionalProperties: false }),
      async execute() {
        return { content: [{ type: "text" as const, text: JSON.stringify(shotList(board())) }], details: {} };
      },
    }),
    defineTool({
      name: "read_shot", label: "读单镜 / Read shot",
      description: "按 shot_id 读取采用分镜的一镜及其引用实体名称。不返回外观或固定描述。",
      parameters: Type.Object({ shot_id: Type.String() }, { additionalProperties: false }),
      async execute(_callId, params) {
        const shot = board().shots.find(shot => shot.shot_id === params.shot_id);
        if (!shot) throw new Error(`镜头 ${params.shot_id} 不存在于采用分镜；请先 list_shots`);
        const value = shotContext(shot, store.readAdopted(projectId, "bible"));
        return { content: [{ type: "text" as const, text: JSON.stringify(value) }], details: { shot_id: shot.shot_id } };
      },
    }),
    defineTool({
      name: "write_shot_prompt", label: "提交镜头部分 / Write shot prompt",
      description: `仅提交 shot_id 与 shot_part 两个文字字段；shot_part 为 ${SHOT_PART_LIMITS.min}–${SHOT_PART_LIMITS.max} 字动作、构图、情绪、镜头语言。不含设定编号、镜头外角色或模板标记，不描述外貌。暂存而非版本；同镜可重交。final_prompt 与 injected_ids 由程序生成，禁止提交。`,
      // 原始字段交给可信边界检查，避免 SDK 把非文字值转换成文字。
      parameters: Type.Object({ shot_id: Type.Unknown(), shot_part: Type.Unknown() }, { additionalProperties: false }),
      async execute(_callId, params) {
        const details = draft.write(params);
        return { content: [{ type: "text" as const, text: `已暂存 ${details.shot_id}；共 ${details.shot_count} 镜，尚未生成版本。` }], details };
      },
    }),
    defineTool({
      name: "finalize_draft", label: "拼装提示词 / Finalize prompts",
      description: "要求采用分镜全部镜头各一条，程序原样注入采用设定并保存待审阅版本；不自动采用。无参数。",
      parameters: Type.Object({}, { additionalProperties: false }),
      async execute() {
        const details = draft.finalize(), changes = details.shot_changes;
        const comparison = changes.revise_from === null ? "" : `相对 v${changes.revise_from}：重交 ${changes.resubmitted.join("、") || "无"}；沿用 ${changes.reused.join("、") || "无"}。`;
        // 不把拼装后的外观回灌模型上下文。
        return { content: [{ type: "text" as const, text: `已拼装并保存提示词 v${details.version}；待审阅。${comparison}` }], details };
      },
    }),
  ];
}
