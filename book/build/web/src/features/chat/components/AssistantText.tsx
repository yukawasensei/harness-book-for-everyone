import { Bot } from "lucide-react";
import { formatLocalDateTime } from "@/lib/format/date-time.js";
import { cn } from "@/lib/utils";

export function AssistantText({
  text,
  at,
  streaming,
  className,
}: {
  text: string;
  at?: string;
  streaming?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-1 pr-10", className)}>
      <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <Bot className="size-3.5 text-primary" />
        <span>织影助手</span>
        {at && (
          <time dateTime={at} className="text-[11px]">
            {formatLocalDateTime(at)}
          </time>
        )}
      </div>
      <div className="bg-card text-foreground border-border/70 max-w-[90%] rounded-2xl rounded-tl-xs border px-4 py-3 text-sm leading-relaxed shadow-xs whitespace-pre-wrap break-words">
        {text}
        {streaming && (
          <span className="bg-primary ml-1 inline-block h-3.5 w-1.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
