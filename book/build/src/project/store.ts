import { PROJECT_FORMAT, ProjectFormatUnsupported, validateProjectFormat } from "./format.js";
import { assertId, containedPath, tenantRoot } from "./paths.js";
import { validateRating, SCORE_LABELS, type Ratings, type Dimension } from "./ratings.js";
import { assembleBoard, boardInput, validateBoard } from "../contracts/board.js";
import { randomUUID } from "node:crypto";
import { appendFileSync, closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { STAGES, parseStage, validateArtifact, validateBibleCoverage, validateVersionMetadata, type Artifacts, type Stage, type VersionMetadata } from "../contracts/index.js";
import { adoptDraft, assertAdopted, assertRunnable, initialWorkflow, recordDraft, reviewDraft, reviewOf, type Workflow } from "../workflow/index.js";
import { compareBible, currentBasis, refreshStale, sameBasis, type Basis, type Provenance, type Source } from "./provenance.js";
import { readOptional, writeJson, type Checkpoint } from "./checkpoints.js";
import type { RunInfo, TimelineItem } from "../server/protocol.js";

export interface Project {
  format_version: typeof PROJECT_FORMAT;
  id: string;
  title: string;
  stages: Workflow;
  version_metadata?: Partial<Record<Stage, Record<number, VersionMetadata>>>;
  provenance?: Provenance;
  ratings?: Ratings;
}

/** 单进程本地存储；支持业务暂存与残留运行恢复，不提供跨文件事务；hosted 实例固定一个租户。 */
export class ProjectStore {
  readonly root: string;
  constructor(private packageRoot: string, readonly userId?: string) {
    const projects = resolve(packageRoot, "projects");
    if (userId !== undefined) assertId(userId);
    this.root = userId === undefined ? projects : tenantRoot(packageRoot, userId);
  }

  private path(id: string, ...parts: string[]): string {
    assertId(id);
    if (this.userId !== undefined) tenantRoot(this.packageRoot, this.userId);
    return containedPath(this.root, id, ...parts);
  }

  projectDir(id: string): string {
    assertId(id);
    return this.path(id);
  }

  create(title: string): Project {
    if (!title.trim()) throw new Error("项目标题不能为空");
    const project: Project = { format_version: PROJECT_FORMAT, id: randomUUID(), title: title.trim(), stages: initialWorkflow() };
    mkdirSync(this.projectDir(project.id), { recursive: true });
    this.save(project);
    return project;
  }

  list(): Project[] {
    if (this.userId !== undefined) tenantRoot(this.packageRoot, this.userId);
    let entries;
    try { entries = readdirSync(this.root, { withFileTypes: true }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const projects: Project[] = [];
    for (const entry of entries) {
      if (this.userId !== undefined && ["quota.json", "quota.json.tmp", "quota-audit.jsonl"].includes(entry.name)) continue;
      try {
        if (!entry.isDirectory()) throw new Error("非项目目录");
        if (this.userId === undefined) {
          const directory = this.projectDir(entry.name);
          // local 与 hosted 共用 projects 根；用户分区不是损坏的本机项目。
          if (!existsSync(containedPath(directory, "project.json")) && (
            existsSync(containedPath(directory, "quota.json")) || readdirSync(directory, { withFileTypes: true }).some(child =>
              child.isDirectory() && existsSync(containedPath(directory, child.name, "project.json")))
          )) continue;
        }
        const project = this.load(entry.name); // 复用 ID 与 project.json 检查。
        if (project.id !== entry.name) throw new Error("项目 ID 与目录不一致");
        projects.push(project);
      } catch (error) {
        if (error instanceof ProjectFormatUnsupported) {
          console.warn(`跳过不兼容项目条目 ${JSON.stringify(entry.name)}：PROJECT_FORMAT_UNSUPPORTED`);
          continue;
        }
        // 不输出异常原文或文件内容；名称转义，保证每个跳过项仅记一行。
        console.warn(`跳过无效项目条目 ${JSON.stringify(entry.name)}：不是可读取的项目目录`);
      }
    }
    return projects;
  }

  load(id: string): Project {
    const file = this.path(id, "project.json");
    try {
      const project: unknown = JSON.parse(readFileSync(file, "utf8"));
      validateProjectFormat(project);
      if (project.id !== id) throw new Error("项目 ID 与目录不一致");
      // 同格式项目曾保存的设置不再影响策略，也不进入 DTO 或后续保存。
      Reflect.deleteProperty(project, "autopilot");
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
    const target = this.path(project.id, "project.json");
    const temp = this.path(project.id, "project.json.tmp");
    writeFileSync(temp, `${JSON.stringify(project, null, 2)}\n`, { mode: 0o600 });
    renameSync(temp, target);
  }

  readConversation(id: string): TimelineItem[] | null {
    this.load(id);
    try { return readFileSync(this.path(id, "conversation.jsonl"), "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line) as TimelineItem); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }

  appendConversation(id: string, items: TimelineItem[]): void {
    this.load(id);
    appendFileSync(this.path(id, "conversation.jsonl"), items.length ? items.map(item => JSON.stringify(item)).join("\n") + "\n" : "", { mode: 0o600 });
  }

  readAudit(id: string): Record<string, unknown>[] {
    this.load(id);
    try { return readFileSync(this.path(id, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }

  versionTimestamp(id: string, stage: Stage, version: number): string {
    return statSync(this.artifactPath(id, stage, version)).mtime.toISOString();
  }

  /** 从持久化记录计算；project.json 的 mtime 也覆盖新建与项目设置变动。 */
  updatedAt(id: string): string {
    const project = this.load(id);
    let latest = statSync(this.path(id, "project.json")).mtime.getTime();
    for (const file of ["conversation.jsonl", "audit.jsonl"]) {
      const at = this.lastLogTimestamp(id, file);
      if (at !== undefined && Number.isFinite(Date.parse(at))) latest = Math.max(latest, Date.parse(at));
    }
    for (const stage of STAGES) {
      for (const version of project.stages[stage].versions) {
        latest = Math.max(latest, Date.parse(this.versionTimestamp(id, stage, version)));
      }
    }
    return new Date(latest).toISOString();
  }

  /** 仅从尾部读取最后一条 JSONL，避免列表查询解析整段会话历史。 */
  private lastLogTimestamp(id: string, file: string): string | undefined {
    let fd: number;
    try { fd = openSync(this.path(id, file), "r"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
    try {
      let position = fstatSync(fd).size;
      let tail = Buffer.alloc(0);
      while (position > 0) {
        const chunk = Buffer.alloc(Math.min(position, 4096));
        position -= chunk.length;
        readSync(fd, chunk, 0, chunk.length, position);
        tail = Buffer.concat([chunk, tail]);
        const text = tail.toString("utf8").trimEnd();
        const newline = text.lastIndexOf("\n");
        if (newline >= 0 || position === 0) {
          return text ? (JSON.parse(text.slice(newline + 1)) as { at?: string }).at : undefined;
        }
      }
      return undefined;
    } finally { closeSync(fd); }
  }

  /** 只读租户项目内的会话，不接受来自 API 或日志内容的任意路径。 */
  readSessions(id: string): Record<string, unknown>[][] {
    this.load(id);
    let names: string[];
    try { names = readdirSync(this.path(id, "sessions")).filter(name => name.endsWith(".jsonl")).sort(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    return names.map(name => {
      const text = readFileSync(this.path(id, "sessions", name), "utf8");
      // SDK 正在追加的最后半行尚未成为记录，下次读取时补上。
      return text.slice(0, text.lastIndexOf("\n") + 1).split("\n").filter(Boolean).map(line => JSON.parse(line));
    });
  }

  artifactPath(id: string, stage: Stage, version: number): string {
    parseStage(stage);
    if (!Number.isSafeInteger(version) || version < 1) throw new Error("版本号必须为正整数");
    return this.path(id, "artifacts", stage, `v${version}.json`);
  }

  writeDraft<S extends Stage>(id: string, stage: S, artifact: unknown, generatedBy?: Source["generated_by"], reassembledFrom?: number): number {
    parseStage(stage);
    const project = this.load(id);
    assertRunnable(project.stages, stage);
    this.validate(id, stage, artifact); // 在创建目录或文件之前验收。
    const version = (project.stages[stage].versions.at(-1) ?? 0) + 1;
    const file = this.artifactPath(id, stage, version);
    mkdirSync(this.path(id, "artifacts", stage), { recursive: true });
    writeFileSync(file, `${JSON.stringify(artifact, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    recordDraft(project.stages, stage, version);
    const sources: Provenance = project.provenance ??= {};
    const stageSources: Record<number, Source> = sources[stage] ??= {};
    stageSources[version] = { based_on: currentBasis(project.stages, stage), ...(stage === "board" ? { assembly_template: (artifact as Artifacts["board"]).assembly_template } : {}), ...(generatedBy ? { generated_by: generatedBy, reassembled_from: reassembledFrom } : {}) };
    if (stage === "board") refreshStale(project.stages, sources, stage);
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
    if (stage === "board") refreshStale(project.stages, project.provenance ?? {}, stage);
    this.save(project);
    this.audit(project, stage, version);
    return project;
  }

  private audit(project: Project, stage: Stage, version: number): void {
    const { status, at, note } = reviewOf(project.stages[stage], version);
    appendFileSync(this.path(project.id, "audit.jsonl"),
      `${JSON.stringify({ actor: this.userId ?? "local", action: status, at, stage, version, ...(note === undefined ? {} : { note }) })}\n`, { mode: 0o600 });
  }

  revisionContext(id: string, stage: Stage, version: number): { original_json: string; note: string } {
    const project = this.load(id);
    assertRunnable(project.stages, stage);
    const review = reviewOf(project.stages[stage], version);
    if (review.status !== "changes_requested" || !review.note?.trim()) {
      throw new Error(`不能按意见修改 ${stage} v${version}：必须是有修改意见的 changes_requested 版本`);
    }
    const artifact = this.readVersion(id, stage, version);
    const original_json = stage === "board" ? JSON.stringify(boardInput(artifact as Artifacts["board"]), null, 2) : readFileSync(this.artifactPath(id, stage, version), "utf8");
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
    if (stage === "board") {
      validateArtifact(stage, artifact);
      if (!source || source.assembly_template !== (artifact as Artifacts["board"]).assembly_template) throw new Error("分镜板来源记录或拼装模板身份缺失/不一致");
    }
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
    if (stage === "board") { read("story"); validateBoard(artifact, read("script"), read("bible")); }
    if (stage === "bible") validateBibleCoverage(artifact as Artifacts["bible"], read("script"));
  }

  auditAction(id: string, action: string, details: Record<string, unknown>) {
    appendFileSync(this.path(id, "audit.jsonl"), JSON.stringify({ actor: this.userId ?? "local", action, at: new Date().toISOString(), ...details }) + "\n", { mode: 0o600 });
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
    const version = project.stages.board.versions.at(-1);
    const source = version === undefined ? undefined : project.provenance?.board?.[version]?.based_on.bible;
    if (current === null || source === undefined) return { unknown: true, from: null, to: current, changes: [], shots: [] };
    const changes = compareBible(this.readVersion(id, "bible", source), this.readVersion(id, "bible", current));
    const ids = new Set(changes.map(c => c.id));
    const shots = this.readVersion(id, "board", version!).shots.filter(s => [s.location_id, ...s.character_ids, ...s.prop_ids].some(i => ids.has(i))).map(s => s.shot_id);
    return { unknown: false, from: source, to: current, changes, shots };
  }

  reassembleReason(id: string): string | null {
    try { this.reassemblyInput(id); return null; }
    catch (error) {
      return error instanceof Error && !("code" in error) && !(error instanceof SyntaxError)
        ? error.message : "无法读取拼装来源，请检查本地项目文件。";
    }
  }

  private reassemblyInput(id: string) {
    const project = this.load(id), version = project.stages.board.versions.at(-1);
    assertRunnable(project.stages, "board");
    if (version === undefined || project.stages.board.status !== "stale") throw new Error("重新拼装需要待更新的最新分镜板");
    const source = project.provenance?.board?.[version];
    const basis = source?.original_based_on ?? source?.based_on;
    if (!basis?.bible || basis.script !== project.stages.script.adopted_version || basis.story !== project.stages.story.adopted_version) throw new Error("来源未知或故事/剧本版本变化，请重新运行分镜板");
    const original = this.readVersion(id, "board", version);
    const bible = this.readAdopted(id, "bible");
    const changes = compareBible(this.readVersion(id, "bible", basis.bible), bible);
    if (!changes.length || changes.some(c => c.fields.some(f => !["appearance", "description"].includes(f)))) throw new Error("仅固定描述（appearance/description）变化时可重新拼装");
    return { bible, original, version };
  }

  reassembleBoard(id: string, confirmed = false) {
    if (!confirmed) throw new Error("重新拼装需要二次确认");
    const { bible, original, version: sourceVersion } = this.reassemblyInput(id);
    const board = assembleBoard(boardInput(original), this.readAdopted(id, "script"), bible);
    const version = this.writeDraft(id, "board", board, "reassemble", sourceVersion);
    this.auditAction(id, "reassemble", { stage: "board", version, reassembled_from: sourceVersion, model_calls: 0 });
    return version;
  }

  readStaging(id: string, stage: Stage) {
    parseStage(stage); return readOptional<Checkpoint>(this.path(id, "staging", `${stage}.json`));
  }
  saveStaging(id: string, stage: Stage, snapshot: Checkpoint["snapshot"], basis = currentBasis(this.load(id).stages, stage)) {
    parseStage(stage); this.path(id, "staging", `${stage}.json.tmp`); writeJson(this.path(id, "staging", `${stage}.json`), { based_on: basis, snapshot });
  }
  assertStagingCurrent(id: string, stage: Stage, reviseFrom?: number) {
    const saved = this.readStaging(id, stage);
    if (!saved || saved.snapshot.finalized_version !== null) throw new Error("没有可继续的暂存");
    if (!sameBasis(saved.based_on, currentBasis(this.load(id).stages, stage))) throw new Error("暂存来源已变化，请重新开始");
    const source = saved.snapshot.scene_changes?.revise_from ?? null;
    if (source !== (reviseFrom ?? null)) throw new Error("暂存修改来源不同，请重新开始或选择原修改版本");
    return saved;
  }
  saveRunLock(id: string, run: RunInfo) { this.path(id, "run-lock.json.tmp"); writeJson(this.path(id, "run-lock.json"), { status: "running", ...run }); }
  finishRunLock(id: string) { this.path(id, "run-lock.json.tmp"); writeJson(this.path(id, "run-lock.json"), { status: "finished" }); }
  lastInterruptedRun(id: string) {
    const lock = readOptional<RunInfo & { status: string }>(this.path(id, "run-lock.json"));
    return lock?.status === "interrupted" ? { ...lock, stop_reason: "interrupted", errors: [] as string[] } : null;
  }
  recoverInterruptedRuns() {
    for (const project of this.list()) {
      const file = this.path(project.id, "run-lock.json"), lock = readOptional<RunInfo & { status: string }>(file);
      if (lock?.status !== "running") continue;
      this.path(project.id, "run-lock.json.tmp");
      writeJson(file, { ...lock, status: "interrupted" });
      this.auditAction(project.id, "interrupted", { stage: lock.stage, run_id: lock.id });
    }
  }

  saveRating(id: string, stage: Stage, version: number, input: unknown): Project {
    parseStage(stage);
    const project = this.load(id);
    if (!project.stages[stage].versions.includes(version)) throw new Error("评分版本不存在");
    const value = validateRating(stage, input);
    const rating = { ...value, at: new Date().toISOString(), actor: this.userId ?? "local", source: "human" as const };
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
    const dir = this.path(id, "sessions");
    mkdirSync(dir, { recursive: true });
    return dir;
  }
}
