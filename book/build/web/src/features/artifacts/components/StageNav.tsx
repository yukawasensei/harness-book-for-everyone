import type { Stage } from "../../../../../src/contracts/index.js";
import type { ProjectDetail, RunInfo } from "../../../../../src/server/protocol.js";
import { cn } from "@/lib/utils";
import { nextActionStage } from "../lib/presentation.js";
import {
  PROCESS_STAGES,
  processStatusLabel,
  progressChip,
} from "../lib/process-status.js";

export { PROCESS_STAGES, processStatusLabel, progressChip };

function statusTone(status: string): string {
  switch (status) {
    case "进行中":
      return "text-primary";
    case "待审阅":
      return "text-primary";
    case "已采用":
      return "text-success";
    case "待更新":
      return "text-warning";
    default:
      return "text-muted-foreground";
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
    <nav className="border-border/60 border-b p-2" aria-label="四阶段导航">
      <ol className="flex items-stretch gap-1">
        {PROCESS_STAGES.map(({ stage: key, label }, index) => {
          const statusLabel = processStatusLabel(
            project ? { stages: project.stages, running: running ?? project.running } : null,
            key,
          );
          const isSelected = stage === key;
          const isNext = nextStage === key;

          return (
            <li key={key} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onStageChange(key)}
                aria-current={isSelected ? "step" : undefined}
                className={cn(
                  "hover:bg-accent/70 flex h-full w-full flex-col items-start gap-0.5 rounded-md px-1.5 py-1.5 text-left transition-colors",
                  isSelected && "bg-accent font-medium text-accent-foreground shadow-xs",
                  isNext && !isSelected && "ring-1 ring-primary/40",
                )}
              >
                <span className="text-foreground w-full truncate text-xs leading-tight">
                  {index + 1}. {label}
                </span>
                <span className={cn("w-full truncate text-[10px] leading-tight", statusTone(statusLabel))}>
                  {statusLabel}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function allStagesAdopted(project: ProjectDetail): boolean {
  return PROCESS_STAGES.every(({ stage }) => project.stages[stage].status === "adopted");
}
