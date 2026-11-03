import { Value } from "typebox/value";
import {
  BOARD_ASSEMBLY_TEMPLATE, BoardInputSchema, BoardSceneInputSchema, BoardSchema,
  validateStoryboardReferences,
  type Artifacts, type Bible, type Board, type BoardInput, type BoardSceneInput,
} from "./index.js";
import { assembleShotPrompt, validateShotPart } from "./prompts.js";

/** 单场可信边界：拒绝模型提交派生字段，再复用引用与镜头部分规则。 */
export function validateBoardSceneInput(value: unknown, script: Artifacts["script"], bible: Bible): asserts value is BoardSceneInput {
  const errors = Value.Errors(BoardSceneInputSchema, value);
  if (errors.length) throw new Error(`board scene schema 不合规：${errors.map(e => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
  const scene = value as BoardSceneInput;
  if (scene.shots.some(shot => shot.scene_id !== scene.scene_id)) throw new Error(`${scene.scene_id} 提交中混入其他场镜头；请按场分别提交`);
  validateStoryboardReferences(scene, script, bible, false);
  for (const shot of scene.shots) validateShotPart(shot, bible, shot.shot_part);
}

/** 完整候选只接受模型可写字段；排序、校验、拼装均不修改输入。 */
export function assembleBoard(value: unknown, script: Artifacts["script"], bible: Bible): Board {
  const errors = Value.Errors(BoardInputSchema, value);
  if (errors.length) throw new Error(`board input schema 不合规：${errors.map(e => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
  const input = structuredClone(value as BoardInput);
  input.shots.sort((a, b) => a.shot_id.localeCompare(b.shot_id));
  validateStoryboardReferences(input, script, bible);
  for (const shot of input.shots) validateShotPart(shot, bible, shot.shot_part);
  const board: Board = {
    assembly_template: BOARD_ASSEMBLY_TEMPLATE,
    shots: input.shots.map(shot => ({ ...shot, ...assembleShotPrompt(shot, bible, shot.shot_part) })),
  };
  validateBoard(board, script, bible);
  return board;
}

/** 校验已保存版本；模板未知或派生内容不符时拒绝，绝不修复或重写。 */
export function validateBoard(value: unknown, script: Artifacts["script"], bible: Bible): asserts value is Board {
  const errors = Value.Errors(BoardSchema, value);
  if (errors.length) throw new Error(`board schema 不合规：${errors.map(e => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
  const board = value as Board;
  validateStoryboardReferences(board, script, bible);
  for (const shot of board.shots) {
    validateShotPart(shot, bible, shot.shot_part);
    const expected = assembleShotPrompt(shot, bible, shot.shot_part);
    if (JSON.stringify(shot.injected_ids) !== JSON.stringify(expected.injected_ids)) throw new Error(`${shot.shot_id} 注入编号必须由程序按分镜引用生成，顺序为场景、角色、道具`);
    if (shot.final_prompt !== expected.final_prompt) throw new Error(`${shot.shot_id} 完整提示词不等于固定模板拼装原文；请由程序重新汇总`);
  }
}

/** 修改、暂存与重拼装共用可写字段投影，不把历史派生文本交给模型。 */
export function boardInput(board: Board): BoardInput {
  return { shots: board.shots.map(({ final_prompt: _prompt, injected_ids: _ids, ...input }) => structuredClone(input)) };
}
