import { useState } from "react";
import { Check, CheckCircle2, ChevronRight, FileText, RotateCcw, Trash2 } from "lucide-react";
import type { Stage } from "../../../../../src/contracts/index.js";
import { stageNames } from "@/features/artifacts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function ReviewCard({
  stage, version, decision, note, summary,
  onViewArtifact, onAdopt, onDiscard, onRequestChanges,
  disabled, className,
}: {
  stage: Stage;
  version: number;
  decision?: "adopted" | "discarded" | "changes_requested";
  note?: string;
  summary?: string;
  onViewArtifact?: (stage: Stage, version: number) => void;
  onAdopt?: (stage: Stage, version: number) => Promise<void> | void;
  onDiscard?: (stage: Stage, version: number) => Promise<void> | void;
  onRequestChanges?: (stage: Stage, version: number, note: string) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}) {
  const [showChangesInput, setShowChangesInput] = useState(false);
  const [changesText, setChangesText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const stageLabel = stageNames[stage] ?? stage;
  const isResolved = !!decision;

  async function handleAdopt() {
    if (disabled || submitting || !onAdopt) return;
    setSubmitting(true);
    try { await onAdopt(stage, version); }
    finally { setSubmitting(false); }
  }

  async function handleDiscard() {
    if (disabled || submitting || !onDiscard) return;
    setSubmitting(true);
    try { await onDiscard(stage, version); }
    finally { setSubmitting(false); }
  }

  async function submitChanges() {
    const value = changesText.trim();
    if (!value || disabled || submitting || !onRequestChanges) return;
    setSubmitting(true);
    try {
      await onRequestChanges(stage, version, value);
      setShowChangesInput(false);
      setChangesText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className={cn("border-border/80 bg-card/90 max-w-lg w-full shadow-xs", className)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{stageLabel} v{version}</span>
            <span className="text-muted-foreground text-xs">已交稿</span>
          </div>
          {decision === "adopted" && (
            <Badge variant="success" className="gap-1 text-xs"><CheckCircle2 className="size-3" /> 已采用</Badge>
          )}
          {decision === "changes_requested" && (
            <Badge variant="warning" className="gap-1 text-xs"><RotateCcw className="size-3" /> 已要求修改</Badge>
          )}
          {decision === "discarded" && (
            <Badge variant="destructive" className="gap-1 text-xs"><Trash2 className="size-3" /> 已丢弃</Badge>
          )}
        </div>

        <p className="text-muted-foreground text-xs leading-relaxed">
          {summary || `${stageLabel} 第 ${version} 版已生成，请审阅内容后决定是否采用。`}
        </p>

        {isResolved ? (
          <div className="bg-muted/40 rounded-md p-2.5 text-xs space-y-1">
            <div className="text-foreground font-medium">
              审阅结论：{decision === "adopted" ? "已采用此版本，继续下一步" : decision === "changes_requested" ? "已提出修改意见" : "已丢弃此版本"}
            </div>
            {note && <div className="text-muted-foreground whitespace-pre-wrap">{note}</div>}
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={() => void handleAdopt()} disabled={disabled || submitting} className="gap-1.5">
                <Check className="size-3.5" /> 采用并继续
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setShowChangesInput(prev => !prev)} disabled={disabled || submitting} className="gap-1.5">
                <RotateCcw className="size-3.5" /> 要求修改
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void handleDiscard()} disabled={disabled || submitting} className="gap-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="size-3.5" /> 丢弃
              </Button>
              {onViewArtifact && (
                <Button type="button" size="sm" variant="ghost" onClick={() => onViewArtifact(stage, version)} className="gap-1 text-primary hover:text-primary ml-auto text-xs">
                  在右侧查看 <ChevronRight className="size-3" />
                </Button>
              )}
            </div>

            {showChangesInput && (
              <div className="bg-muted/30 border-border/60 rounded-md border p-3 space-y-2">
                <Textarea
                  value={changesText}
                  onChange={e => setChangesText(e.target.value)}
                  placeholder="填写具体的修改意见，例如：把第二场改得更紧张…"
                  rows={2}
                  maxLength={8000}
                  disabled={submitting}
                  className="text-xs"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-[11px]">也可以直接在下方输入框说</span>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowChangesInput(false)} disabled={submitting} className="h-7 text-xs">
                      取消
                    </Button>
                    <Button type="button" size="sm" onClick={() => void submitChanges()} disabled={submitting || !changesText.trim()} className="h-7 text-xs">
                      {submitting ? "提交中…" : "提交意见"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
