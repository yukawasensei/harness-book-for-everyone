import { useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, FileText, RotateCcw, Trash2 } from "lucide-react";
import type { Stage } from "../../../../../src/contracts/index.js";
import { countSubmissionItems, stageNames, submissionSummary } from "@/features/artifacts";
import { endpoints } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const decisionLabels = {
  adopted: { label: "已采用", variant: "success" as const, Icon: CheckCircle2 },
  changes_requested: { label: "已要求修改", variant: "warning" as const, Icon: RotateCcw },
  discarded: { label: "已丢弃", variant: "destructive" as const, Icon: Trash2 },
};

export function ReviewCard({
  stage, version, decision, note, summary, itemCount, projectId,
  onViewArtifact, disabled, className,
}: {
  stage: Stage;
  version: number;
  decision?: "adopted" | "discarded" | "changes_requested";
  note?: string;
  summary?: string;
  itemCount?: number;
  projectId?: string;
  onViewArtifact?: (stage: Stage, version: number) => void;
  /** ChatPane 仍可能传入；签字只在右栏，此处忽略 */
  onAdopt?: (stage: Stage, version: number) => Promise<void> | void;
  onDiscard?: (stage: Stage, version: number) => Promise<void> | void;
  onRequestChanges?: (stage: Stage, version: number, note: string) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}) {
  const stageLabel = stageNames[stage] ?? stage;
  const needsCount = !summary && itemCount == null && (stage === "script" || stage === "board");
  const [loadedCount, setLoadedCount] = useState<number | undefined>();

  useEffect(() => {
    if (!needsCount || !projectId) {
      setLoadedCount(undefined);
      return;
    }
    const controller = new AbortController();
    void endpoints.projects.stageVersion(projectId, stage, version, controller.signal)
      .then(value => {
        if (!controller.signal.aborted) setLoadedCount(countSubmissionItems(stage, value));
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadedCount(undefined);
      });
    return () => controller.abort();
  }, [needsCount, projectId, stage, version]);

  const resolvedCount = itemCount ?? loadedCount;
  const body = summary ?? submissionSummary(stage, version, resolvedCount);
  const resolved = decision ? decisionLabels[decision] : null;

  return (
    <Card className={cn("border-border/80 bg-card/90 max-w-lg w-full shadow-xs", className)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{stageLabel} v{version}</span>
            <span className="text-muted-foreground text-xs">已交稿</span>
          </div>
          {resolved && (
            <Badge variant={resolved.variant} className="gap-1 text-xs">
              <resolved.Icon className="size-3" /> {resolved.label}
            </Badge>
          )}
        </div>

        <p className="text-muted-foreground text-xs leading-relaxed">{body}</p>

        {note && decision === "changes_requested" && (
          <p className="text-muted-foreground bg-muted/40 rounded-md p-2.5 text-xs whitespace-pre-wrap">{note}</p>
        )}

        {onViewArtifact && (
          <Button
            type="button"
            size="sm"
            variant={resolved ? "secondary" : "default"}
            disabled={disabled}
            onClick={() => onViewArtifact(stage, version)}
            className="gap-1.5"
          >
            查看并审阅 <ChevronRight className="size-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
