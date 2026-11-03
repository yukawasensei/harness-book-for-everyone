import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { Artifacts, SceneChanges } from "../../../../../src/contracts/index.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PromptPreview({
  value,
  revision,
  footer,
}: {
  value: Artifacts["board"];
  revision?: SceneChanges;
  footer?: React.ReactNode;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyPrompt(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  }

  const changed = new Set(revision?.revise_from ? revision.resubmitted : []);

  return (
    <div className="space-y-3 text-xs break-words min-w-0 max-w-full">
      <p className="text-muted-foreground">
        共 {value.shots.length} 镜 · 蓝色为模型创作，绿色为程序注入。请核对动作与固定设定是否冲突。
      </p>
      {revision?.revise_from && (
        <p className="bg-primary/10 text-primary rounded-md px-2.5 py-1 text-xs">
          高亮：本版重交的场次；其余场次沿用原稿。
        </p>
      )}
      <div className="grid gap-3">
        {value.shots.map(item => {
          const injectedPart = item.final_prompt.slice(`[镜头] ${item.shot_part}\n`.length);
          const isCopied = copiedId === item.shot_id;
          return (
            <article
              key={item.shot_id}
              aria-label={`${item.shot_id} 提示词`}
              className={changed.has(item.scene_id) ? "prompt-card scene-revised" : "prompt-card"}
            >
              <div className={cn(
                "rounded-lg border border-border/80 bg-card p-3 space-y-2.5",
                changed.has(item.scene_id) && "border-primary/40 bg-accent/20",
              )}>
                <header className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-foreground">{item.shot_id}</h3>
                    {changed.has(item.scene_id) && <Badge variant="secondary" className="text-[10px]">本版重交</Badge>}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-[11px]"
                    aria-label={`复制 ${item.shot_id} 完整提示词`}
                    onClick={() => void copyPrompt(item.shot_id, item.final_prompt)}
                  >
                    {isCopied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                    <span>{isCopied ? "已复制" : "复制完整提示词"}</span>
                  </Button>
                </header>
                <section aria-label="模型写的部分" className="prompt-model rounded-md border border-model/30 bg-model/5 p-2.5 space-y-1">
                  <h4 className="text-model text-[11px] font-semibold">模型写的部分</h4>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap break-words">[镜头] {item.shot_part}</p>
                </section>
                <section aria-label="程序注入的部分" className="prompt-injected rounded-md border border-injected/30 bg-injected/5 p-2.5 space-y-1">
                  <h4 className="text-injected text-[11px] font-semibold">程序注入的部分</h4>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap break-words">{injectedPart}</p>
                </section>
              </div>
            </article>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
