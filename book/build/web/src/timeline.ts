import type { ProjectEvent } from "../../src/server/protocol.js";
import { runSummary, stageNames } from "./presentation.js";

export type TimelineRow =
  | { kind: "text" | "user" | "note"; id: string; text: string; at?: string; details?: string[] }
  | { kind: "tool"; id: string; name: string; args: unknown; status: "running" | "success" | "error" | "unknown"; result?: unknown };

export function appendEvent(rows: TimelineRow[], event: ProjectEvent): TimelineRow[] {
  // 页面只保留最近 300 个块；完整会话由服务端 sessions 保存。
  rows = rows.slice(-299);
  switch (event.type) {
    case "run_started": return [...rows, { kind: "note", id: event.run.id, text: `开始${stageNames[event.run.stage]}`, at: event.run.started_at }];
    case "staging_restored": return [...rows, { kind: "note", id: `${event.run_id}:restored`, text: `已从暂存恢复 ${event.ids.length} ${event.unit}：${event.ids.join("、") || "无"}` }];
    case "project_state": return event.project.running ? rows : settleTools(rows);
    case "run_ended": return [...settleTools(rows), {
      kind: "note", id: `${event.run.id}:end`,
      text: `${stageNames[event.run.stage]} · ${runSummary(event.run).text}`,
      details: event.run.errors,
    }];
    case "message_update": {
      const previous = rows.at(-1);
      if (previous?.kind === "text" && previous.id.startsWith(`${event.run_id}:text:`)) {
        return [...rows.slice(0, -1), { ...previous, text: previous.text + event.assistantMessageEvent.delta }];
      }
      return [...rows, { kind: "text", id: `${event.run_id}:text:${rows.length}`, text: event.assistantMessageEvent.delta }];
    }
    case "tool_execution_start": return [...rows, {
      kind: "tool", id: `${event.run_id}:${event.toolCallId}`, name: event.toolName, args: event.args, status: "running",
    }];
    case "tool_execution_end": {
      const id = `${event.run_id}:${event.toolCallId}`;
      const existing = rows.find(row => row.id === id);
      const tool: TimelineRow = {
        kind: "tool", id, name: event.toolName, args: existing?.kind === "tool" ? existing.args : "连接中断，参数未收到",
        status: event.isError ? "error" : "success", result: event.result,
      };
      return existing ? rows.map(row => row.id === id ? tool : row) : [...rows, tool];
    }
    default: return rows;
  }
}

function settleTools(rows: TimelineRow[]): TimelineRow[] {
  return rows.map(row => row.kind === "tool" && row.status === "running" ? { ...row, status: "unknown" } : row);
}
