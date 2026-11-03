import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TechnicalDetails } from "@/components/common/TechnicalDetails";
import { readableError } from "../lib/presentation.js";

export function ErrorDetails({ errors }: { errors: string[] }) {
  const [open, setOpen] = useState(false);
  if (!errors.length) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="text-destructive hover:text-destructive/90 inline-flex items-center gap-1 text-xs transition-colors"
        >
          查看过程错误（{errors.length}）
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-1.5 list-decimal space-y-2 pl-4 text-xs">
          {errors.map((raw, index) => (
            <li key={index} className="min-w-0">
              <p className="text-foreground break-words">{readableError(raw)}</p>
              <TechnicalDetails>
                <pre className="font-mono whitespace-pre-wrap break-all">{raw}</pre>
              </TechnicalDetails>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
