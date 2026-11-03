/** 工具参数键 → 中文标签；键名来自 `src/agent/` 工具定义。 */
export const TOOL_ARG_LABELS: Record<string, string> = {
  stage: "阶段",
  scene: "场次",
  scene_id: "场次编号",
  artifact: "草稿",
  shot_id: "镜头编号",
  shot_part: "镜头描述",
  version: "版本",
};

const STAGE_VALUE_LABELS: Record<string, string> = {
  story: "故事",
  script: "剧本",
  bible: "设定集",
  board: "分镜脚本",
};

export type FormattedToolArgLine = { label: string; value: string };

export type FormattedToolArgs = {
  lines: FormattedToolArgLine[];
  /** 未知键的原始 JSON；无未知键时为 null */
  technical: string | null;
};

function parseRecord(input: unknown): Record<string, unknown> | null {
  if (input == null || input === "") return null;
  if (typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // 兼容 "stage: story, version: 1" 一类摘要
  }
  const pairs: Record<string, unknown> = {};
  for (const part of trimmed.split(/,\s*/)) {
    const match = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
    if (!match) return null;
    pairs[match[1]] = match[2].trim();
  }
  return Object.keys(pairs).length ? pairs : null;
}

function formatValue(key: string, value: unknown): string {
  if (key === "stage" && typeof value === "string") {
    return STAGE_VALUE_LABELS[value] ?? value;
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "无";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** 将工具参数整理为中文「标签：值」行；未知键归入 technical。 */
export function formatToolArgs(input: unknown): FormattedToolArgs {
  const record = parseRecord(input);
  if (!record) {
    if (input == null || input === "") return { lines: [], technical: null };
    const fallback = typeof input === "string" ? input : (() => {
      try { return JSON.stringify(input, null, 2); } catch { return String(input); }
    })();
    return { lines: [], technical: fallback || null };
  }

  const lines: FormattedToolArgLine[] = [];
  const unknown: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const label = TOOL_ARG_LABELS[key];
    if (!label) {
      unknown[key] = value;
      continue;
    }
    lines.push({ label, value: formatValue(key, value) });
  }

  return {
    lines,
    technical: Object.keys(unknown).length ? JSON.stringify(unknown, null, 2) : null,
  };
}
