import { useState } from "react";
import type { Stage } from "../../../../../src/contracts/index.js";
import type { ProjectDetail, ServerConfig } from "../../../../../src/server/protocol.js";
import { api } from "@/lib/api";
import { ArtifactPreview } from "./ArtifactPreview";
import { ReviewPanel } from "./ReviewPanel";
import { RatingDialog } from "./RatingDialog";
import { MoreActionsMenu } from "./MoreActionsMenu";
import { ArtifactStaleNotice } from "./ArtifactStaleNotice";
import { BibleImpactNotice, ReworkDialog, type ReworkOperation } from "./ReworkPanel";
import { StageNav, allStagesAdopted } from "./StageNav";
import { VersionPicker } from "./VersionPicker";
import { RunSummaryCard } from "./RunSummaryCard";
import { ExpandedPreview } from "./ExpandedPreview";
import { useArtifactPreview } from "../hooks/use-artifact-preview";
import { artifactGuidance, readerMessage, stageNames, type LiveRow } from "../lib/presentation.js";

export function ArtifactPanel({
  id, project, config, stage, onStageChange, version, onVersionChange,
  rows, runningBusy, submitting, error, demo, onAction, onExecuteRun,
}: {
  id: string;
  project: ProjectDetail | null;
  config: ServerConfig;
  stage: Stage;
  onStageChange: (stage: Stage) => void;
  version: number | null;
  onVersionChange: (version: number | null) => void;
  rows: LiveRow[];
  runningBusy: boolean;
  submitting: boolean;
  error: string;
  demo: boolean;
  onAction: (operation: () => Promise<void>) => Promise<boolean>;
  onExecuteRun: (reviseFrom?: number, staging?: "resume" | "restart", confirmed?: boolean) => Promise<boolean>;
}) {
  const preview = useArtifactPreview(id, project, stage, version, onVersionChange);
  const [ratingOpen, setRatingOpen] = useState(false);
  const state = project?.stages[stage];
  const running = project?.running;
  const implemented = config.runnable_stages.includes(stage);
  const rawReason = project?.run_blocked_reasons[stage];
  const blockedReason = !implemented ? `${stageNames[stage]}暂未开放运行。` : rawReason ? readerMessage(rawReason) : null;
  const guidance = artifactGuidance(stage, implemented, state?.adopted_version);
  const revision = version === null ? undefined : project?.version_metadata?.[stage]?.[version]?.revision;
  const busy = runningBusy || submitting;

  function openConfirm(operation: ReworkOperation, reviseFrom?: number) {
    preview.setConfirm({ operation, reviseFrom });
  }

  function requestRun(reviseFrom?: number) {
    if (project?.stages[stage].adopted_version != null || project?.staging?.[stage]) {
      openConfirm(reviseFrom === undefined ? "run" : "revise", reviseFrom);
      return;
    }
    void onExecuteRun(reviseFrom, undefined, false);
  }

  const isStale = state?.status === "stale";
  const reassembleReason = stage === "prompts" ? readerMessage(project?.reassemble_reason ?? "") || null : "仅分镜提示词支持重新拼装。";
  const currentRating = version !== null && project ? project.ratings?.[stage]?.[version] : undefined;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden" aria-label="阶段和产物">
      <div className="border-border/80 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">阶段与产物</h2>
      </div>

      <StageNav project={project} stage={stage} running={running} runnableStages={config.runnable_stages} onStageChange={onStageChange} />

      {project && allStagesAdopted(project) && (
        <p className="text-success border-border/60 bg-success/10 border-b px-4 py-1.5 text-xs font-medium" role="status">
          全流程已完成 · 六阶段产物均已采用
        </p>
      )}

      <VersionPicker
        project={project} stage={stage} versions={preview.versions} version={version} state={state}
        canExpand={Boolean(preview.visiblePreview)} onVersionChange={onVersionChange} onExpand={() => preview.setExpanded(true)}
        extraActions={
          <MoreActionsMenu
            busy={busy} hasVersion={version !== null} isStale={isStale} stage={stage}
            runReason={blockedReason} reassembleReason={reassembleReason} hasRating={Boolean(currentRating)}
            onOpenRating={() => setRatingOpen(true)} onRun={() => requestRun()}
            onConfirmValid={() => openConfirm("confirm-valid")} onReassemble={() => openConfirm("reassemble")}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3">
        <ArtifactStaleNotice isStale={isStale} />
        {!implemented && <p className="bg-warning/15 text-warning rounded-md px-3 py-2 text-xs">{stageNames[stage]}暂未开放运行。</p>}
        {project?.staging?.[stage] && (
          <p className="bg-warning/15 text-warning rounded-md px-3 py-2 text-xs">
            存在未汇总暂存：{project.staging[stage]!.count} {stage === "prompts" ? "镜" : "场"}。运行时可选择继续或重新开始。
            {project.staging[stage]!.revise_from !== null ? ` 请从 v${project.staging[stage]!.revise_from} 的按意见修改入口继续。` : ""}
          </p>
        )}
        {project && <BibleImpactNotice project={project} stage={stage} />}

        <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs min-w-0 max-w-full overflow-x-hidden" aria-label="产物预览">
          {preview.previewError ? (
            <p className="text-destructive text-xs" role="alert">{preview.previewError}</p>
          ) : preview.visiblePreview ? (
            <ArtifactPreview stage={stage} value={preview.visiblePreview.value} bible={preview.bible} script={preview.script} revision={revision} />
          ) : (
            <p className="text-muted-foreground text-xs">{version === null ? guidance.empty : "正在读取版本…"}</p>
          )}
        </div>

        <ReviewPanel
          key={`${stage}:${version}`} stage={stage} state={state} version={version}
          loaded={Boolean(preview.visiblePreview && !preview.previewError)} revision={revision} implemented={implemented}
          programAssembled={version !== null && project?.provenance?.[stage]?.[version]?.generated_by === "reassemble"}
          busy={busy} runReason={blockedReason} error={error} demo={demo}
          onReview={(op, note) => onAction(async () => {
            await api(`${preview.path}/stages/${stage}/${op}`, {
              version, confirmed: op === "adopt" && state?.adopted_version != null,
              ...(note === undefined ? {} : { note }),
            });
          })}
          onRevise={() => { if (version !== null) requestRun(version); }}
        />

        <RunSummaryCard project={project} stage={stage} running={running} implemented={implemented} rows={rows} />

        {stage === "storyboard" && project?.stages.prompts.status === "ready" && (
          <p className="bg-warning/15 text-warning rounded-md px-3 py-2 text-xs">
            分镜已采用，分镜提示词已解锁（依赖已满足）；可切换到分镜提示词运行。
          </p>
        )}
        <p className="text-muted-foreground text-[11px] leading-relaxed">{guidance.footer}</p>
      </div>

      {preview.confirm && (
        <ReworkDialog
          key={`${stage}:${preview.confirm.operation}`} operation={preview.confirm.operation}
          staging={(preview.confirm.operation === "run" || preview.confirm.operation === "revise") && Boolean(project?.staging?.[stage])}
          busy={submitting} error={error} onCancel={() => preview.setConfirm(null)}
          onConfirm={async (reason, choice) => {
            const ok = preview.confirm!.operation === "run" || preview.confirm!.operation === "revise"
              ? await onExecuteRun(preview.confirm!.reviseFrom, choice, true)
              : await onAction(async () => {
                await api(`${preview.path}/stages/${stage}/${preview.confirm!.operation}`, { confirmed: true, reason });
              });
            if (ok) preview.setConfirm(null);
            return ok;
          }}
        />
      )}

      {version !== null && (
        <RatingDialog
          key={`rating:${id}:${stage}:${version}`} open={ratingOpen} onOpenChange={setRatingOpen}
          path={preview.path} stage={stage} version={version} rating={currentRating} busy={busy}
          onSave={(scores, note) => onAction(async () => {
            await api(`${preview.path}/stages/${stage}/rating`, { version, scores, note });
          })}
        />
      )}

      {preview.expanded && preview.visiblePreview && (
        <ExpandedPreview
          dialogRef={preview.previewDialog} stage={stage} version={version}
          value={preview.visiblePreview.value} bible={preview.bible} script={preview.script}
          revision={revision} onClose={() => preview.setExpanded(false)}
        />
      )}
    </div>
  );
}
