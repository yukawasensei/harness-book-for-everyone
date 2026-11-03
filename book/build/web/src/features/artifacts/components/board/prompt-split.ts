/**
 * 拆分分镜提示词为模型创作部分（蓝色）与程序注入部分（绿色）。
 * 模型部分为针对该镜的镜头语言（[镜头] shot_part），其余为程序从采用设定集带入的场景、角色、道具与规格。
 */
export interface SplitPromptResult {
  modelPart: string;
  injectedPart: string;
}

export function splitFinalPrompt(finalPrompt: string, shotPart: string): SplitPromptResult {
  const normalized = finalPrompt.replace(/\r\n/g, "\n");
  const prefix = `[镜头] ${shotPart.trim()}`;

  if (normalized.startsWith(prefix)) {
    const after = normalized.slice(prefix.length).replace(/^\n+/, "");
    return {
      modelPart: prefix,
      injectedPart: after,
    };
  }

  // 若换行或首尾空格有微小出入，退回到子串定位
  const trimmedPart = shotPart.trim();
  const idx = normalized.indexOf(trimmedPart);
  if (idx !== -1) {
    const end = idx + trimmedPart.length;
    return {
      modelPart: normalized.slice(0, end).trim(),
      injectedPart: normalized.slice(end).replace(/^\n+/, "").trim(),
    };
  }

  return {
    modelPart: `[镜头] ${shotPart}`,
    injectedPart: normalized,
  };
}
