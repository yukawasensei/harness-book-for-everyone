import { useState } from "react";
import { Download } from "lucide-react";
import type { Board } from "../../../../../../src/contracts/index.js";
import { Button } from "@/components/ui/button";
import { downloadBoard } from "../../lib/download-board";

export function BoardToolbar({
  board,
  projectId,
  version,
  onExport,
  isRevised,
}: {
  board: Board;
  projectId?: string;
  version?: number | null;
  onExport?: () => void;
  isRevised?: boolean;
}) {
  const [exporting, setExporting] = useState(false);
  const totalDuration = board.shots.reduce((sum, shot) => sum + shot.duration_s, 0);
  const canExport = Boolean(onExport || (projectId && version != null));

  async function handleExport() {
    setExporting(true);
    try {
      if (onExport) {
        onExport();
      } else if (projectId && version !== undefined && version !== null) {
        await downloadBoard(projectId, version);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-2 border-b border-border/70 pb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">
          共 {board.shots.length} 镜 · 合计 {totalDuration} 秒
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={exporting || !canExport}
          onClick={() => void handleExport()}
          className="h-8 gap-1.5 px-3 text-xs"
          title={canExport ? "导出包含全部镜头的景别、动作、对白、时长与完整画面提示词。" : "请先选择项目中的分镜板版本再导出。"}
        >
          <Download className="size-3.5 shrink-0" />
          <span>{exporting ? "正在导出…" : "导出分镜板"}</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-model shrink-0" aria-hidden="true" />
          <span className="text-model font-medium">蓝色：镜头描写（AI 编写）</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-injected shrink-0" aria-hidden="true" />
          <span className="text-injected font-medium">绿色：角色与场景外观（设定集原样带入）</span>
        </span>
      </div>

      {isRevised && (
        <p className="rounded-md bg-primary/10 px-2.5 py-1 text-xs text-primary">
          高亮：本版重交的场次；其余场沿用原稿。
        </p>
      )}
    </div>
  );
}
