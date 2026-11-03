import { useState, useRef, type KeyboardEvent, type FormEvent } from "react";
import { AlertCircle, ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function Composer({
  value,
  onChange,
  onSend,
  onAbort,
  placeholder = "描述你想拍的短片，例如题材、主角或一个画面…",
  running,
  sending,
  errorMessage,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  onSend: (text: string) => Promise<void> | void;
  onAbort?: () => void;
  placeholder?: string;
  running?: boolean;
  sending?: boolean;
  errorMessage?: string;
  className?: string;
}) {
  const isComposingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = value.trim();
    if (!text || running || sending || submitting) return;
    setSubmitting(true);
    try {
      await onSend(text);
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // 中文输入法组字时按 Enter 不发送
    if (e.key === "Enter" && !e.shiftKey) {
      if (isComposingRef.current || e.nativeEvent.isComposing) {
        return;
      }
      e.preventDefault();
      void handleSubmit();
    }
  }

  const disabled = !!running || !!sending || submitting;

  return (
    <div className={cn("border-border/80 bg-background/95 border-t p-3 backdrop-blur-xs space-y-2", className)}>
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={e => void handleSubmit(e)} className="space-y-2">
        <div className="relative">
          <Textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            placeholder={placeholder}
            maxLength={8000}
            disabled={disabled}
            rows={3}
            className="resize-none pr-12 text-xs sm:text-sm shadow-xs"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">
            {running ? "正在运行…" : "Enter 发送 · Shift+Enter 换行"}
          </span>
          <div className="flex items-center gap-2">
            {running && onAbort && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onAbort}
                disabled={sending}
                aria-label="在输入区中断运行"
                className="gap-1 h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <Square className="size-3 fill-current" /> 中断
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={disabled || !value.trim()}
              className="gap-1 h-8 px-3 text-xs"
            >
              <ArrowUp className="size-3.5" />
              <span>{sending || submitting ? "发送中…" : "发送"}</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
