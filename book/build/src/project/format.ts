import { Type } from "typebox";
import { Value } from "typebox/value";
import { STAGES } from "../contracts/index.js";
import type { Project } from "./store.js";

/** 最终四工序格式；旧格式与五工序过渡格式均拒读。 */
export const PROJECT_FORMAT = 2 as const;
export class ProjectFormatUnsupported extends Error {
  readonly code = "PROJECT_FORMAT_UNSUPPORTED";
  constructor() {
    super("项目格式不兼容（六工序旧项目或其他版本），请用对应旧版打开或新建项目；原文件未修改");
  }
}

const version = Type.Integer({ minimum: 1 });
const review = Type.Object({
  status: Type.Union((["pending", "adopted", "discarded", "changes_requested"] as const).map(s => Type.Literal(s))),
  note: Type.Optional(Type.String()), at: Type.Optional(Type.String()),
}, { additionalProperties: false });
const state = Type.Object({
  status: Type.Union((["locked", "ready", "pending_review", "adopted", "stale"] as const).map(s => Type.Literal(s))),
  versions: Type.Array(version, { uniqueItems: true }),
  adopted_version: Type.Union([version, Type.Null()]),
  reviews: Type.Optional(Type.Record(Type.String({ pattern: "^[1-9][0-9]*$" }), review)),
}, { additionalProperties: false });
const header = Type.Object({
  format_version: Type.Literal(PROJECT_FORMAT), id: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1, pattern: "\\S" }),
  stages: Type.Object(Object.fromEntries(STAGES.map(stage => [stage, state])), { additionalProperties: false }),
});

/** 在会话、暂存和运行恢复之前验证，绝不把缺键旧格式补成新格式。 */
export function validateProjectFormat(value: unknown): asserts value is Project {
  if (!value || typeof value !== "object" || Reflect.get(value, "format_version") !== PROJECT_FORMAT) throw new ProjectFormatUnsupported();
  const stages = Reflect.get(value, "stages");
  if (!stages || typeof stages !== "object" || Object.keys(stages).length !== STAGES.length || STAGES.some(stage => !Object.hasOwn(stages, stage))) throw new ProjectFormatUnsupported();
  if (!Value.Check(header, value)) throw new Error("项目版本或状态结构不合规");
  const project = value as unknown as Project;
  for (const stage of STAGES) {
    const state = project.stages[stage];
    if (state.versions.some((v, index) => v !== index + 1)
      || (state.adopted_version !== null && !state.versions.includes(state.adopted_version))
      || (state.status === "adopted" && state.adopted_version === null)
      || (state.status === "stale" && state.adopted_version === null && (stage !== "board" || !state.versions.length))
      || Object.keys(state.reviews ?? {}).some(v => !state.versions.includes(Number(v)))) throw new Error("项目版本或状态关系不合规");
  }
}
