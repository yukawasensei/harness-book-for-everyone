import { readFileSync } from "node:fs";

export function loadTrace(tracePath) {
  return readFileSync(tracePath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

export function summarizeTrace(rows) {
  const toolNames = rows
    .filter((row) => row.eventType === "tool_execution_start")
    .map((row) => row.toolName)
    .filter(Boolean);
  const endRow = [...rows]
    .reverse()
    .find((row) => row.eventType === "harness_end" || row.eventType === "harness_stop");
  return {
    toolNames,
    stopReason: endRow?.stop_reason ?? null,
    turnCount: endRow?.turnCount ?? null,
    maxTurns: endRow?.maxTurns ?? null,
  };
}

export function assertExpect(expect, summary) {
  const failures = [];
  const { toolNames, stopReason } = summary;

  if (expect.stop_reason !== undefined && stopReason !== expect.stop_reason) {
    failures.push(`stop_reason want=${expect.stop_reason} got=${stopReason}`);
  }
  if (expect.stop_reason_in !== undefined && !expect.stop_reason_in.includes(stopReason)) {
    failures.push(`stop_reason ${stopReason} not in ${JSON.stringify(expect.stop_reason_in)}`);
  }
  if (expect.tool_names_include) {
    for (const name of expect.tool_names_include) {
      if (!toolNames.includes(name)) {
        failures.push(`missing tool ${name}; saw ${JSON.stringify(toolNames)}`);
      }
    }
  }
  if (expect.tool_names_exclude) {
    for (const name of expect.tool_names_exclude) {
      if (toolNames.includes(name)) {
        failures.push(`forbidden tool present: ${name}`);
      }
    }
  }
  return failures;
}
