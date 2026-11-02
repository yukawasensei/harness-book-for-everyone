import { validateSceneShots, storyboardWarnings, type SceneShots } from "../contracts/index.js";
import type { ProjectStore } from "../project/store.js";
import { SceneDraft } from "./scene-draft.js";

export class StoryboardDraft extends SceneDraft<SceneShots> {
  constructor(store: ProjectStore, projectId: string) {
    super(store, projectId, "storyboard", {
      validate: value => validateSceneShots(value, store.readAdopted(projectId, "script"), store.readAdopted(projectId, "bible")),
      seed: version => {
        const board = store.readVersion(projectId, "storyboard", version);
        return [...new Set(board.shots.map(shot => shot.scene_id))].map(scene_id => ({ scene_id, shots: board.shots.filter(shot => shot.scene_id === scene_id) }));
      },
      artifact: scenes => ({ shots: scenes.flatMap(scene => scene.shots) }),
      warnings: scenes => storyboardWarnings({ shots: scenes.flatMap(scene => scene.shots) }, store.readAdopted(projectId, "topic")),
    });
  }
}
