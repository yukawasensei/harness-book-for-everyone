// Ch2 · Trace：把 Agent 事件压成一行一条的 JSONL，作为验收证据。
// Ch3 · 增量：记下模型发出的原始参数（tool_execution_start.args，校验前）、executor 收到的类型
//（tool_execution_end.details）和助手最终说的话（text），用来对比“口头陈述 vs 真实 toolCall”。
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type StopReason = "success" | "model_error";

export type TraceRow = {
  timestamp: string;
  eventType: string;
  [key: string]: unknown;
};

const MAX_TEXT_CHARS = 500;

function assistantText(message: unknown): string | undefined {
  const content = (message as { content?: unknown })?.content;
  if (!Array.isArray(content)) return undefined;
  const text = content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("")
    .trim();
  return text ? text.slice(0, MAX_TEXT_CHARS) : undefined;
}

/** 只保留验收需要的字段，不把整段模型输出塞进 trace。 */
export function toTraceRow(event: { type: string; [key: string]: unknown }, now = new Date()): TraceRow {
  const row: TraceRow = { timestamp: now.toISOString(), eventType: event.type };
  const message = event.message as { role?: string } | undefined;
  if ((event.type === "message_start" || event.type === "message_end") && message?.role) {
    row.role = message.role;
  }
  if (event.type === "message_end" && message?.role === "assistant") {
    const text = assistantText(message);
    if (text) row.text = text;
  }
  if (event.type === "tool_execution_start" || event.type === "tool_execution_end") {
    row.toolName = event.toolName;
    row.toolCallId = event.toolCallId;
  }
  if (event.type === "tool_execution_start") {
    row.args = event.args;
  }
  if (event.type === "tool_execution_end") {
    row.isError = event.isError;
    // executor 自己报告的 details（例如 receivedType）：校验/类型转换之后，executor 真正拿到了什么。
    const details = (event.result as { details?: unknown } | undefined)?.details;
    if (details && typeof details === "object") row.details = details;
  }
  return row;
}

export function createTraceWriter(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "", "utf8");
  return (row: TraceRow) => appendFileSync(path, `${JSON.stringify(row)}\n`, "utf8");
}
