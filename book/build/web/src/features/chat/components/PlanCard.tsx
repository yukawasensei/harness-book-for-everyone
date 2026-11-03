import { useState } from "react";
import { CheckCircle2, CircleDot, Circle, AlertTriangle, ChevronDown, ChevronUp, Layers } from "lucide-react";
import type { Stage } from "../../../../../src/contracts/index.js";
import type { ProjectDetail } from "../../../../../src/server/protocol.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STAGE_ORDER: { stage: Stage; label: string }[] = [
  { stage: "topic", label: "选题" },
  { stage: "synopsis", label: "梗概" },
  { stage: "script", label: "剧本" },
  { stage: "bible", label: "设定集" },
  { stage: "storyboard", label: "分镜脚本" },
  { stage: "prompts", label: "分镜提示词" },
];

type PlanStatus = "adopted" | "active" | "stale" | "pending";

function getStagePlan(project: Pick<ProjectDetail, "stages" | "running">, stage: Stage): {
  status: PlanStatus;
  statusLabel: string;
} {
  if (project.running?.stage === stage) {
    return { status: "active", statusLabel: "进行中" };
  }
  const state = project.stages[stage];
  if (!state) return { status: "pending", statusLabel: "未开始" };
  if (state.status === "adopted") return { status: "adopted", statusLabel: "已采用" };
  if (state.status === "pending_review") return { status: "active", statusLabel: "待审阅" };
  if (state.status === "stale") return { status: "stale", statusLabel: "待更新" };
  return { status: "pending", statusLabel: "未开始" };
}

function StatusIcon({ status }: { status: PlanStatus }) {
  switch (status) {
    case "adopted":
      return <CheckCircle2 className="size-4 shrink-0 text-success" />;
    case "active":
      return <CircleDot className="size-4 shrink-0 text-primary animate-pulse" />;
    case "stale":
      return <AlertTriangle className="size-4 shrink-0 text-warning" />;
    case "pending":
      return <Circle className="size-4 shrink-0 text-muted-foreground/60" />;
  }
}

export function PlanCard({
  project,
  className,
}: {
  project?: Pick<ProjectDetail, "stages" | "running"> | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!project) return null;

  const items = STAGE_ORDER.map(item => ({
    ...item,
    ...getStagePlan(project, item.stage),
  }));
  const adoptedCount = items.filter(i => i.status === "adopted").length;
  const activeItem = items.find(i => i.status === "active" || i.status === "stale");

  return (
    <Card className={cn("border-border/80 bg-card/90 py-0 shadow-xs backdrop-blur-xs", className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Layers className="size-4 text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground">制作计划</span>
              <Badge variant="outline" className="px-1.5 py-0 text-[11px] font-normal">
                {adoptedCount}/6
              </Badge>
              {activeItem && (
                <span className="text-muted-foreground hidden truncate text-xs sm:inline">
                  当前：{activeItem.label} · {activeItem.statusLabel}
                </span>
              )}
            </div>
            <div className="text-muted-foreground flex items-center gap-1 text-xs">
              <span>{open ? "收起" : "展开"}</span>
              {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-border/60 border-t px-3.5 py-3">
            {/* 纵向清单：窄栏/宽屏均完整显示工序名，避免六列截断 */}
            <ul className="flex flex-col gap-1.5">
              {items.map(item => (
                <li
                  key={item.stage}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-border/50 bg-background/50 px-2.5 py-1.5 text-xs",
                    item.status === "active" && "border-primary/40 bg-primary/5",
                    item.status === "stale" && "border-warning/40 bg-warning/5",
                  )}
                >
                  <StatusIcon status={item.status} />
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">{item.statusLabel}</span>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
