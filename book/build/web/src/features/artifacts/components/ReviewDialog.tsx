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
  adoptReason: string | null;
  reason: string | null;
  discardReason: string | null;
  onCancel: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  if (!open) return null;

  return (
    <Dialog open onOpenChange={val => { if (!val) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {open === "adopt" ? "确认切换采用" : open === "discard" ? "确认丢弃" : "要求修改"} · v{version}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {open === "changes"
              ? "说明希望保留什么、具体改哪里；确认后保留原稿，点击「按意见修改」启动运行。"
              : open === "adopt"
                ? `将采用版本从 v${adoptedVersion} 切换为 v${version}，下游将被标记待更新。`
                : `版本将保留可追溯，但之后不能采用。确定丢弃 v${version} 吗？`}
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
                placeholder="说明希望保留什么、具体改哪里"
                rows={4}
                className="resize-none text-xs"
              />
              {demo && <p className="text-muted-foreground text-[11px]">演示示例：{exampleNote}</p>}
              {editedDemoNotice && <p className="text-muted-foreground text-[11px]">{editedDemoNotice}</p>}
              {reason && <p className="text-muted-foreground text-[11px]">{reason}</p>}
            </div>
          )}

          {error && <p role="alert" className="text-destructive text-xs">{error}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCancel} className="text-xs">
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={open === "discard" ? "destructive" : "default"}
              disabled={busy || (open === "adopt" ? Boolean(adoptReason) : open === "discard" ? Boolean(discardReason) : Boolean(reason) || !note.trim())}
              className="text-xs"
            >
              {open === "adopt" ? "确认切换采用" : open === "discard" ? "确认丢弃" : "确认修改意见"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
