import { STAGES, type Stage } from "../contracts/index.js";

export type StageStatus = "locked" | "ready" | "pending_review" | "adopted";
export interface StageState {
  status: StageStatus;
  versions: number[];
  adopted_version: number | null;
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
    if (states[dependency].status !== "adopted" || states[dependency].adopted_version === null) {
      throw new Error(`不能运行 ${stage}：依赖阶段 ${dependency} 尚未采用版本`);
    }
  }
  const status = states[stage].status;
  if (status !== "ready" && status !== "pending_review") {
    throw new Error(`不能运行 ${stage}：当前状态 ${status}；已采用阶段的返工留到 P8`);
  }
}

export function recordDraft(states: Workflow, stage: Stage, version: number): void {
  assertRunnable(states, stage);
  const state = states[stage];
  if (version !== (state.versions.at(-1) ?? 0) + 1) throw new Error("草稿版本必须连续递增");
  state.versions.push(version);
  state.status = "pending_review";
}

export function adoptDraft(states: Workflow, stage: Stage, version: number): void {
  const state = states[stage];
  if (state.status !== "adopted" || state.adopted_version !== version) {
    assertRunnable(states, stage);
    if (state.status !== "pending_review" || !state.versions.includes(version)) {
      throw new Error(`不能采用 ${stage} v${version}：草稿版本不存在或未待确认`);
    }
    state.adopted_version = version;
    state.status = "adopted";
  }
  for (const candidate of STAGES) {
    if (states[candidate].status === "locked" && dependenciesAdopted(states, candidate)) {
      states[candidate].status = "ready";
    }
  }
}
