import type { Stage } from "../../../../src/contracts/index.js";

export const queryKeys = {
  config: ["config"] as const,
  projects: ["projects"] as const,
  project: (id: string) => ["project", id] as const,
  timeline: (id: string) => ["timeline", id] as const,
  stageVersion: (id: string, stage: Stage, version: number) =>
    ["stage-version", id, stage, version] as const,
};
