import { useState, type FormEvent } from "react";
import { formatLocalDateTime } from "@/lib/format/date-time.js";
import type { StageState } from "../../../../../src/workflow/index.js";
import type { SceneChanges, Stage } from "../../../../../src/contracts/index.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ADOPT_ACTION_HINT,
  DISCARD_ACTION_HINT,
  adoptActionLabels,
  demoChangeNote,
  DEMO_REVISION_NOTICE,
  demoRevisionNotice,
  looksLikeQuota,
  looksLikeUpstreamBlock,
  reviewDisableReasons,
  reviewLabels,
  revisionDescription,
  stageNames,
} from "../lib/presentation.js";
import { ReviewDialog } from "./ReviewDialog";

/** 提交修改意见并立即启动新一版生成（弹窗「按意见修改」一键开跑）。 */
export async function submitRequestChangesAndRevise(
  note: string,
  onReview: (operation: "request-changes", note: string) => Promise<boolean>,
  onRevise: () => void,
): Promise<boolean> {
  if (!note.trim()) return false;
  if (!(await onReview("request-changes", note))) return false;
  onRevise();
  return true;
}

export function ReviewPanel({
  stage, state, revision, version, loaded, busy, implemented = true,
  runReason, error, demo, programAssembled = false, onReview, onRevise,
}: {
  stage: Stage;
  implemented?: boolean;
  revision?: SceneChanges;
  programAssembled?: boolean;
  state?: StageState;
  version: number | null;
  loaded: boolean;
  busy: boolean;
  demo: boolean;
  runReason: string | null;
  error: string;
  onReview: (operation: "adopt" | "discard" | "request-changes", note?: string) => Promise<boolean>;
  onRevise: () => void;
}) {
  const [open, setOpen] = useState<"changes" | "discard" | "adopt" | null>(null);
  const exampleNote = demoChangeNote(stage);
  const [note, setNote] = useState(demo ? exampleNote : "");

  const review = version === null ? null : state?.reviews?.[version];
  const status = review?.status ?? (state?.adopted_version === version && version !== null ? "adopted" : "pending");
  const current = state?.adopted_version === version && version !== null;
  const adoptLabel = adoptActionLabels[stage];

  const reason = !implemented ? `${stageNames[stage]}暂未开放，当前没有可审阅版本。`
    : version === null ? "尚无版本，请先运行阶段。"
      : busy ? reviewDisableReasons.busy
        : !loaded ? "请等版本内容加载完成后再审阅。"
          : status !== "pending" && status !== "adopted" ? `此版本${reviewLabels[status]}，不能重复审阅。` : null;

  const adoptReason = busy ? reviewDisableReasons.busy
    : !loaded ? "请等待版本内容加载。"
      : current ? reviewDisableReasons.adopted
        : status === "discarded" ? reviewDisableReasons.discarded
          : looksLikeUpstreamBlock(runReason) ? reviewDisableReasons.upstream
            : runReason;

  const discardReason = current ? "当前版本已采用，不可丢弃。" : reason;
  // 已要求修改仍可再次打开弹窗一键重跑；丢弃等其它终态仍走 reason。
  const changesReason = busy ? reviewDisableReasons.busy
    : looksLikeQuota(runReason) ? reviewDisableReasons.quota
      : status === "changes_requested" ? null
        : reason;
  const editedDemoNotice = demoRevisionNotice(demo, note, stage);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!open || version === null) return;
    if (open === "changes") {
      if (await submitRequestChangesAndRevise(note, onReview, onRevise)) setOpen(null);
      return;
    }
    const op = open === "adopt" ? "adopt" : "discard";
    if (await onReview(op)) setOpen(null);
  }

  if (version === null) {
    return (
      <div className="space-y-2 rounded-lg border border-border/80 bg-card p-3 text-xs" aria-label="版本审阅">
        <p className="text-muted-foreground">{reason ?? "尚无版本，请先运行阶段。"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-card p-3 text-xs" aria-label="版本审阅">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium">
          <span>v{version}</span>
          <Badge variant={status === "adopted" ? "default" : "secondary"} className="text-[10px]">
            {reviewLabels[status]}
          </Badge>
        </div>
        {review?.at && (
          <span className="text-muted-foreground text-[11px]">
            审阅于 <time dateTime={review.at}>{formatLocalDateTime(review.at)}</time>
          </span>
        )}
      </div>

      {revisionDescription(revision) && (
        <p className="text-muted-foreground text-[11px]">{revisionDescription(revision)}</p>
      )}
      {programAssembled ? (
        <p className="text-muted-foreground bg-muted/40 rounded px-2 py-1 text-[11px]">由程序拼装，未调用模型</p>
      ) : demo && version > 1 ? (
        <p className="text-muted-foreground bg-muted/40 rounded px-2 py-1 text-[11px]">{DEMO_REVISION_NOTICE}</p>
      ) : null}
      {review?.note && (
        <div className="rounded-md bg-muted/30 p-2 text-xs">
          <span className="text-muted-foreground block text-[11px]">审阅意见</span>
          <p className="mt-0.5 text-foreground">{review.note}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" disabled={Boolean(adoptReason)} title={adoptReason ?? ADOPT_ACTION_HINT}
          onClick={() => state?.adopted_version !== null ? setOpen("adopt") : void onReview("adopt")}
          className="h-8 text-xs">{adoptLabel}</Button>
        <Button size="sm" variant="outline" disabled={Boolean(changesReason)}
          title={changesReason ?? "填写意见，要求一个新版本"} onClick={() => setOpen("changes")}
          className="h-8 text-xs">要求修改</Button>
        <Button size="sm" variant="ghost" disabled={Boolean(discardReason)}
          title={discardReason ?? DISCARD_ACTION_HINT} onClick={() => setOpen("discard")}
          className="h-8 text-xs text-muted-foreground hover:text-destructive">丢弃此版本</Button>
      </div>
      <p className="text-muted-foreground text-[11px]">{ADOPT_ACTION_HINT}</p>
      {(changesReason || adoptReason) && (
        <p className="text-muted-foreground text-[11px]">
          {changesReason}{adoptReason && adoptReason !== changesReason ? ` · ${adoptReason}` : ""}
        </p>
      )}

      <ReviewDialog
        open={open} version={version} adoptedVersion={state?.adopted_version}
        note={note} onNoteChange={setNote} busy={busy} error={error} demo={demo}
        exampleNote={exampleNote} editedDemoNotice={editedDemoNotice}
        showDownstreamHint={current}
        adoptReason={adoptReason} reason={changesReason} discardReason={discardReason}
        onCancel={() => setOpen(null)} onSubmit={handleSubmit}
      />
    </div>
  );
}
