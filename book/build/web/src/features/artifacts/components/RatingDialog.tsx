import { useEffect, useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import {
  SCORE_LABELS,
  SCORE_ANCHORS,
  STAGE_DIMENSIONS,
  type Rating,
  type Dimension,
} from "../../../../../src/project/ratings.js";
import type { Stage } from "../../../../../src/contracts/index.js";
import { formatLocalDateTime } from "@/lib/format/date-time.js";
import { api } from "@/lib/api";
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

export function RatingDialog({
  open,
  onOpenChange,
  path,
  stage,
  version,
  rating,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string;
  stage: Stage;
  version: number;
  rating?: Rating;
  busy: boolean;
  onSave: (scores: Partial<Record<Dimension, number>>, note: string) => Promise<boolean>;
}) {
  const [scores, setScores] = useState<Partial<Record<Dimension, number>>>(rating?.scores ?? {});
  const [note, setNote] = useState(rating?.note ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScores(rating?.scores ?? {});
    setNote(rating?.note ?? "");
    setMessage("");
  }, [rating, open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      const ok = await onSave(scores, note);
      if (ok) {
        setMessage("评分已保存");
        setTimeout(() => onOpenChange(false), 800);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload() {
    try {
      const report = await api(`${path}/ratings`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "human-ratings.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("评分汇总已导出");
    } catch {
      setMessage("导出失败，请重试");
    }
  }

  const dimensions = STAGE_DIMENSIONS[stage] ?? [];
  const hasScores = Object.keys(scores).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">人工评分 · v{version}</DialogTitle>
          <DialogDescription className="text-xs">
            1 分低、5 分高；不影响采用与结构签收。未填项不计分。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {dimensions.map(key => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-foreground block">
                  {SCORE_LABELS[key]}
                </label>
                <select
                  aria-label={SCORE_LABELS[key]}
                  value={scores[key] ?? ""}
                  disabled={busy || saving}
                  onChange={e => {
                    const val = e.target.value;
                    setScores(curr => {
                      const next = { ...curr };
                      if (val) next[key] = Number(val);
                      else delete next[key];
                      return next;
                    });
                  }}
                  className="border-input bg-background text-foreground h-8 w-full rounded-md border px-2.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">未评分</option>
                  {[1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>
                      {n} 分 · {SCORE_ANCHORS[key][n - 1]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground block">评分说明</label>
            <Textarea
              aria-label="评分说明"
              value={note}
              maxLength={2000}
              disabled={busy || saving}
              onChange={e => setNote(e.target.value)}
              placeholder="写下具体场次、镜号或判断依据"
              rows={3}
              className="resize-none text-xs"
            />
          </div>

          {rating?.at && (
            <p className="text-muted-foreground text-[11px]">
              上次评分时间：<time dateTime={rating.at}>{formatLocalDateTime(rating.at)}</time>
            </p>
          )}

          {message && (
            <p className="text-primary text-xs font-medium" role="status">
              {message}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || saving}
              onClick={() => void handleDownload()}
              className="gap-1 text-xs"
            >
              <Download className="size-3.5" /> 导出评分汇总
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy || saving}
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                取消
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={busy || saving || !hasScores}
                className="text-xs"
              >
                保存评分
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
