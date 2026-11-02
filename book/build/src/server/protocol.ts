import type { Stage } from "../contracts/index.js";
import type { Project } from "../project/store.js";
import type { runStage } from "../agent/run.js";

export interface RunInfo {
  id: string;
  stage: Stage;
  started_at: string;
  abort_requested: boolean;
}
export type RunResult = RunInfo & Awaited<ReturnType<typeof runStage>>;
export interface ProjectDetail extends Project {
  running: RunInfo | null;
  last_run: RunResult | null;
  run_blocked_reasons: Record<Stage, string | null>;
}
export interface ServerConfig {
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
  | { type: "project_state"; project: ProjectDetail }
  | { type: "run_started"; run: RunInfo }
  | { type: "run_ended"; run: RunResult };
