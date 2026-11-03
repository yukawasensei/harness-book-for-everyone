import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Stage } from "../../../../../src/contracts/index.js";
import type { ProjectDetail } from "../../../../../src/server/protocol.js";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function BibleImpactNotice({ project, stage }: { project: ProjectDetail; stage: Stage }) {
  const impact = project.bible_impact;
  const hasImpact = Boolean(impact && (stage === "bible" || stage === "storyboard" || stage === "prompts"));
  const [open, setOpen] = useState(() => Boolean(impact && impact.changes.length > 0));
  if (!hasImpact || !impact) return null;

  const fieldLabels: Record<string, string> = {
    appearance: "外观",
    description: "固定描述",
    added: "新增",
    removed: "移除",
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border border-border/80 p-2.5 text-xs">
      <CollapsibleTrigger className="hover:text-primary flex w-full items-center justify-between font-medium">
        <span>设定影响分析（设定集 v{impact.from} → v{impact.to}）</span>
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="mt-2 space-y-1.5 text-muted-foreground pt-1 border-t border-border/60">
        {impact.unknown ? (
          <p>未知来源，无法可靠比较；请人工检查。</p>
        ) : impact.changes.length > 0 ? (
          <>
            <ul className="list-disc pl-4 space-y-0.5">
              {impact.changes.map(c => (
                <li key={c.id}>
                  {c.name}（{c.id}）：{c.fields.map(f => fieldLabels[f] ?? f).join("、")}
                </li>
              ))}
            </ul>
            <p>受影响镜头：{impact.shots.join("、") || "无"}</p>
            <p>受影响提示词：{impact.prompts.join("、") || "无"}</p>
          </>
        ) : (
          <p>没有设定条目变化。</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
