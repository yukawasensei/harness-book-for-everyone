import { useEffect, useRef, useState } from "react";
import type { Stage } from "../../../../../src/contracts/index.js";
import type { ProjectDetail, TimelineItem } from "../../../../../src/server/protocol.js";
import type { TimelineRow } from "../lib/append-event.js";
import { renderLiveRows, renderRunTranscript } from "../lib/render-timeline.js";
import { progressChip } from "@/features/artifacts";
import { EmptyState } from "./EmptyState";
import { UserMessage } from "./UserMessage";
import { AssistantText } from "./AssistantText";
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

function openChipArtifact(
  project: ProjectDetail,
  onViewArtifact?: (stage: Stage, version: number) => void,
) {
  const chip = progressChip(project);
  const state = project.stages[chip.stage];
  const version = state.adopted_version ?? state.versions[state.versions.length - 1] ?? 1;
  onViewArtifact?.(chip.stage, version);
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
  const chip = project ? progressChip(project) : null;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col" aria-label="对话">
      <div className="border-border/80 flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">对话</h2>
        {connectionLabel && (
          <span className="text-muted-foreground text-xs">{connectionLabel}</span>
        )}
      </div>

      {project && chip && (
        <div className="border-border/60 bg-muted/20 border-b px-4 py-2 lg:hidden">
          <button
            type="button"
            onClick={() => openChipArtifact(project, onViewArtifact)}
            className="hover:bg-accent/70 border-border/70 bg-background/80 text-foreground inline-flex max-w-full items-center rounded-md border px-2.5 py-1 text-xs transition-colors"
            aria-label={`打开产物：${chip.text}`}
          >
            <span className="truncate">{chip.text}</span>
          </button>
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
            return (
              <div key={item.id} className="space-y-3">
                {item.status === "failed" && (
                  <SystemNotice type="error" title={`${item.stage} 运行失败`} message={item.stop_reason} />
                )}
                {renderRunTranscript(item.id, item.transcript ?? [])}
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
                projectId={project?.id}
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

        {renderLiveRows(liveRows)}

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
