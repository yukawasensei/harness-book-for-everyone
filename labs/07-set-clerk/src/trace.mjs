/**
 * Minimal Trace writer: JSONL events for stub runs.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function createTraceSession({ skill, caseId, tracePath }) {
  mkdirSync(dirname(tracePath), { recursive: true });
  writeFileSync(tracePath, "", "utf8");
  const rows = [];

  function emit(event) {
    const row = { ts: new Date().toISOString(), skill, caseId, ...event };
    rows.push(row);
    appendFileSync(tracePath, JSON.stringify(row) + "\n", "utf8");
    return row;
  }

  emit({ eventType: "harness_start", skill });

  return {
    emit,
    writeEvent({ path, bytes }) {
      return emit({ eventType: "write", path, bytes });
    },
    end({ stop_reason = "success", extra = {} } = {}) {
      return emit({ eventType: "harness_end", stop_reason, ...extra });
    },
    rows,
    tracePath,
  };
}
