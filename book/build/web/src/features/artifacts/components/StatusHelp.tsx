import { useEffect, useId, useRef, useState } from "react";
import { stageStatusHelp } from "../lib/presentation.js";

/** 阶段状态词：悬停看说明，点击/触屏也可展开。 */
export function StatusHelp({ text, className }: { text: string; className: string }) {
  const help = stageStatusHelp(text);
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  if (!help) return <span className={`badge text-[10px] text-muted-foreground ${className}`}>{text}</span>;
  return (
    <span className="status-help relative max-w-full shrink-0" ref={root}>
      <button
        type="button"
        className={`badge status-help-trigger rounded px-1.5 py-0.5 text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 ${className}`}
        title={help}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onClick={event => { event.stopPropagation(); setOpen(value => !value); }}
      >
        {text}
      </button>
      {open && <span id={tipId} role="tooltip" className="status-help-tip absolute top-[calc(100%+4px)] right-0 z-5 max-w-[min(220px,70vw)] rounded-md bg-foreground px-2.5 py-2 text-xs leading-snug text-background shadow-md">{help}</span>}
    </span>
  );
}
