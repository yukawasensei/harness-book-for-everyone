/** Pure maxTurns helpers — unit-testable without Ollama. */

export type StopReason =
  | "success"
  | "max_turns"
  | "tool_timeout"
  | "path_denied"
  | "context_budget"
  | "retry_exhausted"
  | "human_denied"
  | "awaiting_human"
  | "cost_budget"
  | "latency_budget"
  | "tool_error"
  | "model_error";

export function parseMaxTurns(
  raw: string | undefined,
  defaultValue = 8,
): number {
  if (raw === undefined || raw.trim() === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`MAX_TURNS must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

/**
 * Decide whether the agent loop should stop after a completed turn.
 * Turn count is 1-based after each finished turn (assistant + optional tools).
 */
export function shouldStopForMaxTurns(
  completedTurnCount: number,
  maxTurns: number,
): boolean {
  if (!Number.isInteger(completedTurnCount) || completedTurnCount < 0) {
    throw new Error(`completedTurnCount must be >= 0, got: ${completedTurnCount}`);
  }
  if (!Number.isInteger(maxTurns) || maxTurns < 1) {
    throw new Error(`maxTurns must be >= 1, got: ${maxTurns}`);
  }
  return completedTurnCount >= maxTurns;
}

export interface MaxTurnsGuard {
  /** Completed turns so far (updated by recordCompletedTurn). */
  readonly completedTurnCount: number;
  readonly maxTurns: number;
  /** Call after each agent turn completes; returns whether to stop the loop. */
  recordCompletedTurn(): boolean;
  /** True once maxTurns was hit. */
  readonly hitMaxTurns: boolean;
}

export function createMaxTurnsGuard(maxTurns: number): MaxTurnsGuard {
  let completedTurnCount = 0;
  let hitMaxTurns = false;

  return {
    get completedTurnCount() {
      return completedTurnCount;
    },
    get maxTurns() {
      return maxTurns;
    },
    get hitMaxTurns() {
      return hitMaxTurns;
    },
    recordCompletedTurn(): boolean {
      completedTurnCount += 1;
      const stop = shouldStopForMaxTurns(completedTurnCount, maxTurns);
      if (stop) {
        hitMaxTurns = true;
      }
      return stop;
    },
  };
}
