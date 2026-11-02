import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseStage, validateArtifact, validateBibleCoverage, validateStoryboardReferences, validateVersionMetadata, type Artifacts, type Stage, type VersionMetadata } from "../contracts/index.js";
import { adoptDraft, assertRunnable, initialWorkflow, recordDraft, reviewDraft, reviewOf, type Workflow } from "../workflow/index.js";

export interface Project {
  id: string;
  title: string;
  stages: Workflow;
  version_metadata?: Partial<Record<Stage, Record<number, VersionMetadata>>>;
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

  list(): Project[] {
    let entries;
    try { entries = readdirSync(this.root, { withFileTypes: true }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const projects: Project[] = [];
    for (const entry of entries) {
      try {
        if (!entry.isDirectory()) throw new Error("非项目目录");
        const project = this.load(entry.name); // 复用 ID 与 project.json 检查。
        if (project.id !== entry.name) throw new Error("项目 ID 与目录不一致");
        projects.push(project);
      } catch {
        // 不输出异常原文或文件内容；名称转义，保证每个跳过项仅记一行。
        console.warn(`跳过无效项目条目 ${JSON.stringify(entry.name)}：不是可读取的项目目录`);
      }
    }
    return projects;
  }

  load(id: string): Project {
    const file = join(this.projectDir(id), "project.json");
    try {
      const project = JSON.parse(readFileSync(file, "utf8")) as Project;
      for (const state of Object.values(project.stages)) {
        for (const version of state.versions) (state.reviews ??= {})[version] ??= reviewOf(state, version);
      }
      return project;
    }
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
    this.validate(id, stage, artifact); // 在创建目录或文件之前验收。
    const version = (project.stages[stage].versions.at(-1) ?? 0) + 1;
    const file = this.artifactPath(id, stage, version);
    mkdirSync(join(this.projectDir(id), "artifacts", stage), { recursive: true });
    writeFileSync(file, `${JSON.stringify(artifact, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    recordDraft(project.stages, stage, version);
    this.save(project);
    return version;
  }

  /** 元数据随项目落盘，独立于可改变的审阅结论，刷新与审阅均保留。 */
  saveVersionMetadata(id: string, stage: Stage, version: number, metadata: VersionMetadata): void {
    parseStage(stage);
    const project = this.load(id);
    if (!project.stages[stage].versions.includes(version)) throw new Error(`草稿版本不存在：${stage} v${version}`);
    validateVersionMetadata(metadata);
    const source = metadata.revision.revise_from;
    if (source !== null && (source >= version || !project.stages[stage].versions.includes(source))) throw new Error("修改来源版本不存在或不早于新版本");
    ((project.version_metadata ??= {})[stage] ??= {})[version] = structuredClone(metadata);
    this.save(project);
  }

  adopt(id: string, stage: Stage, version: number): Project {
    parseStage(stage);
    const project = this.load(id);
    // 先检查状态和版本，拒绝时不改磁盘；再检查版本文件没有损坏。
    const alreadyAdopted = project.stages[stage].adopted_version === version;
    adoptDraft(project.stages, stage, version);
    this.validate(id, stage, JSON.parse(readFileSync(this.artifactPath(id, stage, version), "utf8")));
    this.save(project);
    if (!alreadyAdopted) this.audit(project, stage, version);
    return project;
  }

  discard(id: string, stage: Stage, version: number, note?: string): Project {
    return this.review(id, stage, version, "discarded", note);
  }

  requestChanges(id: string, stage: Stage, version: number, note: string): Project {
    return this.review(id, stage, version, "changes_requested", note);
  }

  private review(id: string, stage: Stage, version: number, status: "discarded" | "changes_requested", note?: string): Project {
    parseStage(stage);
    const project = this.load(id);
    reviewDraft(project.stages, stage, version, status, note);
    this.save(project);
    this.audit(project, stage, version);
    return project;
  }

  private audit(project: Project, stage: Stage, version: number): void {
    const { status, at, note } = reviewOf(project.stages[stage], version);
    appendFileSync(join(this.projectDir(project.id), "audit.jsonl"),
      `${JSON.stringify({ actor: "local", action: status, at, stage, version, ...(note === undefined ? {} : { note }) })}\n`, { mode: 0o600 });
  }

  revisionContext(id: string, stage: Stage, version: number): { original_json: string; note: string } {
    const project = this.load(id);
    assertRunnable(project.stages, stage);
    const review = reviewOf(project.stages[stage], version);
    if (review.status !== "changes_requested" || !review.note?.trim()) {
      throw new Error(`不能按意见修改 ${stage} v${version}：必须是有修改意见的 changes_requested 版本`);
    }
    const original_json = readFileSync(this.artifactPath(id, stage, version), "utf8");
    this.validate(id, stage, JSON.parse(original_json));
    return { original_json, note: review.note };
  }

  readAdopted<S extends Stage>(id: string, stage: S): Artifacts[S] {
    parseStage(stage);
    const state = this.load(id).stages[stage];
    if (state.status !== "adopted" || state.adopted_version === null) throw new Error(`${stage} 尚未采用版本`);
    return this.readVersion(id, stage, state.adopted_version);
  }

  readVersion<S extends Stage>(id: string, stage: S, version: number): Artifacts[S] {
    const file = this.artifactPath(id, stage, version);
    if (!this.load(id).stages[stage].versions.includes(version)) throw new Error(`草稿版本不存在：${stage} v${version}`);
    const artifact: unknown = JSON.parse(readFileSync(file, "utf8"));
    this.validate(id, stage, artifact);
    return artifact;
  }

  private validate<S extends Stage>(id: string, stage: S, artifact: unknown): asserts artifact is Artifacts[S] {
    validateArtifact(stage, artifact);
    if (stage === "storyboard") validateStoryboardReferences(artifact as Artifacts["storyboard"], this.readAdopted(id, "script"), this.readAdopted(id, "bible"));
    if (stage === "bible") validateBibleCoverage(artifact as Artifacts["bible"], this.readAdopted(id, "script"));
  }

  sessionDir(id: string): string {
    this.load(id);
    const dir = join(this.projectDir(id), "sessions");
    mkdirSync(dir, { recursive: true });
    return dir;
  }
}
