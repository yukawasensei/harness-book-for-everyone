import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

export const STAGES = ["topic", "synopsis", "script", "bible", "storyboard", "prompts"] as const;
export type Stage = typeof STAGES[number];

const text = () => Type.String({ minLength: 1, pattern: "\\S" });
const closed = { additionalProperties: false } as const;
const id = (prefix: string) => Type.String({ pattern: `^${prefix}[0-9]{2}$` });
const sceneId = () => id("S");
const shotId = () => Type.String({ pattern: "^S[0-9]{2}-[0-9]{2}$" });
const settingId = () => Type.String({ pattern: "^[CPL][0-9]{2}$" });
const ids = (prefix: string) => Type.Array(id(prefix), { uniqueItems: true });

export const TopicSchema = Type.Object({
  title: text(), logline: text(), genre: text(), audience: text(),
  target_minutes: Type.Number({ exclusiveMinimum: 0 }),
}, closed);

export const SynopsisSchema = Type.Object({
  title: text(), logline: text(),
  beats: Type.Array(text(), { minItems: 4, maxItems: 4 }),
  tone: text(),
}, closed);

const LineSchema = Type.Union([
  Type.Object({ kind: Type.Literal("action"), text: text() }, closed),
  Type.Object({ kind: Type.Literal("dialogue"), character: text(), text: text() }, closed),
]);
export const SceneSchema = Type.Object({
  scene_id: sceneId(), heading: text(), summary: text(),
  lines: Type.Array(LineSchema, { minItems: 1 }),
}, closed);
export type Scene = Static<typeof SceneSchema>;
export const ScriptSchema = Type.Object({
  scenes: Type.Array(SceneSchema, { minItems: 1 }),
}, closed);

