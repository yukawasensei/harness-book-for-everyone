// Ch2 · Trace：把 Agent 事件压成一行一条的 JSONL，作为验收证据。
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type StopReason = "success" | "model_error";

export type TraceRow = {
  timestamp: string;
  eventType: string;
  [key: string]: unknown;
};

/** 只保留验收需要的字段，不把整段模型输出塞进 trace。 */
export function toTraceRow(event: { type: string; [key: string]: unknown }, now = new Date()): TraceRow {
  const row: TraceRow = { timestamp: now.toISOString(), eventType: event.type };
  const message = event.message as { role?: string } | undefined;
  if ((event.type === "message_start" || event.type === "message_end") && message?.role) {
    row.role = message.role;
  }
  if (event.type === "tool_execution_start" || event.type === "tool_execution_end") {
    row.toolName = event.toolName;
    row.toolCallId = event.toolCallId;
  }
  if (event.type === "tool_execution_end") {
    row.isError = event.isError;
  }
  return row;
}

export function createTraceWriter(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "", "utf8");
  return (row: TraceRow) => appendFileSync(path, `${JSON.stringify(row)}\n`, "utf8");
}
