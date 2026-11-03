import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function BibleRoleContext({ role, personality }: { role: string; personality: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1 pt-1 border-t border-border/50 text-[11px]">
      <CollapsibleTrigger className="hover:text-primary flex items-center gap-1 text-muted-foreground font-medium">
        <span>叙事定位与性格</span>
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-0.5 text-foreground pl-1">
        <p><span className="text-muted-foreground mr-1">定位：</span>{role}</p>
        <p><span className="text-muted-foreground mr-1">性格：</span>{personality}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
