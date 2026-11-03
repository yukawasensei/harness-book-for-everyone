import { ChevronDown, Maximize2 } from "lucide-react";
import type { Stage } from "../../../../../src/contracts/index.js";
import type { StageState } from "../../../../../src/workflow/index.js";
import type { ProjectDetail } from "../../../../../src/server/protocol.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatLocalDateTime } from "@/lib/format/date-time.js";
import { reviewLabels, stageNames } from "../lib/presentation.js";

export function VersionPicker({
  project,
  stage,
  versions,
  version,
  state,
  canExpand,
  onVersionChange,
  onExpand,
  extraActions,
}: {
  project?: ProjectDetail | null;
  stage: Stage;
  versions: number[];
  version: number | null;
  state?: StageState;
  canExpand: boolean;
  onVersionChange: (version: number | null) => void;
  onExpand: () => void;
  extraActions?: React.ReactNode;
}) {
  const currentStatus = version !== null ? (state?.reviews?.[version]?.status ?? "pending") : "pending";
  const basis = version !== null && project ? project.provenance?.[stage]?.[version]?.based_on : undefined;
  const basisText = version !== null
    ? basis
      ? `基于 ${Object.entries(basis).map(([s, v]) => `${stageNames[s as Stage]} v${v}`).join(" · ") || "无上游依赖"}`
      : "未知来源 · 此版本未记录依赖版本"
    : null;
  const confirmation = version !== null && project ? project.provenance?.[stage]?.[version]?.validity_confirmation : undefined;
  const isAdopted = state?.adopted_version === version && version !== null;

  return (
    <div className="border-border/60 bg-card/60 space-y-2 border-b p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {versions.length > 0 && version !== null ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                  aria-label="选择产物版本"
                >
                  <span>v{version} · {reviewLabels[currentStatus]}</span>
                  <ChevronDown className="size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-36">
                {versions.map(v => {
                  const vStatus = state?.reviews?.[v]?.status ?? "pending";
                  const isCurrent = v === version;
                  return (
                    <DropdownMenuItem
                      key={v}
                      onClick={() => onVersionChange(v)}
                      className="justify-between text-xs"
                    >
                      <span className={isCurrent ? "font-semibold" : undefined}>
                        v{v} · {reviewLabels[vStatus]}
                      </span>
                      {state?.adopted_version === v && (
                        <span className="text-primary text-[10px]">采用中</span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" disabled className="h-8 text-xs">
              暂无草稿
            </Button>
          )}

          {isAdopted && (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
              当前采用
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canExpand}
            onClick={onExpand}
            className="h-8 gap-1 px-2.5 text-xs"
            aria-label="放大预览"
          >
            <Maximize2 className="size-3.5" />
            <span className="hidden sm:inline">放大预览</span>
          </Button>
          {extraActions}
        </div>
      </div>

      {basisText && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span>{basisText}</span>
          {state?.adopted_version != null && !isAdopted && (
            <span>· 当前采用：v{state.adopted_version}</span>
          )}
        </div>
      )}

      {confirmation && (
        <div className="rounded-md border border-border/80 bg-muted/40 p-2 text-xs space-y-0.5">
          <p className="text-foreground">有效理由：{confirmation.reason}</p>
          <p className="text-muted-foreground text-[11px]">
            确认时间：<time dateTime={confirmation.at}>{formatLocalDateTime(confirmation.at)}</time>
          </p>
        </div>
      )}
    </div>
  );
}
