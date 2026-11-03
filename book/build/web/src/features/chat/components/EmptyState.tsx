import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Composer } from "./Composer";

const SAMPLE_PROMPTS = [
  {
    title: "修表匠",
    desc: "修表匠在旧怀表里发现一张未寄出的车票，决定替陌生人走完那趟旅程。",
    prompt: "修表匠在旧怀表里发现一张未寄出的车票，决定替陌生人走完那趟旅程。",
  },
  {
    title: "停电便利店",
    desc: "停电的便利店里，夜班店员和一位声称来自明天的顾客核对收银条。",
    prompt: "停电的便利店里，夜班店员和一位声称来自明天的顾客核对收银条。",
  },
  {
    title: "退休气象员",
    desc: "退休气象员独自守着山顶观测站，在撤站前一天迎来了多年未见的大雪。",
    prompt: "退休气象员独自守着山顶观测站，在撤站前一天迎来了多年未见的大雪。",
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
            placeholder="描述你想拍的短片，例如题材、主角或一个画面…"
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
        说一句想法，织影按「故事 → 剧本 → 设定集 → 分镜板」逐道交稿，每一步等你签字确认后再往下走。
      </p>
    </div>
  );
}
