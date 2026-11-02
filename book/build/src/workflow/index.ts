import { STAGES, type Stage } from "../contracts/index.js";

export type StageStatus = "locked" | "ready" | "pending_review" | "adopted" | "stale";
export type ReviewStatus = "pending" | "adopted" | "discarded" | "changes_requested";
export interface VersionReview { status: ReviewStatus; note?: string; at?: string }
export interface StageState {
  status: StageStatus;
  versions: number[];
  adopted_version: number | null;
  reviews?: Record<number, VersionReview>;
}
export type Workflow = Record<Stage, StageState>;

export const DEPENDENCIES: Readonly<Record<Stage, readonly Stage[]>> = {
  topic: [],
  synopsis: ["topic"],
  script: ["synopsis"],
  bible: ["script"],
  storyboard: ["script", "bible"],
  prompts: ["storyboard", "bible"],
};

export function initialWorkflow(): Workflow {
  const blank = (status: StageStatus = "locked"): StageState => ({ status, versions: [], adopted_version: null });
  return {
    topic: blank("ready"), synopsis: blank(), script: blank(),
    bible: blank(), storyboard: blank(), prompts: blank(),
  };
}

function dependenciesAdopted(states: Workflow, stage: Stage): boolean {
  return DEPENDENCIES[stage].every(dependency =>
    states[dependency].status === "adopted" && states[dependency].adopted_version !== null);
}

export function assertRunnable(states: Workflow, stage: Stage): void {
  for (const dependency of DEPENDENCIES[stage]) {
    const label = states[dependency].status === "stale" ? "上游" : "依赖阶段 ";
    assertAdopted(states, dependency, `不能运行 ${stage}：${label}`);
  }
  const status = states[stage].status;
  if (!["ready", "pending_review", "adopted", "stale"].includes(status)) {
    throw new Error(`不能运行 ${stage}：当前状态 ${status}`);
  }
}

export function assertAdopted(states: Workflow, stage: Stage, prefix = "") {
  if (states[stage].status === "stale") throw new Error(`${prefix}${stage}待更新，请先确认仍然有效或返工`);
  if (states[stage].status !== "adopted" || states[stage].adopted_version === null) throw new Error(`${prefix}${stage} 尚未采用版本`);
}

export function recordDraft(states: Workflow, stage: Stage, version: number): void {
  assertRunnable(states, stage);
  const state = states[stage];
  if (version !== (state.versions.at(-1) ?? 0) + 1) throw new Error("草稿版本必须连续递增");
  state.versions.push(version);
  (state.reviews ??= {})[version] = { status: "pending" };
  if (state.adopted_version === null) state.status = "pending_review";
}

export function reviewOf(state: StageState, version: number): VersionReview {
  if (!state.versions.includes(version)) throw new Error(`草稿版本不存在：v${version}`);
  return state.reviews?.[version] ?? { status: state.adopted_version === version ? "adopted" : "pending" };
}

export function reviewDraft(states: Workflow, stage: Stage, version: number, status: "discarded" | "changes_requested", note?: string): void {
  const state = states[stage];
  const review = reviewOf(state, version);
  if (state.adopted_version === version && status === "discarded") throw new Error("已采用版本不可丢弃；请先切换采用版本");
  if (review.status !== "pending" && !(review.status === "adopted" && status === "changes_requested")) throw new Error(`不能审阅 ${stage} v${version}：当前审阅状态 ${review.status}`);
  if (status === "changes_requested" && !note?.trim()) throw new Error("修改意见不能为空");
  (state.reviews ??= {})[version] = { status, ...(note === undefined ? {} : { note }), at: new Date().toISOString() };
  state.status = state.adopted_version !== null ? (state.status === "stale" ? "stale" : "adopted")
    : state.versions.some(v => reviewOf(state, v).status === "pending") ? "pending_review" : "ready";
}

export function adoptDraft(states: Workflow, stage: Stage, version: number): void {
  const state = states[stage];
  if (state.status !== "adopted" || state.adopted_version !== version) {
    assertRunnable(states, stage);
    const review = reviewOf(state, version);
    if (review.status === "discarded") throw new Error(`不能采用 ${stage} v${version}：当前审阅状态 ${review.status}`);
    (state.reviews ??= {})[version] = { status: "adopted", at: new Date().toISOString() };
    state.adopted_version = version;
    state.status = "adopted";
  }
  for (const candidate of STAGES) {
    if (states[candidate].status === "locked" && dependenciesAdopted(states, candidate)) {
      states[candidate].status = "ready";
    }
  }
}
