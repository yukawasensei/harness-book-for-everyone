import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { splitFinalPrompt } from "./prompt-split";

export function BoardPromptSection({
  shotId,
  shotPart,
  finalPrompt,
}: {
  shotId: string;
  shotPart: string;
  finalPrompt: string;
}) {
  const [copied, setCopied] = useState(false);
  const { modelPart, injectedPart } = splitFinalPrompt(finalPrompt, shotPart);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(finalPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2 pt-1 border-t border-border/60">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-foreground">画面提示词</h4>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          aria-label={`复制 ${shotId} 提示词`}
          onClick={() => void handleCopy()}
        >
          {copied ? (
            <>
              <Check className="size-3 text-success shrink-0" />
              <span className="text-success font-medium">已复制</span>
            </>
          ) : (
            <>
              <Copy className="size-3 shrink-0" />
              <span>复制提示词</span>
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2 text-xs">
        <section
          aria-label="镜头描写（AI 编写）"
          className="prompt-model rounded-md border border-model/30 bg-model/5 p-2.5 space-y-1"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-model">
            <span className="size-1.5 rounded-full bg-model shrink-0" aria-hidden="true" />
            <span>蓝色：镜头描写（AI 编写）</span>
          </div>
          <p className="text-foreground leading-relaxed whitespace-pre-wrap break-words">
            {modelPart}
          </p>
        </section>

        {injectedPart && (
          <section
            aria-label="角色与场景外观（设定集原样带入）"
            className="prompt-injected rounded-md border border-injected/30 bg-injected/5 p-2.5 space-y-1"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-injected">
              <span className="size-1.5 rounded-full bg-injected shrink-0" aria-hidden="true" />
              <span>绿色：角色与场景外观（设定集原样带入）</span>
            </div>
            <p className="text-foreground leading-relaxed whitespace-pre-wrap break-words">
              {injectedPart}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
