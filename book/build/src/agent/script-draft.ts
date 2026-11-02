import { validateScene, type Scene } from "../contracts/index.js";
import type { ProjectStore } from "../project/store.js";
import { assertRunnable } from "../workflow/index.js";

/** 每次运行独立的暂存区；会话事件及结束快照负责审计，不是可采用版本。 */
export class ScriptDraft {
  private scenes = new Map<string, Scene>();
  private version: number | null = null;
  private warnings: string[] = [];
  private sourceVersion: number | null = null;
  private sourceIds = new Set<string>();
  private submitted = new Set<string>();
  private removed = new Set<string>();

  constructor(private store: ProjectStore, private projectId: string) {}

  reset(seedVersion?: number) {
    const seed = seedVersion === undefined ? [] : this.store.readVersion(this.projectId, "script", seedVersion).scenes;
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
    assertRunnable(this.store.load(this.projectId).stages, "script");
    if (this.version !== null) throw new Error(`本次剧本已生成 v${this.version}，不能重复 finalize 或继续写场`);
  }

  write(value: unknown) {
    this.assertOpen();
    validateScene(value);
    this.scenes.set(value.scene_id, structuredClone(value));
    this.submitted.add(value.scene_id);
    this.removed.delete(value.scene_id);
    return { scene_id: value.scene_id, scene_count: this.scenes.size, status: "in_progress" };
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
    const beats = this.store.readAdopted(this.projectId, "synopsis").beats;
    // writeDraft 在写文件前复核完整 schema 与连续编号。
    const version = this.store.writeDraft(this.projectId, "script", { scenes });
    this.version = version;
    this.warnings = scenes.length === beats.length ? [] : [
      `警告：剧本 ${scenes.length} 场，梗概 ${beats.length} 拍；叙事拍与场景不必一一对应，请人工检查是否覆盖故事转折。`,
    ];
    return { stage: "script", version, status: "pending_review", warnings: this.warnings, scene_changes: this.changes() };
  }

  snapshot() {
    return { scenes: structuredClone([...this.scenes.values()].sort((a, b) => a.scene_id.localeCompare(b.scene_id))), finalized_version: this.version, warnings: [...this.warnings], scene_changes: this.changes() };
  }
}
