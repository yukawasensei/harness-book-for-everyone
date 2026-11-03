import { AlertCircle, AlertTriangle, Clock, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SystemNoticeType = "error" | "quota" | "stale" | "info";

export function SystemNotice({
  type = "info",
  title,
  message,
  action,
  className,
}: {
  type?: SystemNoticeType;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  const isDestructive = type === "error";
  const isWarning = type === "quota" || type === "stale";

  return (
    <Card
      className={cn(
        "border shadow-xs max-w-lg w-full transition-colors",
        isDestructive && "border-destructive/30 bg-destructive/5 text-destructive",
        isWarning && "border-warning/30 bg-warning/5 text-warning",
        type === "info" && "border-border/80 bg-muted/40 text-foreground",
        className,
      )}
    >
      <CardContent className="flex items-start gap-3 p-3.5">
        <div className="mt-0.5 shrink-0">
          {type === "error" && <AlertCircle className="size-4 text-destructive" />}
          {type === "quota" && <Clock className="size-4 text-warning" />}
          {type === "stale" && <AlertTriangle className="size-4 text-warning" />}
          {type === "info" && <Info className="size-4 text-primary" />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-xs font-semibold leading-tight text-foreground">{title}</div>
          {message && (
            <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap break-words">
              {message}
            </p>
          )}
          {action && (
            <div className="pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={action.onClick}
                className="h-7 text-xs"
              >
                {action.label}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
