import { AlertTriangle, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BoardStaleBanner({
  onReassemble,
  disabled,
  disabledReason,
}: {
  onReassemble?: () => void;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
  return (
    <div
      role="status"
      aria-label="待更新提醒"
      className="rounded-lg border border-warning/40 bg-warning/10 p-3.5 space-y-2.5 text-xs text-warning"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="size-4 shrink-0 text-warning mt-0.5" />
        <div className="space-y-1 min-w-0 flex-1">
          <p className="font-medium text-foreground">
            设定集已更新（如修改了角色或场景外观），当前分镜板使用的是旧外观描述。
          </p>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            保留各镜头的景别、动作与镜头描写，由程序直接代入最新设定集外观生成新版本。此步不调用 AI，生成后仍需你采用确认。
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={disabled || !onReassemble}
          title={disabledReason ?? undefined}
          onClick={() => onReassemble?.()}
          className="shrink-0 h-8 gap-1.5 px-3 text-xs"
        >
          <Layers className="size-3.5" />
          <span>重新拼装</span>
        </Button>
      </div>
    </div>
  );
}
