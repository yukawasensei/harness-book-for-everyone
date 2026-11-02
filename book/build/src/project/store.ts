import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseStage, validateArtifact, type Artifacts, type Stage } from "../contracts/index.js";
import { adoptDraft, assertRunnable, initialWorkflow, recordDraft, type Workflow } from "../workflow/index.js";

export interface Project {
  id: string;
  title: string;
  stages: Workflow;
}

/** 本章使用单进程本地存储；并发写入、崩溃恢复和多用户权限不在此契约内。 */
export class ProjectStore {
  readonly root: string;
  constructor(packageRoot: string) { this.root = resolve(packageRoot, "projects"); }

  projectDir(id: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id)) throw new Error("项目 ID 不合规（不接受路径）");
    return join(this.root, id);
  }

  create(title: string): Project {
    if (!title.trim()) throw new Error("项目标题不能为空");
    const project: Project = { id: randomUUID(), title: title.trim(), stages: initialWorkflow() };
    mkdirSync(this.projectDir(project.id), { recursive: true });
    this.save(project);
    return project;
  }

  load(id: string): Project {
    const file = join(this.projectDir(id), "project.json");
    try { return JSON.parse(readFileSync(file, "utf8")) as Project; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`项目不存在：${id}`);
      throw error;
    }
  }

  private save(project: Project): void {
    const target = join(this.projectDir(project.id), "project.json");
    const temp = `${target}.tmp`;
    writeFileSync(temp, `${JSON.stringify(project, null, 2)}\n`, { mode: 0o600 });
    renameSync(temp, target);
  }

  artifactPath(id: string, stage: Stage, version: number): string {
    parseStage(stage);
    if (!Number.isSafeInteger(version) || version < 1) throw new Error("版本号必须为正整数");
    return join(this.projectDir(id), "artifacts", stage, `v${version}.json`);
  }

  writeDraft<S extends Stage>(id: string, stage: S, artifact: unknown): number {
    parseStage(stage);
    const project = this.load(id);
    assertRunnable(project.stages, stage);
    validateArtifact(stage, artifact); // 在创建目录或文件之前验收。
    const version = (project.stages[stage].versions.at(-1) ?? 0) + 1;
    const file = this.artifactPath(id, stage, version);
    mkdirSync(join(this.projectDir(id), "artifacts", stage), { recursive: true });
    writeFileSync(file, `${JSON.stringify(artifact, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    recordDraft(project.stages, stage, version);
    this.save(project);
    return version;
  }

  adopt(id: string, stage: Stage, version: number): Project {
    parseStage(stage);
    const project = this.load(id);
    // 先检查状态和版本，拒绝时不改磁盘；再检查版本文件没有损坏。
    adoptDraft(project.stages, stage, version);
    validateArtifact(stage, JSON.parse(readFileSync(this.artifactPath(id, stage, version), "utf8")));
    this.save(project);
    return project;
  }

  readAdopted<S extends Stage>(id: string, stage: S): Artifacts[S] {
    parseStage(stage);
    const state = this.load(id).stages[stage];
    if (state.status !== "adopted" || state.adopted_version === null) throw new Error(`${stage} 尚未采用版本`);
    const artifact: unknown = JSON.parse(readFileSync(this.artifactPath(id, stage, state.adopted_version), "utf8"));
    validateArtifact(stage, artifact);
    return artifact;
  }

  sessionDir(id: string): string {
    this.load(id);
    const dir = join(this.projectDir(id), "sessions");
    mkdirSync(dir, { recursive: true });
    return dir;
  }
}
