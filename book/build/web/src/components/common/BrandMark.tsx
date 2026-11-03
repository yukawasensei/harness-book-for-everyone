import { Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

/** 文字型品牌标志：lucide 图标 + 织影 Reelloom。 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Clapperboard className="text-primary size-5 shrink-0" aria-hidden="true" />
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-lg font-semibold tracking-tight">织影</span>
        <span className="text-muted-foreground text-sm font-medium tracking-wide">Reelloom</span>
      </div>
    </div>
  );
}
