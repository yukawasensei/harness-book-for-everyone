import { Loader2, Square } from "lucide-react";
import type { Stage } from "../../../../../src/contracts/index.js";
import { stageNames } from "@/features/artifacts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RunStatusBar({
  stage,
  onAbort,
  disabled,
  className,
}: {
  stage?: Stage;
  onAbort?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const stageName = stage ? stageNames[stage] ?? stage : "内容";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs shadow-xs",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-primary font-medium">
        <Loader2 className="size-3.5 animate-spin shrink-0" />
        <span>正在编写{stageName}…</span>
      </div>
      {onAbort && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAbort}
          disabled={disabled}
          aria-label="中断当前工序"
          className="h-7 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Square className="size-3 fill-current" /> 中断
        </Button>
      )}
    </div>
  );
}
