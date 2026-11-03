import type { ProjectDetail, RunInfo, RunResult } from "../../../../../src/server/protocol.js";
import type { Stage } from "../../../../../src/contracts/index.js";
import { formatLocalDateTime } from "@/lib/format/date-time.js";
import { cn } from "@/lib/utils";
import { TechnicalDetails } from "@/components/common/TechnicalDetails";
import { ErrorDetails } from "./ErrorDetails";
import { stageNames, type LiveRow, currentRunDisplay, scriptProgress } from "../lib/presentation.js";

function formatRunUsageLine(durationMs: number, usage?: { totalTokens: number; cost: { total: number } }) {
  const seconds = (durationMs / 1000).toFixed(1);
  const tokens = usage == null ? "用量暂无数据" : `用量约 ${usage.totalTokens} 个词元`;
  const cost = usage == null
    ? "估算费用暂无数据"
    : `估算费用约 ${usage.cost.total} 美元（按配置的价格估算，不是实际账单）`;
  return `本阶段耗时 ${seconds} 秒 · ${tokens} · ${cost}`;
}

export function RunSummaryCard({
  project, stage, running, implemented, rows,
}: {
  project: ProjectDetail | null;
  stage: Stage;
  running: RunInfo | null | undefined;
  implemented: boolean;
  rows: LiveRow[];
}) {
  const state = project?.stages[stage];
  const summary = running || (implemented && state?.status !== "adopted" && project?.last_run?.stage === stage)
    ? currentRunDisplay(running, project?.last_run) : null;
  const displayRun: RunInfo | RunResult | null | undefined = running ?? project?.last_run;
  const progress = scriptProgress(running, rows);
  if (!summary) return null;
  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm", summary.failed && "border-destructive/40")}>
      <p>{running ? "当前运行" : "最近运行"}：{stageNames[summary.stage]} · {summary.text}{progress ? ` · ${progress}` : ""}</p>
      {displayRun && <p className="text-muted-foreground text-xs">运行开始：<time dateTime={displayRun.started_at}>{formatLocalDateTime(displayRun.started_at)}</time></p>}
      {summary.stopReason && <TechnicalDetails><p>运行标记：<code>stop_reason={summary.stopReason}</code></p></TechnicalDetails>}
      {project?.last_run && !running && project.last_run.duration_ms !== undefined && (
        <p className="text-muted-foreground text-xs">
          {formatRunUsageLine(project.last_run.duration_ms, project.last_run.usage)}
        </p>
      )}
      <ErrorDetails errors={summary.errors} />
    </div>
  );
}
