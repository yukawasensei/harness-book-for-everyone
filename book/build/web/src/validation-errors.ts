/** 展示层翻译；不改变闸门判断或原始校验消息。 */
export interface ValidationContext { toolName?: string; args?: unknown }
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
const fields: Record<string, string> = {
  title: "片名", logline: "一句话冲突", genre: "类型", audience: "受众", target_minutes: "目标时长",
  beats: "叙事拍", tone: "基调", scenes: "剧本场次", scene_id: "场次编号", heading: "地点与时间", summary: "摘要",
  lines: "内容行", kind: "行类型", text: "内容", character: "角色", characters: "角色列表", props: "道具列表",
  locations: "地点列表", id: "编号", name: "名称", role: "角色定位", appearance: "外观", personality: "性格",
  description: "描述", shots: "镜头列表", shot_id: "镜头编号", location_id: "地点编号", character_ids: "角色编号",
  prop_ids: "道具编号", shot_size: "景别", camera: "镜头运动", action: "动作", dialogue: "台词",
  duration_s: "时长", items: "条目", shot_part: "镜头描述", injected_ids: "引用编号", final_prompt: "完整提示词",
};
const field = (name: string) => fields[name] ?? `字段“${name}”`;
const typeLabels: Record<string, string> = { string: "文字", number: "数字", integer: "整数", boolean: "是或否", array: "列表", object: "对象", null: "空值" };
const comparisons: Record<string, string> = { ">": "大于", "<": "小于", ">=": "大于或等于", "<=": "小于或等于" };

function location(path: string, scene: Record<string, unknown>): string {
  const segments = path.split("/").slice(1).map(part => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  let label = "";
  const sceneIndex = segments.indexOf("scenes");
  const sceneNumber = sceneIndex >= 0 && /^\d+$/.test(segments[sceneIndex + 1] ?? "")
    ? Number(segments[sceneIndex + 1]) + 1 : typeof scene.scene_id === "string" ? Number(scene.scene_id.slice(1)) : null;
  if (sceneNumber && Number.isInteger(sceneNumber)) label += `第 ${sceneNumber} 场`;
  const lineIndex = segments.indexOf("lines");
  if (lineIndex >= 0 && /^\d+$/.test(segments[lineIndex + 1] ?? "")) label += `第 ${Number(segments[lineIndex + 1]) + 1} 行`;
  const last = segments.at(-1);
  if (last && !/^\d+$/.test(last)) label += `${label ? "的" : ""}${field(last)}`;
  else if (!label) label = "产物";
  return label;
}

export function translateValidationError(raw: string, context: ValidationContext = {}): string {
  if (raw.startsWith("Invalid arguments for tool")) return "工具参数不是完整的 JSON，请修正后重新提交。";
  if (raw.startsWith("Validation failed for tool")) {
    const reasons = raw.split("Received arguments:")[0].split("\n").filter(line => /^\s*- /.test(line));
    const normalized = reasons.map(line => line.replace(/^\s*- /, "").replace(/^([^:]+):\s*/, (_match, path: string) => `${path === "root" ? "/" : `/${path.replaceAll(".", "/")}`} `)).join("; ");
    return normalized ? translateValidationError(`参数 schema 不合规：${normalized}`, context) : "工具参数不符合要求，请展开查看原始校验信息。";
  }
  if (/场号必须从 S01 连续/.test(raw)) {
    const expected = raw.match(/位置 (\d+) 应为 (S\d+)/);
    return `场次编号需从 S01 连续${expected ? `，第 ${expected[1]} 场应为 ${expected[2]}` : ""}；请补齐或重排后再汇总。`;
  }
  if (/scene_id 不合规/.test(raw)) return "场次编号格式不正确，请使用 S01 这样的两位连续编号。";
  const removed = raw.match(/进行中草稿不存在 (S\d+)/);
  if (removed) return `暂存草稿中不存在 ${removed[1]}，无法删除。`;
  const finalized = raw.match(/本次剧本已生成 v(\d+)/);
  if (finalized) return `本次剧本已经汇总为 v${finalized[1]}，不能继续写场或重复汇总。`;
  const lineRule = raw.match(/(S\d+) (dialogue 必须有 character|action 不得有 character)/);
  if (lineRule) return `${lineRule[1]}${lineRule[2].startsWith("dialogue") ? "的台词必须填写角色。" : "的动作行不能填写角色。"}`;
  if (!/schema 不合规/.test(raw)) return raw;

  const args = object(context.args), scene = object(args.scene);
  if (context.toolName === "write_scene" && Array.isArray(scene.lines)) {
    const specific = scene.lines.flatMap((value, index) => {
      const line = object(value);
      const at = location(`/lines/${index}`, scene);
      if (line.kind === "dialogue") {
        if (!("character" in line) || (typeof line.character === "string" && !line.character.trim())) return [`${at}是台词，但缺少角色`];
        if (typeof line.character !== "string") return [`${at}的角色必须是文字`];
      }
      if (line.kind === "action" && "character" in line) return [`${at}是动作，不能填写角色`];
      return [];
    });
    if (specific.length) return specific.join("；");
  }

  const body = raw.slice(raw.indexOf("：") + 1);
  const parts = body.split(/;\s*|\n/);
  // union 的备选分支错误不应遮住实际字段问题。
  const useful = parts.filter(part => !/must match a schema in anyOf|must be equal to constant/.test(part));
  const translated = (useful.length ? useful : parts).map(part => {
    const match = part.match(/^(\/\S*)\s+(.*)$/);
    const path = match?.[1] ?? "/", message = match?.[2] ?? part;
    const at = location(path, scene);
    if (/false schema|schema is false/i.test(message)) return `不允许额外${at}`;
    const required = message.match(/must have required propert(?:ies|y) (.+)/i) ?? message.match(/缺少 (.+)/);
    if (required) return `${at}缺少${required[1].split(/,\s*/).map(field).join("、")}`;
    if (/必须为正数|不能为空|不能为空白/.test(message)) {
      return message.replace(/\b[a-z][a-z0-9_]*\b/g, key => fields[key] ?? key).replace(/\s+(?=必须|不能)/g, "");
    }
    const type = message.match(/must be (string|number|integer|boolean|array|object|null)$/);
    if (type) return `${at}必须是${typeLabels[type[1]]}`;
    if (/additional propert/i.test(message)) return `${at}不允许额外字段${message.match(/properties (.+)/i)?.[1] ? `：${message.match(/properties (.+)/i)![1]}` : ""}`;
    const count = message.match(/must not have (fewer|more) than (\d+) (items|characters)/i);
    if (count) return `${at}${count[1].toLowerCase() === "fewer" ? "至少" : "最多"}需要 ${count[2]} ${count[3] === "items" ? "项" : "个字符"}`;
    if (/duplicate|unique/i.test(message)) return `${at}不能有重复项`;
    if (/pattern/.test(message)) {
      if (/scene_id/.test(path)) return `${at}格式不正确，请使用 S01 这样的编号`;
      if (message.includes("\\S")) return `${at}不能为空白`;
      return `${at}格式不正确，请检查编号或文字格式`;
    }
    const range = message.match(/must be (>=|<=|>|<) (-?[\d.]+)/);
    if (range) return `${at}必须${comparisons[range[1]]} ${range[2]}`;
    if (/anyOf|constant|enum/.test(message)) return `${at}不在允许的选项中`;
    return `${at}不符合要求，请展开查看原始校验信息`;
  });
  return [...new Set(translated)].join("；");
}