/** 单场 schema 与业务规则同时在可信边界检查，不依赖模型自查。 */
export function validateScene(value: unknown): asserts value is Scene {
  const errors = Value.Errors(SceneSchema, value);
  if (errors.length) throw new Error(`scene schema 不合规：${errors.map(e => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
  const scene = value as Scene;
  for (const line of scene.lines) {
    if (line.kind === "dialogue" && !("character" in line && typeof line.character === "string" && line.character.trim())) {
      throw new Error(`${scene.scene_id} dialogue 必须有 character`);
    }
    if (line.kind === "action" && "character" in line) throw new Error(`${scene.scene_id} action 不得有 character`);
  }
}

export function validateScriptStructure(script: { scenes: Scene[] }): void {
  script.scenes.forEach((scene, index) => {
    validateScene(scene);
    const expected = `S${String(index + 1).padStart(2, "0")}`;
    if (scene.scene_id !== expected) throw new Error(`script 场号必须从 S01 连续；位置 ${index + 1} 应为 ${expected}，收到 ${scene.scene_id}；请补齐或重排场号，重交后再 finalize`);
  });
}

const bibleId = (prefix: string) => Type.String({ pattern: `^${prefix}(0[1-9]|[1-9][0-9])$` });
const appearsIn = () => Type.Array(sceneId(), { minItems: 1, uniqueItems: true });
export const FIXED_DESCRIPTION_LIMITS = { min: 12, max: 160 } as const;
export const PLOT_WORDS = ["走进", "拿起", "放下", "转身", "追赶", "争吵", "说道", "问道", "回答", "决定", "冲向", "递给"] as const;

export const BibleSchema = Type.Object({
  characters: Type.Array(Type.Object({
    id: bibleId("C"), name: text(), aliases: Type.Optional(Type.Array(text(), { uniqueItems: true })),
    role: text(), appearance: text(), personality: text(), appears_in: appearsIn(),
  }, closed), { minItems: 1 }),
  props: Type.Array(Type.Object({ id: bibleId("P"), name: text(), description: text(), appears_in: appearsIn() }, closed)),
  locations: Type.Array(Type.Object({ id: bibleId("L"), name: text(), description: text(), appears_in: appearsIn() }, closed), { minItems: 1 }),
}, closed);

export const StoryboardSchema = Type.Object({
  shots: Type.Array(Type.Object({
    shot_id: shotId(), scene_id: sceneId(), location_id: id("L"),
    character_ids: ids("C"), prop_ids: ids("P"),
    shot_size: Type.Union(["远景", "全景", "中景", "近景", "特写"].map(x => Type.Literal(x))),
    camera: text(), action: text(), dialogue: Type.Optional(text()),
    duration_s: Type.Number({ exclusiveMinimum: 0 }),
  }, closed), { minItems: 1 }),
}, closed);

export const PromptsSchema = Type.Object({
  items: Type.Array(Type.Object({
    shot_id: shotId(), shot_part: text(),
    injected_ids: Type.Array(settingId(), { minItems: 1, uniqueItems: true }),
    final_prompt: text(),
  }, closed), { minItems: 1 }),
}, closed);

export const schemas = {
  topic: TopicSchema, synopsis: SynopsisSchema, script: ScriptSchema,
  bible: BibleSchema, storyboard: StoryboardSchema, prompts: PromptsSchema,
} as const;
export type Artifacts = { [S in Stage]: Static<typeof schemas[S]> };

/** 固定描述只做可复现的粗筛；语义与视觉质量仍需人审。 */
function validateBibleStructure(bible: Artifacts["bible"]): void {
  const seen = new Set<string>();
  const names = new Map<string, string>();
  for (const entry of [...bible.characters, ...bible.props, ...bible.locations]) {
    if (seen.has(entry.id)) throw new Error(`设定集编号重复：${entry.id}`);
    seen.add(entry.id);
    const description = "appearance" in entry ? entry.appearance : entry.description;
    const length = Array.from(description.trim()).length;
    const { min, max } = FIXED_DESCRIPTION_LIMITS;
    if (length < min || length > max) throw new Error(`${entry.id} 固定描述须为 ${min}–${max} 个字符（去除首尾空白计数）`);
    if (/S\d+|第\s*[\d零〇一二三四五六七八九十百]+\s*场/i.test(description)) throw new Error(`${entry.id} 固定描述不得含场次号，请仅描述稳定外观`);
    const words = PLOT_WORDS.filter(word => description.includes(word));
    if (words.length) throw new Error(`${entry.id} 固定描述含剧情词：${words.join("、")}；请移入剧本或镜头动作（粗筛仍需人工审阅）`);
  }
  for (const character of bible.characters) {
    for (const name of [character.name, ...(character.aliases ?? [])]) {
      const key = name.trim();
      if (names.has(key)) throw new Error(`角色称呼“${key}”重复：${names.get(key)} 与 ${character.id}；请消除名称或别名歧义`);
      names.set(key, character.id);
    }
  }
}

/** 跨产物检查只接受存储层读取的人工采用剧本。 */
export function validateBibleCoverage(bible: Artifacts["bible"], script: Artifacts["script"]): void {
  const issues: string[] = [];
  const sceneIds = new Set(script.scenes.map(scene => scene.scene_id));
  for (const entry of [...bible.characters, ...bible.props, ...bible.locations]) {
    for (const scene of entry.appears_in) if (!sceneIds.has(scene)) issues.push(`${entry.id} 来源场 ${scene} 不存在于采用剧本`);
  }
  for (const scene of script.scenes) {
    const speakers = new Set(scene.lines.filter(line => line.kind === "dialogue").map(line => line.character.trim()));
    for (const speaker of speakers) {
      const character = bible.characters.find(c => [c.name, ...(c.aliases ?? [])].some(name => name.trim() === speaker));
      if (!character) issues.push(`缺少台词角色“${speaker}”（${scene.scene_id}），请补充角色或别名`);
      else if (!character.appears_in.includes(scene.scene_id)) issues.push(`角色“${speaker}”（${character.id}）来源场缺少 ${scene.scene_id}`);
    }
    if (!bible.locations.some(location => location.appears_in.includes(scene.scene_id))) issues.push(`${scene.scene_id} 缺少关联地点，请补充地点的来源场`);
  }
  if (issues.length) throw new Error(`设定集覆盖检查未通过：${issues.join("；")}`);
}

export const SceneChangesSchema = Type.Object({
  revise_from: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  resubmitted: Type.Array(sceneId(), { uniqueItems: true }),
  reused: Type.Array(sceneId(), { uniqueItems: true }),
  removed: Type.Array(sceneId(), { uniqueItems: true }),
}, closed);
export type SceneChanges = Static<typeof SceneChangesSchema>;
export interface VersionMetadata { revision: SceneChanges }

export function validateVersionMetadata(value: VersionMetadata): void {
  if (!Value.Check(Type.Object({ revision: SceneChangesSchema }, closed), value)) throw new Error("版本修改记录不合规");
}

export function parseStage(value: string): Stage {
  if (!(STAGES as readonly string[]).includes(value)) throw new Error(`未知阶段 ${value}；可用：${STAGES.join(", ")}`);
  return value as Stage;
}

/** 不做类型转换或默认值填充：输入不合规时，保持磁盘原样。 */
export function validateArtifact<S extends Stage>(stage: S, value: unknown): asserts value is Artifacts[S] {
  if (stage === "bible" && value && typeof value === "object") {
    for (const group of ["characters", "props", "locations"] as const) {
      const entries = (value as Record<string, unknown>)[group];
      if (Array.isArray(entries) && entries.some(entry => entry && typeof entry === "object" && !("appears_in" in entry))) {
        throw new Error("设定集缺少来源场 appears_in，请从采用剧本重新抽取；旧文件不会自动迁移或覆盖");
      }
    }
  }
  const errors = Value.Errors(schemas[stage], value);
  if (errors.length) {
    throw new Error(`${stage} schema 不合规：${errors.map(e => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
  }
  if (stage === "script") validateScriptStructure(value as Artifacts["script"]);
  if (stage === "bible") validateBibleStructure(value as Artifacts["bible"]);
}
