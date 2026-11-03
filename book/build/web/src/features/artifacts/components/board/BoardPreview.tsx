import type { ReactNode } from "react";
import type { Artifacts, SceneChanges } from "../../../../../../src/contracts/index.js";
import { BoardStaleBanner } from "./BoardStaleBanner";
import { BoardToolbar } from "./BoardToolbar";
import { BoardSceneSection } from "./BoardSceneSection";

export function BoardPreview({
  board,
  bible,
  script,
  revision,
  isStale,
  projectId,
  version,
  onReassemble,
  reassembleDisabled,
  reassembleReason,
  onExport,
  footer,
}: {
  board: Artifacts["board"];
  bible?: Artifacts["bible"] | null;
  script?: Artifacts["script"] | null;
  revision?: SceneChanges;
  isStale?: boolean;
  projectId?: string;
  version?: number | null;
  onReassemble?: () => void;
  reassembleDisabled?: boolean;
  reassembleReason?: string | null;
  onExport?: () => void;
  footer?: ReactNode;
}) {
  const revisedScenes = new Set(revision?.revise_from ? revision.resubmitted : []);
  const sceneIds = [...new Set(board.shots.map(shot => shot.scene_id))];

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden text-xs break-words">
      {isStale && (
        <BoardStaleBanner
          onReassemble={onReassemble}
          disabled={reassembleDisabled}
          disabledReason={reassembleReason}
        />
      )}

      <BoardToolbar
        board={board}
        projectId={projectId}
        version={version}
        onExport={onExport}
        isRevised={Boolean(revision?.revise_from)}
      />

      {!bible && (
        <p className="text-xs text-muted-foreground">
          设定集名称尚未加载，暂以编号显示引用。
        </p>
      )}

      <div className="grid gap-4">
        {sceneIds.map(sceneId => {
          const sceneShots = board.shots.filter(shot => shot.scene_id === sceneId);
          return (
            <BoardSceneSection
              key={sceneId}
              sceneId={sceneId}
              shots={sceneShots}
              script={script}
              bible={bible}
              isRevised={revisedScenes.has(sceneId)}
            />
          );
        })}
      </div>

      {footer}
    </div>
  );
}
