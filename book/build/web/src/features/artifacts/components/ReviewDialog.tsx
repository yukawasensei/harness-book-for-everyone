import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DISCARD_ACTION_HINT,
  REQUEST_CHANGES_HINT,
  reviewDisableReasons,
} from "../lib/review-copy.js";

/** 已采用版本按意见修改时，替代二次「确认运行」的一行提醒。 */
export const ADOPTED_REVISE_HINT = "改完以后，后面依赖它的工序会变成待更新。";

export function ReviewDialog({
  open,
  version,
  adoptedVersion,
  note,
  onNoteChange,
  busy,
  error,
  demo,
  exampleNote,
  editedDemoNotice,
  showDownstreamHint = false,
  adoptReason,
  reason,
  discardReason,
  onCancel,
  onSubmit,
}: {
  open: "changes" | "discard" | "adopt" | null;
  version: number;
  adoptedVersion?: number | null;
  note: string;
  onNoteChange: (note: string) => void;
  busy: boolean;
  error: string;
  demo: boolean;
  exampleNote: string;
  editedDemoNotice?: string | null;
  /** 已采用版本要求修改时，在按钮上方提示下游会待更新。 */
  showDownstreamHint?: boolean;
  adoptReason: string | null;
  reason: string | null;
  discardReason: string | null;
  onCancel: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  if (!open) return null;

  const emptyNote = open === "changes" && !note.trim();

  return (
    <Dialog open onOpenChange={val => { if (!val) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {open === "adopt" ? "确认切换采用" : open === "discard" ? "确认丢弃" : "要求修改"} · v{version}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {open === "changes"
              ? REQUEST_CHANGES_HINT
              : open === "adopt"
                ? `将采用版本从 v${adoptedVersion} 切换为 v${version}，下游将被标记待更新。`
                : DISCARD_ACTION_HINT}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          {open === "changes" && (
            <div className="space-y-1">
              <Textarea
                autoFocus
                required
                maxLength={8000}
                value={note}
                onChange={e => onNoteChange(e.target.value)}
                disabled={busy}
                placeholder={REQUEST_CHANGES_HINT}
                rows={4}
                className="resize-none text-xs"
              />
              {demo && <p className="text-muted-foreground text-[11px]">演示示例：{exampleNote}</p>}
              {editedDemoNotice && <p className="text-muted-foreground text-[11px]">{editedDemoNotice}</p>}
              {emptyNote && <p className="text-muted-foreground text-[11px]">{reviewDisableReasons.emptyNote}</p>}
              {reason && <p className="text-muted-foreground text-[11px]">{reason}</p>}
            </div>
          )}

          {error && <p role="alert" className="text-destructive text-xs">{error}</p>}

          {open === "changes" && showDownstreamHint && (
            <p className="text-muted-foreground text-[11px]">{ADOPTED_REVISE_HINT}</p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCancel} className="text-xs">
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={open === "discard" ? "destructive" : "default"}
              disabled={busy || (open === "adopt" ? Boolean(adoptReason) : open === "discard" ? Boolean(discardReason) : Boolean(reason) || !note.trim())}
              title={open === "changes" && !note.trim() ? reviewDisableReasons.emptyNote : undefined}
              className="text-xs"
            >
              {open === "adopt" ? "确认切换采用" : open === "discard" ? "确认丢弃" : "按意见修改"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
