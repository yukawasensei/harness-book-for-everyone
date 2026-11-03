import { useState } from "react";
import { Wrench, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatToolArgs } from "../lib/format-tool-args.js";

const TOOL_NAMES: Record<string, string> = {
  read_upstream: "读取上游产物",
  write_draft: "提交草稿",
  write_scene: "写入场次",
  remove_scene: "删除场次",
  write_scene_shots: "写入分镜",
  remove_scene_shots: "删除分镜",
  write_shot_prompt: "写入镜头提示词",
  list_shots: "列出镜头",
  read_shot: "读取镜头",
  finalize_draft: "完成草稿",
  read_draft: "读取草稿",
  list_artifacts: "查看产物清单",
  inspect_artifacts: "检查产物",
  update_bible: "更新设定集",
  validate: "校验草稿",
  save_draft: "保存草稿",
  check_dependencies: "检查依赖工序",
};

export function ToolCallCard({
  name,
  label,
  status = "success",
  args,
  args_summary,
  error,
  result,
  className,
}: {
  name: string;
  label?: string;
  status?: "running" | "success" | "error" | "unknown";
  args?: unknown;
  args_summary?: string;
  error?: string;
  result?: unknown;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const displayName = label || TOOL_NAMES[name] || name;

  const formatted = formatToolArgs(args ?? args_summary);
  const resultText = error || (typeof result === "string" ? result : result ? JSON.stringify(result, null, 2) : "");
  const hasDetails = formatted.lines.length > 0 || formatted.technical || resultText;

  return (
    <div className={cn("max-w-md w-full", className)}>
      <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border/70 bg-card/60 shadow-xs">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Wrench className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-foreground truncate">{displayName}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {status === "running" && (
                <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
                  <Loader2 className="size-2.5 animate-spin" /> 执行中
                </Badge>
              )}
              {status === "success" && (
                <Badge variant="success" className="gap-1 px-1.5 py-0 text-[10px]">
                  <CheckCircle2 className="size-2.5" /> 成功
                </Badge>
              )}
              {status === "error" && (
                <Badge variant="destructive" className="gap-1 px-1.5 py-0 text-[10px]">
                  <AlertCircle className="size-2.5" /> 失败
                </Badge>
              )}
              {status === "unknown" && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  未知
                </Badge>
              )}
              {open ? <ChevronUp className="size-3 text-muted-foreground" /> : <ChevronDown className="size-3 text-muted-foreground" />}
            </div>
          </button>
        </CollapsibleTrigger>
        {hasDetails && (
          <CollapsibleContent>
            <div className="border-t border-border/50 px-3 py-2 text-xs space-y-2 bg-muted/20">
              {(formatted.lines.length > 0 || formatted.technical) && (
                <div>
                  <span className="text-[10px] text-muted-foreground font-medium">参数摘要</span>
                  {formatted.lines.length > 0 && (
                    <div className="mt-1 space-y-1 rounded bg-muted/60 p-2 text-[11px] text-foreground">
                      {formatted.lines.map(line => (
                        <div key={line.label} className="whitespace-pre-wrap break-all">
                          <span className="text-muted-foreground">{line.label}：</span>
                          {line.value}
                        </div>
                      ))}
                    </div>
                  )}
                  {formatted.technical && (
                    <Collapsible open={techOpen} onOpenChange={setTechOpen} className="mt-1.5">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[10px] transition-colors"
                        >
                          技术详情
                          {techOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="mt-1 max-h-32 overflow-x-auto rounded bg-muted/60 p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
                          {formatted.technical}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}
              {resultText && (
                <div>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {status === "error" ? "失败原因" : "执行结果"}
                  </span>
                  <pre className={cn(
                    "mt-1 max-h-32 overflow-x-auto rounded p-2 font-mono text-[11px] whitespace-pre-wrap break-all",
                    status === "error" ? "bg-destructive/10 text-destructive" : "bg-muted/60 text-foreground",
                  )}>
                    {resultText}
                  </pre>
                </div>
              )}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}
