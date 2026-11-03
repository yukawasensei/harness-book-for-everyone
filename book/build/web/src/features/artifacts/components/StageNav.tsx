import type { Stage } from "../../../../../src/contracts/index.js";
import type { ProjectDetail, RunInfo } from "../../../../../src/server/protocol.js";
import { cn } from "@/lib/utils";
import { StatusHelp } from "./StatusHelp";
import { nextActionStage, stageBadge } from "../lib/presentation.js";

const stages: [Stage, string][] = [
  ["topic", "选题"],
  ["synopsis", "梗概"],
  ["script", "剧本"],
  ["bible", "设定集"],
  ["storyboard", "分镜脚本"],
  ["prompts", "分镜提示词"],
];

function statusDotClass(status: string | undefined, isRunning: boolean): string {
  if (isRunning) return "bg-primary animate-pulse";
  switch (status) {
    case "adopted":
      return "bg-success";
    case "pending_review":
      return "bg-primary";
    case "stale":
      return "bg-warning";
    case "ready":
      return "bg-foreground/40";
    default:
      return "bg-muted-foreground/30";
  }
}

export function StageNav({
  project,
  stage,
  running,
  runnableStages,
  onStageChange,
}: {
  project: ProjectDetail | null;
  stage: Stage;
  running: RunInfo | null | undefined;
  runnableStages: readonly Stage[];
  onStageChange: (stage: Stage) => void;
}) {
  const nextStage = project ? nextActionStage(project, runnableStages) : null;

  return (
    <nav className="border-border/60 border-b p-2" aria-label="六阶段导航">
      <div className="flex flex-col gap-0.5">
        {stages.map(([key, label], index) => {
          const status = project?.stages[key].status;
          const isCurrentRunning = running?.stage === key;
          const badge = stageBadge(status, key, running ?? null, runnableStages.includes(key));
          const isSelected = stage === key;
          const isNext = nextStage === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onStageChange(key)}
              aria-current={isSelected ? "step" : undefined}
              className={cn(
                "hover:bg-accent/70 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors",
                isSelected && "bg-accent font-medium text-accent-foreground shadow-xs",
                isNext && !isSelected && "ring-1 ring-primary/40",
              )}
            >
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  statusDotClass(status, isCurrentRunning),
                )}
                aria-hidden="true"
              />
              <span className="shrink-0">
                {index + 1}. {label}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-1">
                {isNext && (
                  <span className="bg-primary text-primary-foreground rounded px-1 text-[9px] font-semibold leading-tight">
                    下一步
                  </span>
                )}
                <StatusHelp text={badge.text} className={badge.className} />
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function allStagesAdopted(project: ProjectDetail): boolean {
  return stages.every(([key]) => project.stages[key].status === "adopted");
}
