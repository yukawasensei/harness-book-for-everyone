import type { Artifacts, BoardShot } from "../../../../../../src/contracts/index.js";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BoardShotCard } from "./BoardShotCard";

function formatSceneNumber(sceneId: string): string {
  const match = sceneId.match(/^S(\d+)$/);
  if (!match) return sceneId;
  return `第 ${parseInt(match[1], 10)} 场`;
}

export function BoardSceneSection({
  sceneId,
  shots,
  script,
  bible,
  isRevised,
}: {
  sceneId: string;
  shots: BoardShot[];
  script?: Artifacts["script"] | null;
  bible?: Artifacts["bible"] | null;
  isRevised?: boolean;
}) {
  const sceneScript = script?.scenes.find(s => s.scene_id === sceneId);
  const locationEntry = bible?.locations.find(l => l.id === shots[0]?.location_id);
  const headingText = sceneScript?.heading ?? (locationEntry ? locationEntry.name : shots[0]?.location_id ?? "");
  const totalDuration = shots.reduce((sum, shot) => sum + shot.duration_s, 0);

  return (
    <section
      aria-label={`${sceneId} 分镜`}
      className={cn(
        "space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3 sm:p-4 min-w-0 max-w-full overflow-hidden",
        isRevised && "scene-revised border-primary/40 bg-accent/10",
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-sm text-foreground break-words">
            {formatSceneNumber(sceneId)} · {headingText}
          </h3>
          <span className="font-mono text-xs text-muted-foreground shrink-0">{sceneId}</span>
          {isRevised && (
            <Badge variant="secondary" className="text-[10px] shrink-0">本场重交</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground shrink-0">
          共 {shots.length} 镜 · {totalDuration} 秒
        </div>
      </header>

      <div className="grid gap-3">
        {shots.map(shot => (
          <BoardShotCard
            key={shot.shot_id}
            shot={shot}
            bible={bible}
            isRevised={isRevised}
          />
        ))}
      </div>
    </section>
  );
}
