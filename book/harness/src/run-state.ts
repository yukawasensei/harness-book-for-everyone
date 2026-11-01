// Ch4 · 运行状态：全书唯一记录“为什么停”的地方。第一次 stop() 生效，之后的忽略。
import type { StopReason, TraceRow } from "./trace.js";

export function createRunState(writeTrace: (row: TraceRow) => void) {
  let stopReason: StopReason = "success";
  let stopped = false;
  return {
    get stopReason() {
      return stopReason;
    },
    get stopped() {
      return stopped;
    },
    /** 闸门咬住时调用：写一条 harness_stop，并把 stop_reason 定下来。 */
    stop(reason: Exclude<StopReason, "success">, details: Record<string, unknown> = {}) {
      if (stopped) return;
      stopped = true;
      stopReason = reason;
      writeTrace({ timestamp: new Date().toISOString(), eventType: "harness_stop", stop_reason: reason, ...details });
    },
  };
}

export type RunState = ReturnType<typeof createRunState>;
