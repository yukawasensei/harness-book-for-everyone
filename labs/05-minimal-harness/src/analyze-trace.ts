import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface TraceRow {
  timestamp: string;
  eventType: string;
  role?: string;
  toolName?: string;
  toolCallId?: string;
  isError?: boolean;
  durationMs?: number | null;
  stop_reason?: string;
  turnCount?: number;
  maxTurns?: number;
}

if (process.platform !== "linux") {
  throw new Error("Trace analysis must run inside WSL2/Linux, not Windows");
}

const tracePath = resolve(process.cwd(), "traces/latest.jsonl");
const rows = readFileSync(tracePath, "utf8")
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line) as TraceRow);

const lifecycleRows = rows.filter((row) => row.eventType !== "message_update");

for (const [index, row] of lifecycleRows.entries()) {
  const details = [
    row.role === undefined ? undefined : `role=${row.role}`,
    row.toolName === undefined ? undefined : `tool=${row.toolName}`,
    row.toolCallId === undefined ? undefined : `id=${row.toolCallId}`,
    row.isError === undefined ? undefined : `isError=${row.isError}`,
    row.durationMs === undefined ? undefined : `durationMs=${row.durationMs}`,
    row.stop_reason === undefined ? undefined : `stop_reason=${row.stop_reason}`,
    row.turnCount === undefined ? undefined : `turnCount=${row.turnCount}`,
    row.maxTurns === undefined ? undefined : `maxTurns=${row.maxTurns}`,
  ].filter((value): value is string => value !== undefined);

  console.log(
    `${String(index + 1).padStart(2, "0")} ${row.eventType}${details.length === 0 ? "" : ` ${details.join(" ")}`}`,
  );
}

const agentRuns = rows.filter((row) => row.eventType === "agent_start").length;
const turns = rows.filter((row) => row.eventType === "turn_start").length;
const toolCalls = rows.filter((row) => row.eventType === "tool_execution_start").length;
const toolErrors = rows.filter(
  (row) => row.eventType === "tool_execution_end" && row.isError === true,
).length;
const agentEnded = rows.some((row) => row.eventType === "agent_end");
const harnessEnd = rows.find((row) => row.eventType === "harness_end" || row.eventType === "harness_stop");
const stopReason = harnessEnd?.stop_reason ?? "unknown";

if (agentRuns !== 1 || !agentEnded) {
  throw new Error("Trace is incomplete: expected one agent_start and one agent_end");
}

console.log(
  `SUMMARY runtime=${process.platform} agentRuns=${agentRuns} turns=${turns} toolCalls=${toolCalls} toolErrors=${toolErrors} stop_reason=${stopReason}`,
);
