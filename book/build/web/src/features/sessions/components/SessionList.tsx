import { Plus } from "lucide-react";
import type { ProjectDetail } from "../../../../../src/server/protocol.js";
import type { Stage } from "../../../../../src/contracts/index.js";
import { stageNames } from "@/features/artifacts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STAGE_ORDER: Stage[] = ["story", "script", "bible", "board"];

function progressLabel(project: ProjectDetail): string {
  if (project.running) return `${stageNames[project.running.stage]} · 运行中`;
  for (const stage of STAGE_ORDER) {
    const status = project.stages[stage].status;
    if (status === "pending_review") return `${stageNames[stage]} · 待审阅`;
    if (status === "stale") return `${stageNames[stage]} · 待更新`;
    if (status === "ready") return `${stageNames[stage]} · 可运行`;
  }
  if (STAGE_ORDER.every(stage => project.stages[stage].status === "adopted")) {
    return "全流程已完成";
  }
  return "新任务";
}

function projectActivityTime(project: ProjectDetail): number {
  return new Date(project.updated_at).getTime();
}

export function SessionList({
  projects,
  selectedId,
  onSelect,
  onCreate,
  creating,
}: {
  projects: ProjectDetail[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  creating?: boolean;
}) {
  const sorted = [...projects].sort((a, b) => {
    const diff = projectActivityTime(b) - projectActivityTime(a);
    if (diff !== 0) return diff;
    return projects.indexOf(b) - projects.indexOf(a);
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border/80 flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">会话</h2>
        <Button size="sm" onClick={onCreate} disabled={creating} className="h-8 gap-1 text-xs">
          <Plus className="size-3.5" /> 新任务
        </Button>
      </div>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2" aria-label="项目列表">
        {!sorted.length && (
          <li className="text-muted-foreground px-2 py-4 text-center text-xs">尚无会话</li>
        )}
        {sorted.map(project => {
          const isSelected = selectedId === project.id;
          return (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => onSelect(project.id)}
                className={cn(
                  "hover:bg-accent/60 w-full rounded-md px-3 py-2 text-left transition-colors",
                  isSelected && "bg-accent text-accent-foreground font-medium shadow-xs",
                )}
              >
                <div className="truncate text-xs sm:text-sm font-medium">
                  {project.title || "未命名任务"}
                </div>
                <div className="text-muted-foreground truncate text-[11px] mt-0.5">
                  {progressLabel(project)}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
