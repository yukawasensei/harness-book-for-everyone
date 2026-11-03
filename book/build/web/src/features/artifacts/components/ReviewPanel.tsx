import { useState, type FormEvent } from "react";
import { formatLocalDateTime } from "@/lib/format/date-time.js";
import type { StageState } from "../../../../../src/workflow/index.js";
import type { SceneChanges, Stage } from "../../../../../src/contracts/index.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  demoChangeNote,
  DEMO_REVISION_NOTICE,
  demoRevisionNotice,
  reviewLabels,
  revisionDescription,
  stageNames,
} from "../lib/presentation.js";
import { ReviewDialog } from "./ReviewDialog";

export function ReviewPanel({
  stage,
  state,
  revision,
  version,
  loaded,
  busy,
  implemented = true,
  runReason,
  error,
  demo,
  programAssembled = false,
  onReview,
  onRevise,
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

  const reason = !implemented ? `${stageNames[stage]}暂未开放，当前没有可审阅版本。`
    : version === null ? "尚无版本，请先运行阶段。"
      : busy ? "项目正在运行或提交操作，请稍候。"
        : !loaded ? "请等版本内容加载完成后再审阅。"
          : status !== "pending" && status !== "adopted" ? `此版本${reviewLabels[status]}，不能重复审阅。` : null;

  const adoptReason = busy ? "项目正在运行或提交操作，请稍候。"
    : !loaded ? "请等待版本内容加载。"
      : current ? "此版本正在采用。"
        : status === "discarded" ? "丢弃版本不能采用。" : runReason;

  const discardReason = current ? "请先切换采用版本。" : reason;
  const savedDemoNotice = review?.note ? demoRevisionNotice(demo, review.note, stage) : null;
  const editedDemoNotice = demoRevisionNotice(demo, note, stage);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!open || version === null) return;
    const op = open === "adopt" ? "adopt" : open === "discard" ? "discard" : "request-changes";
    const ok = await onReview(op, open === "changes" ? note : undefined);
    if (ok) setOpen(null);
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
        <Button
          size="sm"
          disabled={Boolean(adoptReason)}
          title={adoptReason ?? "采用此版本，继续下一步"}
          onClick={() => state?.adopted_version !== null ? setOpen("adopt") : void onReview("adopt")}
          className="h-8 text-xs"
        >
          {state?.adopted_version != null && !current ? "切换采用此版本" : "采用此版本"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={Boolean(reason)}
          title={reason ?? "填写意见，要求一个新版本"}
          onClick={() => setOpen("changes")}
          className="h-8 text-xs"
        >
          要求修改
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={Boolean(discardReason)}
          title={discardReason ?? "确认后标记为已丢弃，保留版本内容"}
          onClick={() => setOpen("discard")}
          className="h-8 text-xs text-muted-foreground hover:text-destructive"
        >
          丢弃
        </Button>
      </div>

      {(reason || adoptReason) && (
        <p className="text-muted-foreground text-[11px]">
          {reason}{adoptReason && adoptReason !== reason ? ` · ${adoptReason}` : ""}
        </p>
      )}

      {status === "changes_requested" && (
        <div className="space-y-1.5 rounded-md border border-border/80 bg-muted/20 p-2.5">
          <Button
            size="sm"
            disabled={busy || Boolean(runReason)}
            onClick={onRevise}
            className="h-8 gap-1 text-xs"
          >
            按意见修改 v{version}
          </Button>
          <p className="text-muted-foreground text-[11px]">
            {busy ? "请等待当前操作完成。" : runReason ?? "将根据这份原稿和意见生成新版本，完成后需重新审阅。"}
          </p>
          {savedDemoNotice && <p className="text-muted-foreground text-[11px]">{savedDemoNotice}</p>}
        </div>
      )}

      <ReviewDialog
        open={open}
        version={version}
        adoptedVersion={state?.adopted_version}
        note={note}
        onNoteChange={setNote}
        busy={busy}
        error={error}
        demo={demo}
        exampleNote={exampleNote}
        editedDemoNotice={editedDemoNotice}
        adoptReason={adoptReason}
        reason={reason}
        discardReason={discardReason}
        onCancel={() => setOpen(null)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
