import { assembleBoard, validateBoardSceneInput, storyboardWarnings, type BoardSceneInput } from "../contracts/index.js";
import { boardInput } from "../contracts/board.js";
import type { ProjectStore } from "../project/store.js";
import { SceneDraft } from "./scene-draft.js";

export class BoardDraft extends SceneDraft<BoardSceneInput> {
  constructor(store: ProjectStore, projectId: string) {
    super(store, projectId, "board", {
      validate: value => validateBoardSceneInput(value, store.readAdopted(projectId, "script"), store.readAdopted(projectId, "bible")),
      seed: version => {
        const { shots } = boardInput(store.readVersion(projectId, "board", version));
        return [...new Set(shots.map(shot => shot.scene_id))].map(scene_id => ({ scene_id, shots: shots.filter(shot => shot.scene_id === scene_id) }));
      },
      artifact: scenes => assembleBoard({ shots: scenes.flatMap(scene => scene.shots) }, store.readAdopted(projectId, "script"), store.readAdopted(projectId, "bible")),
      warnings: scenes => storyboardWarnings({ shots: scenes.flatMap(scene => scene.shots) }, store.readAdopted(projectId, "story")),
    });
  }
}
