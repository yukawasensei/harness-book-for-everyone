import { MoreHorizontal, Star, RefreshCw, CheckCircle, Layers, Download } from "lucide-react";
import type { Stage } from "../../../../../src/contracts/index.js";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MoreActionsMenu({
  busy,
  hasVersion,
  isStale,
  stage,
  runReason,
  reassembleReason,
  hasRating,
  onOpenRating,
  onRun,
  onConfirmValid,
  onReassemble,
  onExport,
}: {
  busy?: boolean;
  hasVersion: boolean;
  isStale?: boolean;
  stage: Stage;
  runReason: string | null;
  reassembleReason: string | null;
  hasRating?: boolean;
  onOpenRating: () => void;
  onRun: () => void;
  onConfirmValid: () => void;
  onReassemble: () => void;
  onExport: () => void;
}) {
  const busyReason = busy ? "项目正在运行或提交操作，请稍候。" : null;
  const runDisabled = Boolean(busyReason ?? runReason);
  const reassembleDisabled = stage !== "board" || Boolean(busyReason ?? reassembleReason);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 px-2.5 text-xs"
          aria-label="更多操作"
        >
          <MoreHorizontal className="size-3.5" />
          <span>更多</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">操作</DropdownMenuLabel>
        {stage === "board" && (
          <DropdownMenuItem disabled={!hasVersion || busy} onClick={onExport} className="gap-2 text-xs">
            <Download className="size-3.5 shrink-0" />
            <span>导出 Markdown</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={!hasVersion || busy}
          onClick={onOpenRating}
          className="gap-2 text-xs"
        >
          <Star className="size-3.5 shrink-0" />
          <span>{hasRating ? "修改评分" : "产物评分"}</span>
        </DropdownMenuItem>

        {isStale && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-warning">待更新处理</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={runDisabled}
              onClick={onRun}
              title={busyReason ?? runReason ?? "使用当前上游重新创作，生成新版本"}
              className="gap-2 text-xs"
            >
              <RefreshCw className="size-3.5 shrink-0" />
              <span>返工运行</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={runDisabled}
              onClick={onConfirmValid}
              title={busyReason ?? runReason ?? "填写理由，保留内容并更新来源"}
              className="gap-2 text-xs"
            >
              <CheckCircle className="size-3.5 shrink-0" />
              <span>确认仍然有效</span>
            </DropdownMenuItem>
            {stage === "board" && (
              <DropdownMenuItem
                disabled={reassembleDisabled}
                onClick={onReassemble}
                title={busyReason ?? reassembleReason ?? "沿用镜头部分、更新固定设定，不调用模型"}
                className="gap-2 text-xs"
              >
                <Layers className="size-3.5 shrink-0" />
                <span>重新拼装</span>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
