import { useEffect, useId, useRef, useState } from "react";
import { stageStatusHelp } from "./presentation";

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
  if (!help) return <span className={`badge ${className}`}>{text}</span>;
  return (
    <span className="status-help" ref={root}>
      <button
        type="button"
        className={`badge status-help-trigger ${className}`}
        title={help}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onClick={event => { event.stopPropagation(); setOpen(value => !value); }}
      >
        {text}
      </button>
      {open && <span id={tipId} role="tooltip" className="status-help-tip">{help}</span>}
    </span>
  );
}
