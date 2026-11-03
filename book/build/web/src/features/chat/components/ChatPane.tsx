import { useEffect, useRef, useState } from "react";
import type { Stage } from "../../../../../src/contracts/index.js";
import type { ProjectDetail, TimelineItem } from "../../../../../src/server/protocol.js";
import type { TimelineRow } from "../lib/append-event.js";
import { EmptyState } from "./EmptyState";
import { PlanCard } from "./PlanCard";
import { UserMessage } from "./UserMessage";
import { AssistantText } from "./AssistantText";
import { ToolCallCard } from "./ToolCallCard";
import { ReviewCard } from "./ReviewCard";
import { SystemNotice } from "./SystemNotice";
import { RunStatusBar } from "./RunStatusBar";
import { Composer } from "./Composer";

function findDecision(items: TimelineItem[], stage: Stage, version: number) {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item.kind === "review_decision" && item.stage === stage && item.version === version) {
      return item;
    }
  }
  return undefined;
}

export function ChatPane({
  items,
  project,
  loading,
  sending,
  running,
  placeholder,
  connectionLabel,
  errorMessage,
  liveRows = [],
  onSend,
  onAbort,
  onViewArtifact,
  onAdopt,
  onDiscard,
  onRequestChanges,
}: {
  items: TimelineItem[];
  project?: ProjectDetail | null;
  loading?: boolean;
  sending?: boolean;
  running?: boolean;
  placeholder: string;
  connectionLabel?: string;
  errorMessage?: string;
  liveRows?: TimelineRow[];
  onSend: (text: string) => Promise<void> | void;
  onAbort?: () => void;
  onViewArtifact?: (stage: Stage, version: number) => void;
  onAdopt?: (stage: Stage, version: number) => Promise<void> | void;
  onDiscard?: (stage: Stage, version: number) => Promise<void> | void;
  onRequestChanges?: (stage: Stage, version: number, note: string) => Promise<void> | void;
}) {
  const [inputText, setInputText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [items, liveRows, running]);

  async function handleSend(text: string) {
    await onSend(text);
    setInputText("");
  }

  const isEmpty = !loading && !items.length && !liveRows.length;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col" aria-label="对话">
      <div className="border-border/80 flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">对话</h2>
        {connectionLabel && (
          <span className="text-muted-foreground text-xs">{connectionLabel}</span>
        )}
      </div>

      {project && (
        <div className="border-border/60 bg-muted/20 border-b px-4 py-2">
          <PlanCard project={project} />
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-label="时间线">
        {loading && <p className="text-muted-foreground text-xs">正在读取时间线…</p>}

        {isEmpty && <EmptyState onSelectPrompt={text => setInputText(text)} />}

        {items.map(item => {
          if (item.kind === "user_message") {
            return <UserMessage key={item.id} text={item.text} at={item.at} />;
          }
          if (item.kind === "assistant_note") {
            const isNotice = item.text.includes("配额") || item.text.includes("429") || item.text.includes("待更新") || item.text.includes("中断");
            if (isNotice) {
              const noticeType = item.text.includes("429") || item.text.includes("配额") ? "quota" : item.text.includes("待更新") ? "stale" : "error";
              return <SystemNotice key={item.id} type={noticeType} title="系统提示" message={item.text} />;
            }
            return <AssistantText key={item.id} text={item.text} at={item.at} />;
          }
          if (item.kind === "run") {
            const transcript = item.transcript ?? [];
            return (
              <div key={item.id} className="space-y-3">
                {item.status === "failed" && (
                  <SystemNotice type="error" title={`${item.stage} 运行失败`} message={item.stop_reason} />
                )}
                {transcript.map((t, idx) =>
                  t.type === "tool" ? (
                    <ToolCallCard key={`${item.id}:tool:${idx}`} name={t.name} label={t.label} status={t.ok ? "success" : "error"} args_summary={t.args_summary} error={t.error} />
                  ) : (
                    <AssistantText key={`${item.id}:text:${idx}`} text={t.text} />
                  ),
                )}
              </div>
            );
          }
          if (item.kind === "review_request") {
            const decision = findDecision(items, item.stage, item.version);
            return (
              <ReviewCard
                key={item.id}
                stage={item.stage}
                version={item.version}
                decision={decision?.decision}
                note={decision?.note}
                onViewArtifact={onViewArtifact}
                onAdopt={onAdopt}
                onDiscard={onDiscard}
                onRequestChanges={onRequestChanges}
                disabled={running || sending}
              />
            );
          }
          return null;
        })}

        {liveRows.map(row => {
          if (row.kind === "text") return <AssistantText key={row.id} text={row.text} streaming />;
          if (row.kind === "tool") {
            return (
              <ToolCallCard
                key={row.id}
                name={row.name}
                status={row.status}
                args={row.args}
                result={row.result}
              />
            );
          }
          if (row.kind === "note") {
            return (
              <SystemNotice
                key={row.id}
                type="info"
                title={row.text}
                message={row.details?.join("\n")}
              />
            );
          }
          return null;
        })}

        {running && (
          <RunStatusBar
            stage={project?.running?.stage}
            onAbort={onAbort}
            disabled={sending}
          />
        )}

        <div ref={bottomRef} />
      </div>

      <Composer
        value={inputText}
        onChange={setInputText}
        onSend={handleSend}
        onAbort={onAbort}
        placeholder={placeholder}
        running={running}
        sending={sending}
        errorMessage={errorMessage}
      />
    </section>
  );
}
