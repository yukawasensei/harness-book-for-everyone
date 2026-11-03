import type { Artifacts, BoardShot } from "../../../../../../src/contracts/index.js";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BoardPromptSection } from "./BoardPromptSection";

function formatShotTitle(shotId: string): string {
  const match = shotId.match(/^S(\d+)-(\d+)$/);
  if (!match) return shotId;
  const sceneNum = parseInt(match[1], 10);
  const shotNum = parseInt(match[2], 10);
  return `第 ${sceneNum} 场 · 第 ${shotNum} 镜`;
}

export function BoardShotCard({
  shot,
  bible,
  isRevised,
}: {
  shot: BoardShot;
  bible?: Artifacts["bible"] | null;
  isRevised?: boolean;
}) {
  const findEntry = (id: string) => {
    if (!bible) return null;
    return [...bible.locations, ...bible.characters, ...bible.props].find(e => e.id === id);
  };

  const renderRef = (id: string) => {
    const entry = findEntry(id);
    if (!entry) return <span key={id} className="font-mono text-[11px] text-muted-foreground">{id}</span>;
    return (
      <span key={id} className="inline-flex items-baseline gap-1 mr-2 last:mr-0">
        <span className="font-medium text-foreground">{entry.name}</span>
        <span className="font-mono text-[10px] text-muted-foreground">({id})</span>
      </span>
    );
  };

  return (
    <article
      aria-label={`${shot.shot_id} 镜头卡`}
      className={cn(
        "prompt-card rounded-lg border border-border/80 bg-card p-3.5 space-y-3 min-w-0 max-w-full overflow-hidden",
        isRevised && "scene-revised border-primary/40 bg-accent/15",
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="font-semibold text-sm text-foreground break-all">
            {formatShotTitle(shot.shot_id)}
          </h4>
          <span className="font-mono text-xs text-muted-foreground shrink-0">{shot.shot_id}</span>
          {isRevised && (
            <Badge variant="secondary" className="text-[10px] shrink-0">本版重交</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <Badge variant="outline" className="text-[11px] font-normal">{shot.shot_size}</Badge>
          <span>{shot.duration_s} 秒</span>
        </div>
      </header>

      <div className="grid gap-2 text-xs">
        <div className="space-y-0.5">
          <span className="text-[11px] font-medium text-muted-foreground">机位与运镜</span>
          <p className="text-foreground leading-relaxed whitespace-pre-wrap break-words">{shot.camera}</p>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] font-medium text-muted-foreground">动作与画面</span>
          <p className="text-foreground leading-relaxed whitespace-pre-wrap break-words">{shot.action}</p>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] font-medium text-muted-foreground">对白与声音</span>
          <p className={cn("leading-relaxed whitespace-pre-wrap break-words", shot.dialogue ? "text-foreground" : "text-muted-foreground")}>
            {shot.dialogue || "无"}
          </p>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] font-medium text-muted-foreground">出场角色与场景</span>
          <div className="flex flex-wrap items-center gap-y-1 text-xs">
            <span className="text-muted-foreground mr-1">场景：</span>
            {renderRef(shot.location_id)}
            <span className="text-muted-foreground mx-1.5">·</span>
            <span className="text-muted-foreground mr-1">角色：</span>
            {shot.character_ids.length ? shot.character_ids.map(renderRef) : <span className="text-muted-foreground">无</span>}
            {shot.prop_ids.length > 0 && (
              <>
                <span className="text-muted-foreground mx-1.5">·</span>
                <span className="text-muted-foreground mr-1">道具：</span>
                {shot.prop_ids.map(renderRef)}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 预留扩展位：画面预览（即将支持） / 配音试听（即将支持） */}

      <BoardPromptSection
        shotId={shot.shot_id}
        shotPart={shot.shot_part}
        finalPrompt={shot.final_prompt}
      />
    </article>
  );
}
