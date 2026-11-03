import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { RunResult } from "../../../../../src/server/protocol.js";
import { stageNames } from "../lib/presentation.js";
import { formatLocalDateTime } from "@/lib/format/date-time.js";
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
export { BibleImpactNotice } from "./BibleImpactNotice";
export { ProvenancePanel } from "./ProvenancePanel";
export { ReworkActions } from "./ReworkActions";

export function InterruptedRunNotice({ run }: { run: RunResult | null | undefined }) {
  if (run?.stop_reason !== "interrupted") return null;
  return (
    <div className="bg-warning/15 text-warning flex items-start gap-2 rounded-md p-2.5 text-xs" role="status">
      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="font-medium">上次运行被中断 · {stageNames[run.stage]}</p>
        <p className="text-muted-foreground">
          运行开始：<time dateTime={run.started_at}>{formatLocalDateTime(run.started_at)}</time>。可选择从暂存继续或重新开始。
        </p>
      </div>
    </div>
  );
}

export type ReworkOperation = "run" | "revise" | "confirm-valid" | "reassemble";

export function ReworkDialog({
  operation,
  staging,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  operation: ReworkOperation;
  staging: boolean;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (reason: string, choice?: "resume" | "restart") => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const [choice, setChoice] = useState<"resume" | "restart">("resume");

  const title = operation === "confirm-valid"
    ? "确认仍然有效"
    : operation === "reassemble"
      ? "确认重新拼装"
      : "确认运行";

  const description = operation === "confirm-valid"
    ? "声明采用版本在当前上游下仍然适用。记录理由并更新来源，原产物文件保留。"
    : operation === "reassemble"
      ? "使用新设定与原镜头部分生成待审阅新版本，不调用模型。采用新版本后恢复有效状态。"
      : "将生成待审阅新版本；当前采用版本继续保留。真实模型模式会请求模型，采用变化会检查下游是否待更新。";

  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={e => {
            e.preventDefault();
            void onConfirm(reason, staging ? choice : undefined);
          }}
          className="space-y-4"
        >
          {operation === "confirm-valid" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground block">
                有效理由（必填）
              </label>
              <Textarea
                required
                maxLength={8000}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="说明为什么当前版本仍然适用"
                rows={3}
                className="resize-none text-xs"
              />
            </div>
          )}

          {staging && (
            <div className="space-y-2 rounded-md border border-border/80 bg-muted/30 p-2.5 text-xs">
              <span className="font-medium text-foreground block">发现未汇总暂存</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="staging"
                    checked={choice === "resume"}
                    onChange={() => setChoice("resume")}
                    className="accent-primary"
                  />
                  从暂存继续
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="staging"
                    checked={choice === "restart"}
                    onChange={() => setChoice("restart")}
                    className="accent-primary"
                  />
                  重新开始（替换暂存）
                </label>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onCancel}
              className="text-xs"
            >
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={busy || (operation === "confirm-valid" && !reason.trim())}
              className="text-xs"
            >
              {title}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

