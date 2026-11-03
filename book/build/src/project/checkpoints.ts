import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SceneChanges, Scene, BoardSceneInput } from "../contracts/index.js";
import type { Basis } from "./provenance.js";

export type ResumeChoice = "resume" | "restart";
export interface Checkpoint {
  based_on: Basis;
  snapshot: {
    scenes?: (Scene | BoardSceneInput)[];
    finalized_version: number | null;
    scene_changes?: SceneChanges;
  };
}
export function readOptional<T>(path: string): T | null {
  try { return JSON.parse(readFileSync(path, "utf8")) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
export function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  renameSync(`${path}.tmp`, path);
}
