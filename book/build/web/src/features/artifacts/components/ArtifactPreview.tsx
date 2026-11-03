import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Artifacts, SceneChanges, Stage } from "../../../../../src/contracts/index.js";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { BoardPreview } from "./board";
import { BibleRoleContext } from "./BibleRoleContext";

const wrap = "min-w-0 max-w-full break-words break-all";
const body = cn("space-y-4 text-xs", wrap);
const BEAT_LABELS = ["起", "承", "转", "合"] as const;

/** 数据已带「起：」等前缀时不再重复添加。 */
export function formatSynopsisBeat(beat: string, index: number): string {
  const label = BEAT_LABELS[index];
  if (!label) return beat;
  if (beat.startsWith(`${label}：`) || beat.startsWith(`${label}:`)) return beat;
  return `${label}：${beat}`;
}

export function ArtifactPreview({
  stage,
  value,
  bible,
  script: adoptedScript,
  revision,
  projectId,
  version,
  isStale,
  onReassemble,
  reassembleDisabled,
  reassembleReason,
  onExport,
}: {
  stage: Stage;
  value: unknown;
  bible?: Artifacts["bible"] | null;
  script?: Artifacts["script"] | null;
  revision?: SceneChanges;
  projectId?: string;
  version?: number | null;
  isStale?: boolean;
  onReassemble?: () => void;
  reassembleDisabled?: boolean;
  reassembleReason?: string | null;
  onExport?: () => void;
}) {
  const changed = new Set(revision?.revise_from ? revision.resubmitted : []);
  const legend = revision?.revise_from ? (
    <p className="bg-primary/10 text-primary rounded-md px-2.5 py-1 text-xs">
      高亮：本版重交的场次；其余场沿用原稿。
    </p>
  ) : null;

  if (stage === "board") {
    return (
      <BoardPreview
        board={value as Artifacts["board"]}
        bible={bible}
        script={adoptedScript}
        revision={revision}
        isStale={isStale}
        projectId={projectId}
        version={version}
        onReassemble={onReassemble}
        reassembleDisabled={reassembleDisabled}
        reassembleReason={reassembleReason}
        onExport={onExport}
        footer={<ArtifactData value={value} />}
      />
    );
  }

  if (stage === "bible") {
    const b = value as Artifacts["bible"];
    const groups = [["characters", "角色"], ["props", "道具"], ["locations", "场景"]] as const;
    return (
      <div className={body}>
        {groups.map(([group, label]) => (
          <section key={group} className="space-y-2" aria-label={label}>
            <h3 className="font-semibold text-sm text-foreground">{label} ({b[group].length})</h3>
            {!b[group].length && <p className="text-muted-foreground">无关键{label}</p>}
            <div className="grid gap-2">
              {b[group].map(entry => (
                <article key={entry.id} className="setting-card">
                  <div className={cn("rounded-md border border-border/80 bg-card p-2.5 space-y-1", wrap)}>
                    <header className="flex items-start justify-between gap-2">
                      <span className={cn("font-bold text-foreground", wrap)}>{entry.name}</span>
                      <span className="text-muted-foreground text-[11px] font-mono break-all shrink-0">{entry.id}</span>
                    </header>
                    {"aliases" in entry && entry.aliases?.length ? <p className={cn("text-muted-foreground text-[11px]", wrap)}>别名：{entry.aliases.join("、")}</p> : null}
                    <p className={wrap}><span className="text-muted-foreground font-medium mr-1.5">固定描述</span>{"appearance" in entry ? entry.appearance : entry.description}</p>
                    <p className={cn("text-muted-foreground text-[11px]", wrap)}>出场场次：{entry.appears_in.join("、")}</p>
                    {"role" in entry && <BibleRoleContext role={entry.role} personality={entry.personality} />}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
        <p className="text-muted-foreground text-[11px]">覆盖检查与固定描述粗筛通过仍需人工审阅：请核对人物、关键道具、场景及视觉细节。</p>
        <ArtifactData value={value} />
      </div>
    );
  }

  if (stage === "story") {
    const story = value as Artifacts["story"];
    return (
      <>
        <pre className={cn("font-sans text-xs whitespace-pre-wrap", wrap)}>{`片名：${story.title}\n\n一句话冲突：${story.logline}\n\n类型：${story.genre}\n受众：${story.audience}\n目标时长：${story.target_minutes} 分钟\n\n${story.beats.map((beat, i) => formatSynopsisBeat(beat, i)).join("\n\n")}\n\n基调：${story.tone}`}</pre>
        <ArtifactData value={value} />
      </>
    );
  }

  const script = value as Artifacts["script"];
  return (
    <div className={cn("space-y-3 text-xs", wrap)}>
      {legend}
      {script.scenes.map(scene => (
        <article
          key={scene.scene_id}
          className={changed.has(scene.scene_id) ? "scene-card scene-revised" : "scene-card"}
        >
          <header>
            <h3>{scene.scene_id} · {scene.heading}</h3>
            {changed.has(scene.scene_id) && <Badge variant="secondary" className="text-[10px]">本版重交</Badge>}
          </header>
          <div className={cn("rounded-lg border border-border/80 bg-card p-3 space-y-2", wrap, changed.has(scene.scene_id) && "border-primary/40 bg-accent/20")}>
            <p className={cn("text-muted-foreground whitespace-pre-wrap", wrap)}>{scene.summary}</p>
            <div className="space-y-1 border-t border-border/60 pt-2">
              {scene.lines.map((line, idx) => (
                <div key={idx} className={cn("leading-relaxed", wrap)}>
                  {line.kind === "dialogue" ? (
                    <p className={wrap}><span className="font-semibold text-foreground">{line.character}：</span><span className="text-foreground">{line.text}</span></p>
                  ) : (
                    <p className={cn("text-muted-foreground", wrap)}><span className="bg-muted text-muted-foreground rounded px-1 text-[10px] mr-1.5 font-medium">动作</span>{line.text}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </article>
      ))}
      <ArtifactData value={value} />
    </div>
  );
}

function ArtifactData({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("mt-2", wrap)}>
      <CollapsibleTrigger className="hover:text-primary flex items-center gap-1 text-xs font-medium">
        <span>查看原始 JSON</span>
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className={cn("bg-muted/40 mt-1.5 rounded-md p-2 font-mono text-[11px] whitespace-pre-wrap break-all", wrap)}>
          {JSON.stringify(value, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
