import type { ReactElement } from "react";
import type { TranscriptItem } from "../../../../../src/server/protocol.js";
import type { TimelineRow } from "./append-event.js";
import { foldSelfCorrectionLiveRows, foldSelfCorrectionTranscript } from "./self-correction.js";
import { AssistantText } from "../components/AssistantText";
import { ToolCallCard } from "../components/ToolCallCard";
import { SystemNotice } from "../components/SystemNotice";
import { SelfCorrectionCard } from "../components/SelfCorrectionCard";

function renderTranscriptItem(runId: string, t: TranscriptItem, idx: number): ReactElement {
  if (t.type === "tool") {
    return (
      <ToolCallCard
        key={`${runId}:tool:${idx}`}
        name={t.name}
        label={t.label}
        status={t.ok ? "success" : "error"}
        args_summary={t.args_summary}
        error={t.error}
      />
    );
  }
  return <AssistantText key={`${runId}:text:${idx}`} text={t.text} />;
}

export function renderRunTranscript(runId: string, transcript: TranscriptItem[]): ReactElement[] {
  return foldSelfCorrectionTranscript(transcript).flatMap((segment, segIdx) => {
    if (segment.kind === "plain") {
      return segment.items.map((item, idx) =>
        renderTranscriptItem(runId, item as TranscriptItem, segIdx * 1000 + idx));
    }
    return [
      <SelfCorrectionCard key={`${runId}:repair:${segIdx}`} reason={segment.reason} attempts={segment.attempts}>
        {segment.items.map((item, idx) =>
          renderTranscriptItem(runId, item as TranscriptItem, segIdx * 1000 + idx))}
      </SelfCorrectionCard>,
    ];
  });
}

function renderLiveRow(row: TimelineRow): ReactElement | null {
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
    return <SystemNotice key={row.id} type="info" title={row.text} message={row.details?.join("\n")} />;
  }
  return null;
}

export function renderLiveRows(liveRows: TimelineRow[]): Array<ReactElement | null> {
  return foldSelfCorrectionLiveRows(liveRows).flatMap((segment, segIdx) => {
    if (segment.kind === "plain") return segment.items.map(renderLiveRow);
    const key = segment.items.find(row => row.kind === "tool")?.id ?? `live-repair:${segIdx}`;
    return [
      <SelfCorrectionCard key={`live-repair:${key}`} reason={segment.reason} attempts={segment.attempts}>
        {segment.items.map(renderLiveRow)}
      </SelfCorrectionCard>,
    ];
  });
}
