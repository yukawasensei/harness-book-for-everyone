import { useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SELF_CORRECTION_TITLE, selfCorrectionDetail } from "@/features/artifacts";
import { cn } from "@/lib/utils";

export function SelfCorrectionCard({
  reason,
  attempts = 2,
  children,
  className,
}: {
  reason: string;
  attempts?: number;
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn("max-w-lg w-full rounded-lg border border-warning/30 bg-warning/5 shadow-xs", className)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-start gap-2 px-3.5 py-2.5 text-left hover:bg-warning/10 transition-colors"
        >
          <AlertTriangle className="size-3.5 text-warning mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 text-xs font-medium text-foreground leading-relaxed">
            {SELF_CORRECTION_TITLE}
          </span>
          {open
            ? <ChevronUp className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            : <ChevronDown className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-warning/20 px-3.5 py-3 space-y-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            {selfCorrectionDetail(reason, attempts)}
          </p>
          {children && <div className="space-y-2">{children}</div>}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
