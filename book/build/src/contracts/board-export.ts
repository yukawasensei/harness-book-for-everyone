import type { Board } from "./index.js";

/** 任意文本均作为原文代码块；围栏长于内容中所有反引号串。 */
function block(text: string): string {
  const longest = Math.max(0, ...Array.from(text.matchAll(/`+/g), match => match[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}text\n${text}${text.endsWith("\n") ? "" : "\n"}${fence}`;
}

/** 只渲染指定已校验版本，不读取当前设定或重新拼装提示词。 */
export function renderBoardMarkdown(board: Board, version: number): string {
  if (!Number.isSafeInteger(version) || version < 1) throw new Error("版本号必须为正整数");
  return [
    `# 分镜板 v${version}`,
    ...board.shots.map(shot => [
      `## ${shot.shot_id}`,
      `场次：${shot.scene_id} · 景别：${shot.shot_size} · 时长：${shot.duration_s} 秒`,
      `引用：${shot.injected_ids.join("、")}`,
      `### 运镜\n\n${block(shot.camera)}`,
      `### 动作\n\n${block(shot.action)}`,
      `### 对白\n\n${block(shot.dialogue ?? "无")}`,
      `### 完整提示词\n\n${block(shot.final_prompt)}`,
    ].join("\n\n")),
  ].join("\n\n") + "\n";
}
