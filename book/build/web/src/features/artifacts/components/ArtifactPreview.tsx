import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Artifacts, SceneChanges, Stage } from "../../../../../src/contracts/index.js";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { PromptPreview } from "./PromptPreview";
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
}: {
  stage: Stage;
  value: unknown;
  bible?: Artifacts["bible"] | null;
  script?: Artifacts["script"] | null;
  revision?: SceneChanges;
}) {
  const changed = new Set(revision?.revise_from ? revision.resubmitted : []);
  const legend = revision?.revise_from ? (
    <p className="bg-primary/10 text-primary rounded-md px-2.5 py-1 text-xs">
      高亮：本版重交的场次；其余场沿用原稿。
    </p>
  ) : null;

  if (stage === "prompts") {
    return <PromptPreview value={value as Artifacts["prompts"]} revision={revision} footer={<ArtifactData value={value} />} />;
  }

  if (stage === "storyboard") {
    const board = value as Artifacts["storyboard"];
    const reference = (id: string) => {
      const entry = [...(bible?.characters ?? []), ...(bible?.props ?? []), ...(bible?.locations ?? [])].find(e => e.id === id);
      return entry ? `${entry.name}（${id}）` : id;
    };
    const heading = (scene: string) => adoptedScript?.scenes.find(e => e.scene_id === scene)?.heading
      ?? reference(board.shots.find(shot => shot.scene_id === scene)!.location_id);

    return (
      <div className={body}>
        {legend}
        {!bible && <p className="text-muted-foreground">设定集名称尚未加载，暂以编号显示引用。</p>}
        <p className="text-muted-foreground font-medium">共 {board.shots.length} 镜 · 合计 {board.shots.reduce((s, shot) => s + shot.duration_s, 0)} 秒</p>
        {[...new Set(board.shots.map(shot => shot.scene_id))].map(scene => (
          <section key={scene} aria-label={`${scene} 分镜`} className={changed.has(scene) ? "scene-revised" : undefined}>
            <div className={cn("space-y-2 rounded-lg border p-3", wrap, changed.has(scene) && "border-primary/40 bg-accent/20")}>
              <div className="flex items-start justify-between gap-2">
                <h3 className={cn("font-semibold text-sm text-foreground", wrap)}>{scene} · {heading(scene)}</h3>
                {changed.has(scene) && <Badge variant="secondary" className="shrink-0 text-[10px]">本版重交</Badge>}
              </div>
              <div className="grid gap-2">
                {board.shots.filter(shot => shot.scene_id === scene).map(shot => (
                  <article key={shot.shot_id} className={cn("rounded-md border border-border/80 bg-card p-2.5 space-y-1", wrap)}>
                    <header className="flex items-start justify-between gap-2 text-foreground">
                      <span className={cn("font-bold break-all", wrap)}>{shot.shot_id}</span>
                      <span className={cn("text-muted-foreground shrink-0", wrap)}>{shot.shot_size} · {shot.duration_s} 秒</span>
                    </header>
                    <p className={wrap}><span className="text-muted-foreground font-medium mr-1.5">机位</span>{shot.camera}</p>
                    <p className={wrap}><span className="text-muted-foreground font-medium mr-1.5">动作</span>{shot.action}</p>
                    {shot.dialogue && <p className={cn("text-primary", wrap)}><span className="text-muted-foreground font-medium mr-1.5">台词</span>{shot.dialogue}</p>}
                    <p className={cn("text-muted-foreground text-[11px]", wrap)}>场景：{reference(shot.location_id)} · 角色：{shot.character_ids.map(reference).join("、") || "无"} · 道具：{shot.prop_ids.map(reference).join("、") || "无"}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ))}
        <ArtifactData value={value} />
      </div>
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

  if (stage === "topic") {
    const topic = value as Artifacts["topic"];
    return (
      <>
        <pre className={cn("font-sans text-xs whitespace-pre-wrap", wrap)}>{`片名：${topic.title}\n\n一句话冲突：${topic.logline}\n\n类型：${topic.genre}\n受众：${topic.audience}\n目标时长：${topic.target_minutes} 分钟`}</pre>
        <ArtifactData value={value} />
      </>
    );
  }

  if (stage === "synopsis") {
    const syn = value as Artifacts["synopsis"];
    return (
      <>
        <pre className={cn("font-sans text-xs whitespace-pre-wrap", wrap)}>{`片名：${syn.title}\n\n一句话冲突：${syn.logline}\n\n${syn.beats.map((beat, i) => formatSynopsisBeat(beat, i)).join("\n\n")}\n\n基调：${syn.tone}`}</pre>
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
