import { validateScene, type Scene } from "../contracts/index.js";
import type { ProjectStore } from "../project/store.js";
import { SceneDraft } from "./scene-draft.js";

export class ScriptDraft extends SceneDraft<Scene> {
  constructor(store: ProjectStore, projectId: string) {
    super(store, projectId, "script", {
      validate: validateScene,
      seed: version => store.readVersion(projectId, "script", version).scenes,
      artifact: scenes => ({ scenes }),
      warnings: scenes => {
        const beats = store.readAdopted(projectId, "synopsis").beats;
        return scenes.length === beats.length ? [] : [
          `警告：剧本 ${scenes.length} 场，梗概 ${beats.length} 拍；叙事拍与场景不必一一对应，请人工检查是否覆盖故事转折。`,
        ];
      },
    });
  }
}
