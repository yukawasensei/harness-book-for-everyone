import { validateRating, SCORE_LABELS, type Ratings, type Dimension } from "./ratings.js";
import { assembleShotPrompt, validatePromptReferences } from "../contracts/prompts.js";
import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { STAGES, parseStage, validateArtifact, validateBibleCoverage, validateStoryboardReferences, validateVersionMetadata, type Artifacts, type Stage, type VersionMetadata } from "../contracts/index.js";
import { adoptDraft, assertAdopted, assertRunnable, initialWorkflow, recordDraft, reviewDraft, reviewOf, type Workflow } from "../workflow/index.js";
import { compareBible, currentBasis, refreshStale, sameBasis, type Basis, type Provenance, type Source } from "./provenance.js";
import { readOptional, writeJson, type Checkpoint } from "./checkpoints.js";
import type { RunInfo } from "../server/protocol.js";

export interface Project {
  id: string;
  title: string;
  stages: Workflow;
  version_metadata?: Partial<Record<Stage, Record<number, VersionMetadata>>>;
  provenance?: Provenance;
  ratings?: Ratings;
}

/** 单进程本地存储；支持业务暂存与残留运行恢复，不提供跨文件事务或多用户权限。 */
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

  writeDraft<S extends Stage>(id: string, stage: S, artifact: unknown, generatedBy?: Source["generated_by"]): number {
    parseStage(stage);
    const project = this.load(id);
    assertRunnable(project.stages, stage);
    this.validate(id, stage, artifact); // 在创建目录或文件之前验收。
    const version = (project.stages[stage].versions.at(-1) ?? 0) + 1;
    const file = this.artifactPath(id, stage, version);
    mkdirSync(join(this.projectDir(id), "artifacts", stage), { recursive: true });
    writeFileSync(file, `${JSON.stringify(artifact, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    recordDraft(project.stages, stage, version);
    const sources: Provenance = project.provenance ??= {};
    const stageSources: Record<number, Source> = sources[stage] ??= {};
    stageSources[version] = { based_on: currentBasis(project.stages, stage), ...(generatedBy ? { generated_by: generatedBy } : {}) };
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

  adopt(id: string, stage: Stage, version: number, confirmed = false): Project {
    parseStage(stage);
    const project = this.load(id);
    // 先检查状态和版本，拒绝时不改磁盘；再检查版本文件没有损坏。
    const alreadyAdopted = project.stages[stage].adopted_version === version;
    const previous = project.stages[stage].adopted_version;
    if (previous !== null && !alreadyAdopted && !confirmed) throw new Error("切换采用版本需要二次确认");
    adoptDraft(project.stages, stage, version);
    this.readVersion(id, stage, version);
    refreshStale(project.stages, project.provenance ?? {}, stage);
    this.save(project);
    if (!alreadyAdopted) {
      if (previous === null) this.audit(project, stage, version);
      else this.auditAction(id, "switch_adoption", { stage, version, previous, confirmed });
    }
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
    this.readVersion(id, stage, version);
    return { original_json, note: review.note };
  }

  readAdopted<S extends Stage>(id: string, stage: S): Artifacts[S] {
    parseStage(stage);
    const states = this.load(id).stages;
    assertAdopted(states, stage);
    return this.readVersion(id, stage, states[stage].adopted_version!);
  }

  readVersion<S extends Stage>(id: string, stage: S, version: number): Artifacts[S] {
    const file = this.artifactPath(id, stage, version);
    if (!this.load(id).stages[stage].versions.includes(version)) throw new Error(`草稿版本不存在：${stage} v${version}`);
    const artifact: unknown = JSON.parse(readFileSync(file, "utf8"));
    const source = this.load(id).provenance?.[stage]?.[version];
    // 历史版本按原始来源校验；人工确认仅更新有效性声明，不改历史内容。
    if (source) this.validate(id, stage, artifact, source.original_based_on ?? source.based_on);
    else validateArtifact(stage, artifact);
    return artifact;
  }

  private validate<S extends Stage>(id: string, stage: S, artifact: unknown, basis?: Basis): asserts artifact is Artifacts[S] {
    validateArtifact(stage, artifact);
    const read = <D extends Stage>(dependency: D): Artifacts[D] => {
      if (basis !== undefined) {
        if (basis[dependency] === undefined) throw new Error(`来源记录缺少 ${dependency}`);
        return this.readVersion(id, dependency, basis[dependency]!);
      }
      return this.readAdopted(id, dependency);
    };
    if (stage === "prompts") validatePromptReferences(artifact as Artifacts["prompts"], read("storyboard"), read("bible"));
    if (stage === "storyboard") validateStoryboardReferences(artifact as Artifacts["storyboard"], read("script"), read("bible"));
    if (stage === "bible") validateBibleCoverage(artifact as Artifacts["bible"], read("script"));
  }

  auditAction(id: string, action: string, details: Record<string, unknown>) {
    appendFileSync(join(this.projectDir(id), "audit.jsonl"), JSON.stringify({ actor: "local", action, at: new Date().toISOString(), ...details }) + "\n", { mode: 0o600 });
  }

  confirmValid(id: string, stage: Stage, reason: string, confirmed = false) {
    const project = this.load(id), state = project.stages[stage], version = state.adopted_version;
    if (!confirmed) throw new Error("确认仍然有效需要二次确认");
    if (typeof reason !== "string" || !reason.trim()) throw new Error("确认有效必须填写理由");
    if (state.status !== "stale" || version === null) throw new Error("只有待更新的采用版本可确认有效");
    assertRunnable(project.stages, stage);
    const artifact = this.readVersion(id, stage, version);
    this.validate(id, stage, artifact, currentBasis(project.stages, stage));
    const sources = ((project.provenance ??= {})[stage] ??= {});
    const previous = sources[version]?.based_on;
    sources[version] = { ...sources[version], based_on: currentBasis(project.stages, stage), ...(previous ? { original_based_on: sources[version]?.original_based_on ?? previous } : {}), validity_confirmation: { reason, at: new Date().toISOString() } };
    refreshStale(project.stages, project.provenance, stage);
    this.save(project);
    this.auditAction(id, "confirmed_valid", { stage, version, reason, previous, based_on: sources[version].based_on });
    return project;
  }

  bibleImpact(id: string) {
    const project = this.load(id), current = project.stages.bible.adopted_version;
    const adopted = project.stages.storyboard.adopted_version;
    const source = adopted === null ? undefined : project.provenance?.storyboard?.[adopted]?.based_on.bible;
    if (current === null || source === undefined) return { unknown: true, from: null, to: current, changes: [], shots: [], prompts: [] };
    const changes = compareBible(this.readVersion(id, "bible", source), this.readVersion(id, "bible", current));
    const ids = new Set(changes.map(c => c.id));
    const shots = this.readVersion(id, "storyboard", adopted!).shots.filter(s => [s.location_id, ...s.character_ids, ...s.prop_ids].some(i => ids.has(i))).map(s => s.shot_id);
    const pv = project.stages.prompts.adopted_version;
    const prompts = pv === null ? [] : this.readVersion(id, "prompts", pv).items.filter(i => i.injected_ids.some(id => ids.has(id))).map(i => i.shot_id);
    return { unknown: false, from: source, to: current, changes, shots, prompts };
  }

  reassembleReason(id: string): string | null {
    try { this.reassemblyInput(id); return null; }
    catch (error) {
      return error instanceof Error && !("code" in error) && !(error instanceof SyntaxError)
        ? error.message : "无法读取拼装来源，请检查本地项目文件。";
    }
  }

  private reassemblyInput(id: string) {
    const project = this.load(id), version = project.stages.prompts.adopted_version;
    assertRunnable(project.stages, "prompts");
    if (version === null || project.stages.prompts.status !== "stale") throw new Error("重新拼装需要待更新的采用提示词");
    const basis = project.provenance?.prompts?.[version]?.based_on;
    if (!basis?.bible || basis.storyboard !== project.stages.storyboard.adopted_version) throw new Error("来源未知或分镜版本变化，请重新运行提示词");
    const bible = this.readAdopted(id, "bible");
    const changes = compareBible(this.readVersion(id, "bible", basis.bible), bible);
    if (!changes.length || changes.some(c => c.fields.some(f => !["appearance", "description"].includes(f)))) throw new Error("仅固定描述（appearance/description）变化时可重新拼装");
    return { bible, board: this.readAdopted(id, "storyboard"), original: this.readVersion(id, "prompts", version) };
  }

  reassemblePrompts(id: string, confirmed = false) {
    if (!confirmed) throw new Error("重新拼装需要二次确认");
    const { bible, board, original } = this.reassemblyInput(id);
    const parts = new Map(original.items.map(i => [i.shot_id, i.shot_part]));
    const version = this.writeDraft(id, "prompts", { items: board.shots.map(s => assembleShotPrompt(s, bible, parts.get(s.shot_id)!)) }, "reassemble");
    this.auditAction(id, "reassemble", { stage: "prompts", version, model_calls: 0 });
    return version;
  }

  readStaging(id: string, stage: Stage) {
    parseStage(stage); return readOptional<Checkpoint>(join(this.projectDir(id), "staging", `${stage}.json`));
  }
  saveStaging(id: string, stage: Stage, snapshot: Checkpoint["snapshot"], basis = currentBasis(this.load(id).stages, stage)) {
    parseStage(stage); writeJson(join(this.projectDir(id), "staging", `${stage}.json`), { based_on: basis, snapshot });
  }
  assertStagingCurrent(id: string, stage: Stage, reviseFrom?: number) {
    const saved = this.readStaging(id, stage);
    if (!saved || saved.snapshot.finalized_version !== null) throw new Error("没有可继续的暂存");
    if (!sameBasis(saved.based_on, currentBasis(this.load(id).stages, stage))) throw new Error("暂存来源已变化，请重新开始");
    const source = (saved.snapshot.scene_changes ?? saved.snapshot.shot_changes)?.revise_from ?? null;
    if (source !== (reviseFrom ?? null)) throw new Error("暂存修改来源不同，请重新开始或选择原修改版本");
    return saved;
  }
  saveRunLock(id: string, run: RunInfo) { writeJson(join(this.projectDir(id), "run-lock.json"), { status: "running", ...run }); }
  finishRunLock(id: string) { writeJson(join(this.projectDir(id), "run-lock.json"), { status: "finished" }); }
  lastInterruptedRun(id: string) {
    const lock = readOptional<RunInfo & { status: string }>(join(this.projectDir(id), "run-lock.json"));
    return lock?.status === "interrupted" ? { ...lock, stop_reason: "interrupted", errors: [] as string[] } : null;
  }
  recoverInterruptedRuns() {
    for (const project of this.list()) {
      const file = join(this.projectDir(project.id), "run-lock.json"), lock = readOptional<RunInfo & { status: string }>(file);
      if (lock?.status !== "running") continue;
      writeJson(file, { ...lock, status: "interrupted" });
      this.auditAction(project.id, "interrupted", { stage: lock.stage, run_id: lock.id });
    }
  }

  saveRating(id: string, stage: Stage, version: number, input: unknown): Project {
    parseStage(stage);
    const project = this.load(id);
    if (!project.stages[stage].versions.includes(version)) throw new Error("评分版本不存在");
    const value = validateRating(stage, input);
    const rating = { ...value, at: new Date().toISOString(), actor: "local" as const, source: "human" as const };
    ((project.ratings ??= {})[stage] ??= {})[version] = rating;
    this.save(project);
    this.auditAction(id, "human_rating", { stage, version, rating });
    return project;
  }

  exportRatings(id: string) {
    const project = this.load(id);
    const rows = STAGES.flatMap(stage => Object.entries(project.ratings?.[stage] ?? {}).map(([version, rating]) => ({
      stage, version: Number(version), ...rating,
      review_status: reviewOf(project.stages[stage], Number(version)).status,
      adopted: project.stages[stage].adopted_version === Number(version),
      stage_status: project.stages[stage].status,
    })));
    const averages: Partial<Record<Dimension, number>> = {};
    for (const key of Object.keys(SCORE_LABELS) as Dimension[]) {
      const values = rows.flatMap(r => r.scores[key] === undefined ? [] : [r.scores[key]!]);
      if (values.length) averages[key] = values.reduce((a, b) => a + b, 0) / values.length;
    }
    return { project_id: id, rubric: "human-v1", notice: "人工评分仅供质量审阅，不作为结构签收门；均分覆盖全部已评分版本，非独立样本。", rows, averages };
  }

  sessionDir(id: string): string {
    this.load(id);
    const dir = join(this.projectDir(id), "sessions");
    mkdirSync(dir, { recursive: true });
    return dir;
  }
}
