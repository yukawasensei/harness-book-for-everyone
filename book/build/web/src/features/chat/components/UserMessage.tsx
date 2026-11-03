import { formatLocalDateTime } from "@/lib/format/date-time.js";
import { cn } from "@/lib/utils";

export function UserMessage({
  text,
  at,
  className,
}: {
  text: string;
  at?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-end gap-1 pl-10", className)}>
      <div className="bg-primary/10 text-foreground border-primary/20 max-w-[85%] rounded-2xl rounded-tr-xs border px-4 py-2.5 text-sm shadow-xs whitespace-pre-wrap break-words">
        {text}
      </div>
      {at && (
        <time dateTime={at} className="text-muted-foreground px-1 text-[11px]">
          {formatLocalDateTime(at)}
        </time>
      )}
    </div>
  );
}
