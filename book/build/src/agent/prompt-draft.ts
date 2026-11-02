import { Value } from "typebox/value";
import { ShotPromptInputSchema, type ShotPromptInput } from "../contracts/index.js";
import { assembleShotPrompt, validateShotPart } from "../contracts/prompts.js";
import type { ProjectStore } from "../project/store.js";
import { assertRunnable } from "../workflow/index.js";
import { currentBasis, sameBasis, type Basis } from "../project/provenance.js";
import type { ResumeChoice } from "../project/checkpoints.js";

/** 一镜一条；同镜重交替换，沿用稿仅预装模型负责的字段。 */
export class PromptDraft {
  private items = new Map<string, ShotPromptInput>();
  private sourceVersion: number | null = null;
  private sourceIds = new Set<string>();
  private submitted = new Set<string>();
  private version: number | null = null;
  private basis: Basis = {};
  constructor(private store: ProjectStore, private projectId: string) {}

  reset(seedVersion?: number, choice: ResumeChoice = "restart") {
    const saved = choice === "resume" ? this.store.assertStagingCurrent(this.projectId, "prompts", seedVersion) : null;
    const seed = seedVersion === undefined ? [] : this.store.readVersion(this.projectId, "prompts", seedVersion).items;
    this.items = new Map((saved?.snapshot.items ?? seed).map(({ shot_id, shot_part }) => [shot_id, { shot_id, shot_part }]));
    this.sourceVersion = seedVersion ?? null;
    this.sourceIds = new Set(this.items.keys()); this.submitted.clear(); this.version = null;
    if (saved?.snapshot.shot_changes) {
      this.submitted = new Set(saved.snapshot.shot_changes.resubmitted);
      this.sourceIds = new Set(saved.snapshot.shot_changes.reused);
    }
    this.basis = currentBasis(this.store.load(this.projectId).stages, "prompts"); this.persist();
  }

  private persist() { this.store.saveStaging(this.projectId, "prompts", this.snapshot(), this.basis); }

  changes() {
    return { revise_from: this.sourceVersion, resubmitted: [...this.submitted].sort(),
      reused: [...this.sourceIds].filter(id => !this.submitted.has(id)).sort(), removed: [] as string[] };
  }

  private assertOpen() {
    assertRunnable(this.store.load(this.projectId).stages, "prompts");
    if (Object.keys(this.basis).length && !sameBasis(this.basis, currentBasis(this.store.load(this.projectId).stages, "prompts"))) throw new Error("暂存来源已变化，请重新开始");
    if (this.version !== null) throw new Error(`本次提示词已生成 v${this.version}，不能继续写镜头或重复汇总`);
  }

  write(value: unknown) {
    this.assertOpen();
    const errors = Value.Errors(ShotPromptInputSchema, value);
    if (errors.length) throw new Error(`prompts schema 不合规：${errors.map(e => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
    const item = value as ShotPromptInput;
    const shot = this.store.readAdopted(this.projectId, "storyboard").shots.find(shot => shot.shot_id === item.shot_id);
    if (!shot) throw new Error(`镜头 ${item.shot_id} 不存在于采用分镜；请先 list_shots 并使用已有镜号`);
    validateShotPart(shot, this.store.readAdopted(this.projectId, "bible"), item.shot_part);
    this.items.set(item.shot_id, structuredClone(item)); this.submitted.add(item.shot_id);
    if (!Object.keys(this.basis).length) this.basis = currentBasis(this.store.load(this.projectId).stages, "prompts");
    this.persist();
    return { shot_id: item.shot_id, shot_count: this.items.size, status: "in_progress" };
  }

  finalize() {
    this.assertOpen();
    const board = this.store.readAdopted(this.projectId, "storyboard"), bible = this.store.readAdopted(this.projectId, "bible");
    const missing = board.shots.filter(shot => !this.items.has(shot.shot_id)).map(shot => shot.shot_id);
    if (missing.length) throw new Error(`提示词未覆盖全部镜头，缺少 ${missing.join("、")}；请补交后汇总`);
    const items = board.shots.map(shot => assembleShotPrompt(shot, bible, this.items.get(shot.shot_id)!.shot_part));
    this.version = this.store.writeDraft(this.projectId, "prompts", { items });
    this.persist();
    return { stage: "prompts", version: this.version, status: "pending_review", shot_changes: this.changes() };
  }

  snapshot() {
    return { items: structuredClone([...this.items.values()]), finalized_version: this.version, shot_changes: this.changes() };
  }
}
