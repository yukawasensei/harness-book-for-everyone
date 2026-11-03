import type { Artifacts, Bible, Shot, ShotPrompt } from "./index.js";

/** 模板固定；不裁剪、翻译或改写采用设定的原文。 */
export function assembleShotPrompt(shot: Shot, bible: Bible, shot_part: string): ShotPrompt {
  const location = bible.locations.find(entry => entry.id === shot.location_id);
  if (!location) throw new Error(`${shot.shot_id} 场景 ${shot.location_id} 不存在于采用设定集`);
  const lines = [`[镜头] ${shot_part}`, `[场景] ${location.name}：${location.description}`];
  for (const id of shot.character_ids) {
    const entry = bible.characters.find(entry => entry.id === id);
    if (!entry) throw new Error(`${shot.shot_id} 角色 ${id} 不存在于采用设定集`);
    lines.push(`[角色] ${entry.name}：${entry.appearance}`);
  }
  for (const id of shot.prop_ids) {
    const entry = bible.props.find(entry => entry.id === id);
    if (!entry) throw new Error(`${shot.shot_id} 道具 ${id} 不存在于采用设定集`);
    lines.push(`[道具] ${entry.name}：${entry.description}`);
  }
  lines.push(`[规格] 景别 ${shot.shot_size}，机位 ${shot.camera}，时长 ${shot.duration_s} 秒`);
  return { shot_id: shot.shot_id, shot_part, injected_ids: [shot.location_id, ...shot.character_ids, ...shot.prop_ids], final_prompt: lines.join("\n") };
}

export const SHOT_PART_LIMITS = { min: 12, max: 500 } as const;
export const PROMPT_MARKERS = ["[镜头]", "[场景]", "[角色]", "[道具]", "[规格]"] as const;

/** 字面粗筛不能识别所有人名、代词或外貌改写；通过仍需人工审阅。 */
export function validateShotPart(shot: Shot, bible: Bible, part: string): void {
  const length = Array.from(part.trim()).length;
  if (length < SHOT_PART_LIMITS.min || length > SHOT_PART_LIMITS.max) throw new Error(`${shot.shot_id} 镜头部分须为 ${SHOT_PART_LIMITS.min}–${SHOT_PART_LIMITS.max} 个字符（去除首尾空白计数）`);
  if (/[CPL]\d+/i.test(part)) throw new Error(`${shot.shot_id} 镜头部分不得包含设定编号；请使用该镜引用的名称`);
  if (PROMPT_MARKERS.some(marker => part.includes(marker))) throw new Error(`${shot.shot_id} 镜头部分不得包含模板保留标记 ${PROMPT_MARKERS.join("、")}；仅提交动作、构图、情绪与镜头语言`);
  for (const character of bible.characters) {
    if (shot.character_ids.includes(character.id)) continue;
    const mentioned = [character.name, ...(character.aliases ?? [])].find(name => part.includes(name.trim()));
    if (mentioned) throw new Error(`${shot.shot_id} 提到“${mentioned}”，该角色 ${character.name} 不在本镜角色引用中；请移除镜头外角色，或回到分镜修正引用`);
  }
}

/** 旧上下文实验的 DTO；四工序模型工具已不使用这些接口。 */
export function shotContext(shot: Shot, bible: Artifacts["bible"]) {
  const named = (id: string) => {
    const entry = [...bible.locations, ...bible.characters, ...bible.props].find(entry => entry.id === id);
    if (!entry) throw new Error(`${shot.shot_id} 引用 ${id} 不存在于采用设定集`);
    return entry.name;
  };
  return { ...shot, names: { location: named(shot.location_id), characters: shot.character_ids.map(named), props: shot.prop_ids.map(named) } };
}
export function shotList(board: { shots: Shot[] }) {
  return board.shots.map(shot => ({ shot_id: shot.shot_id, action: Array.from(shot.action.replace(/\s+/g, " ")).slice(0, 60).join("") }));
}
