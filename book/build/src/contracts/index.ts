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
export const ScriptSchema = Type.Object({
  scenes: Type.Array(Type.Object({
    scene_id: sceneId(), heading: text(), summary: text(),
    lines: Type.Array(LineSchema, { minItems: 1 }),
  }, closed), { minItems: 1 }),
}, closed);

export const BibleSchema = Type.Object({
  characters: Type.Array(Type.Object({
    id: id("C"), name: text(), role: text(), appearance: text(), personality: text(),
  }, closed), { minItems: 1 }),
  props: Type.Array(Type.Object({ id: id("P"), name: text(), description: text() }, closed)),
  locations: Type.Array(Type.Object({ id: id("L"), name: text(), description: text() }, closed), { minItems: 1 }),
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

export function parseStage(value: string): Stage {
  if (!(STAGES as readonly string[]).includes(value)) throw new Error(`未知阶段 ${value}；可用：${STAGES.join(", ")}`);
  return value as Stage;
}

/** 不做类型转换或默认值填充：输入不合规时，保持磁盘原样。 */
export function validateArtifact<S extends Stage>(stage: S, value: unknown): asserts value is Artifacts[S] {
  const errors = Value.Errors(schemas[stage], value);
  if (errors.length) {
    throw new Error(`${stage} schema 不合规：${errors.map(e => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
  }
}
