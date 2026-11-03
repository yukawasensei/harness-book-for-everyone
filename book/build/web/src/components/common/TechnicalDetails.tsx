import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function TechnicalDetails({
  children,
  className,
  label = "技术详情",
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("mt-1.5", className)}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
        >
          {label}
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-muted/40 text-muted-foreground mt-1.5 max-w-full overflow-x-auto rounded-md p-2 text-xs break-words">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
