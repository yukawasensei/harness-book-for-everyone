import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Composer } from "./Composer";

const SAMPLE_PROMPTS = [
  {
    title: "科幻悬疑 · 深空孤舰",
    desc: "深空货运站接收到一段来自二十年前的求救信号，信号源就在密封货舱内。",
    prompt: "拍摄一部科幻悬疑短片：深空货运站接收到一段来自二十年前的求救信号，信号源就在密封货舱内。",
  },
  {
    title: "温情治愈 · 老钟表店",
    desc: "退休老店主在关店前最后一位避雨客人身上，认出了早年寄存在店里的怀表与琴谱。",
    prompt: "拍摄一部温情治愈短片：退休老店主在关店前最后一位避雨客人身上，认出了早年寄存在店里的怀表与琴谱。",
  },
  {
    title: "中式悬疑 · 雨夜古渡",
    desc: "暴雨夜的末班渡船载着四位各怀心事的归乡客，渡河途中船灯突然熄灭。",
    prompt: "拍摄一部中式悬疑短片：暴雨夜的末班渡船载着四位各怀心事的归乡客，渡河途中船灯突然熄灭。",
  },
];

export function EmptyState({
  onSend,
  sending,
  errorMessage,
  onSelectPrompt,
}: {
  onSend?: (text: string) => Promise<void> | void;
  sending?: boolean;
  errorMessage?: string;
  onSelectPrompt?: (text: string) => void;
}) {
  const [text, setText] = useState("");

  function handleSelectSample(prompt: string) {
    setText(prompt);
    onSelectPrompt?.(prompt);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-8 text-center">
      <div className="space-y-2">
        <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full">
          <Sparkles className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          你想拍一部什么样的短片？
        </h1>
      </div>

      {onSend && (
        <div className="w-full text-left">
          <Composer
            value={text}
            onChange={setText}
            onSend={async (content) => {
              await onSend(content);
              setText("");
            }}
            placeholder="描述你想拍的短片…"
            sending={sending}
            errorMessage={errorMessage}
            className="rounded-xl border border-border/80 bg-card p-3 shadow-xs"
          />
        </div>
      )}

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        {SAMPLE_PROMPTS.map(sample => (
          <button
            key={sample.title}
            type="button"
            onClick={() => handleSelectSample(sample.prompt)}
            className="group text-left focus-visible:outline-none"
          >
            <Card className="hover:border-primary/50 hover:bg-accent/40 h-full transition-all">
              <CardContent className="flex flex-col gap-1.5 p-4">
                <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                  {sample.title}
                </span>
                <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
                  {sample.desc}
                </p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
        AI 会按 选题→梗概→剧本→设定集→分镜→提示词 逐道交稿，每道等你确认。
      </p>
    </div>
  );
}
