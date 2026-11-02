import type { ProjectStore } from "../project/store.js";
import { assertRunnable } from "../workflow/index.js";

/** 每次运行独立的暂存区；会话事件及结束快照负责审计，不是可采用版本。 */
export class SceneDraft<T extends { scene_id: string }> {
  private scenes = new Map<string, T>();
  private version: number | null = null;
  private warnings: string[] = [];
  private sourceVersion: number | null = null;
  private sourceIds = new Set<string>();
  private submitted = new Set<string>();
  private removed = new Set<string>();

  constructor(private store: ProjectStore, private projectId: string, private stage: "script" | "storyboard", private config: {
    validate: (value: unknown) => void;
    seed: (version: number) => T[];
    artifact: (scenes: T[]) => unknown;
    warnings: (scenes: T[]) => string[];
  }) {}

  reset(seedVersion?: number) {
    const seed = seedVersion === undefined ? [] : this.config.seed(seedVersion);
    this.scenes = new Map(seed.map(scene => [scene.scene_id, structuredClone(scene)]));
    this.sourceVersion = seedVersion ?? null;
    this.sourceIds = new Set(this.scenes.keys());
    this.submitted.clear(); this.removed.clear();
    this.version = null; this.warnings = [];
  }

  changes() {
    return {
      revise_from: this.sourceVersion,
      resubmitted: [...this.submitted].filter(id => this.scenes.has(id)).sort(),
      reused: [...this.sourceIds].filter(id => this.scenes.has(id) && !this.submitted.has(id)).sort(),
      removed: [...this.removed].sort(),
    };
  }

  private assertOpen() {
    assertRunnable(this.store.load(this.projectId).stages, this.stage);
    if (this.version !== null) throw new Error(`本次${this.stage === "script" ? "剧本" : "分镜"}已生成 v${this.version}，不能重复 finalize 或继续写场`);
  }

  write(value: unknown) {
    this.assertOpen();
    this.config.validate(value);
    const scene = value as T;
    this.scenes.set(scene.scene_id, structuredClone(scene));
    this.submitted.add(scene.scene_id);
    this.removed.delete(scene.scene_id);
    return { scene_id: scene.scene_id, scene_count: this.scenes.size, status: "in_progress" };
  }

  remove(sceneId: unknown) {
    this.assertOpen();
    if (typeof sceneId !== "string" || !/^S[0-9]{2}$/.test(sceneId)) throw new Error("scene_id 不合规：必须为 S 加两位数字");
    if (!this.scenes.delete(sceneId)) throw new Error(`进行中草稿不存在 ${sceneId}，不能删除`);
    this.removed.add(sceneId);
    return { scene_id: sceneId, scene_count: this.scenes.size, status: "in_progress" };
  }

  finalize() {
    this.assertOpen();
    const scenes = this.snapshot().scenes;
    const warnings = this.config.warnings(scenes);
    // writeDraft 在写文件前复核完整 schema 及本阶段业务规则。
    const version = this.store.writeDraft(this.projectId, this.stage, this.config.artifact(scenes));
    this.version = version;
    this.warnings = warnings;
    return { stage: this.stage, version, status: "pending_review", warnings: this.warnings, scene_changes: this.changes() };
  }

  snapshot() {
    return { scenes: structuredClone([...this.scenes.values()].sort((a, b) => a.scene_id.localeCompare(b.scene_id))), finalized_version: this.version, warnings: [...this.warnings], scene_changes: this.changes() };
  }
}
