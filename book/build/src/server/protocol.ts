import type { Stage } from "../contracts/index.js";
import type { Project } from "../project/store.js";
import type { runStage } from "../agent/run.js";
import type { Basis } from "../project/provenance.js";
import type { ProjectStore } from "../project/store.js";

export type TranscriptItem =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; label: string; args_summary: string; ok: boolean; error?: string };
interface TimelineBase { id: string; at: string }
export type TimelineItem = TimelineBase & (
  | { kind: "user_message"; text: string }
  | { kind: "assistant_note"; text: string }
  | { kind: "run"; run_id: string; stage: Stage; revise_from?: number; status: "running" | "done" | "failed" | "interrupted"; stop_reason?: string; version?: number; transcript?: TranscriptItem[] }
  | { kind: "review_request"; stage: Stage; version: number }
  | { kind: "review_decision"; stage: Stage; version: number; decision: "adopted" | "discarded" | "changes_requested"; note?: string }
);
export interface TimelineResponse { items: TimelineItem[] }
export type MessageAction = "revise" | "run" | "none";
export interface MessageResponse { action: MessageAction; item: TimelineItem; run?: RunInfo }

export interface RunInfo {
  id: string;
  stage: Stage;
  started_at: string;
  abort_requested: boolean;
}
type StageResult = Awaited<ReturnType<typeof runStage>>;
// 中断恢复与旧会话可能没有用量摘要；缺失不补成 0。
export type RunOutcome = Pick<StageResult, "stop_reason" | "errors"> & Partial<Omit<StageResult, "stop_reason" | "errors">>;
export type RunResult = RunInfo & RunOutcome;
export interface ProjectDetail extends Project {
  updated_at: string;
  running: RunInfo | null;
  last_run: RunResult | null;
  run_blocked_reasons: Record<Stage, string | null>;
  staging?: Partial<Record<Stage, { count: number; revise_from: number | null; based_on: Basis } | null>>;
  bible_impact?: ReturnType<ProjectStore["bibleImpact"]>;
  reassemble_reason?: string | null;
}
export interface ServerConfig {
  deployment?: "local" | "hosted";
  user_id?: string;
  mode: "demo" | "model";
  runnable_stages: Stage[];
}
type SessionEvent = (
  | { type: "agent_start" | "agent_end" }
  | { type: "message_update"; assistantMessageEvent: { type: "text_delta"; delta: string; contentIndex: number } }
  | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool_execution_update"; toolCallId: string; toolName: string; partialResult: unknown }
  | { type: "tool_execution_end"; toolCallId: string; toolName: string; result: unknown; isError: boolean }
) & { stage: Stage; run_id: string };
export type ProjectEvent = SessionEvent
  | { type: "timeline_item"; item: TimelineItem }
  | { type: "staging_restored"; stage: Stage; run_id: string; ids: string[]; unit: "场" | "镜" }
  | { type: "project_state"; project: ProjectDetail }
  | { type: "run_started"; run: RunInfo }
  | { type: "run_ended"; run: RunResult };
