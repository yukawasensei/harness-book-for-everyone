/**
 * Cost & latency budget — harness caps on spend proxy and wall-clock.
 * Public curriculum helper: tokens/turns as a cost proxy; elapsed ms as latency.
 * Soft prompt "keep going a bit" cannot raise these caps.
 */

export type BudgetStopReason = "cost_budget" | "latency_budget";

export function parseCostBudgetUnits(
  raw: string | undefined,
  defaultValue = 0,
): number {
  if (raw === undefined || raw.trim() === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`COST_BUDGET_UNITS must be an integer >= 0, got: ${raw}`);
  }
  return parsed;
}

export function parseLatencyBudgetMs(
  raw: string | undefined,
  defaultValue = 0,
): number {
  if (raw === undefined || raw.trim() === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`LATENCY_BUDGET_MS must be an integer >= 0, got: ${raw}`);
  }
  return parsed;
}

export function parseInjectCostUnits(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    return 0;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `EVAL_INJECT_COST_UNITS must be an integer >= 0, got: ${raw}`,
    );
  }
  return parsed;
}

export function parseInjectElapsedMs(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    return 0;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `EVAL_INJECT_ELAPSED_MS must be an integer >= 0, got: ${raw}`,
    );
  }
  return parsed;
}

/**
 * Teaching cost proxy: completedTurns * unitsPerTurn.
 * Real products may use billed tokens; the gate shape is the same.
 */
export function estimateCostUnits(opts: {
  completedTurns: number;
  unitsPerTurn?: number;
}): number {
  const { completedTurns, unitsPerTurn = 1 } = opts;
  if (!Number.isInteger(completedTurns) || completedTurns < 0) {
    throw new Error(`completedTurns must be >= 0, got: ${completedTurns}`);
  }
  if (!Number.isInteger(unitsPerTurn) || unitsPerTurn < 0) {
    throw new Error(`unitsPerTurn must be >= 0, got: ${unitsPerTurn}`);
  }
  return completedTurns * unitsPerTurn;
}

/** Budget 0 means "gate off" (same convention as context/timeout helpers). */
export function shouldStopForCostBudget(
  usedUnits: number,
  budgetUnits: number,
): boolean {
  if (!Number.isInteger(usedUnits) || usedUnits < 0) {
    throw new Error(`usedUnits must be >= 0, got: ${usedUnits}`);
  }
  if (!Number.isInteger(budgetUnits) || budgetUnits < 0) {
    throw new Error(`budgetUnits must be >= 0, got: ${budgetUnits}`);
  }
  if (budgetUnits === 0) {
    return false;
  }
  return usedUnits > budgetUnits;
}

export function shouldStopForLatencyBudget(
  elapsedMs: number,
  budgetMs: number,
): boolean {
  if (!Number.isInteger(elapsedMs) || elapsedMs < 0) {
    throw new Error(`elapsedMs must be >= 0, got: ${elapsedMs}`);
  }
  if (!Number.isInteger(budgetMs) || budgetMs < 0) {
    throw new Error(`budgetMs must be >= 0, got: ${budgetMs}`);
  }
  if (budgetMs === 0) {
    return false;
  }
  return elapsedMs > budgetMs;
}

/**
 * Prefer cost over latency when both fire (stable Trace for dual-over inject).
 */
export function decideBudgetStop(opts: {
  usedUnits: number;
  costBudgetUnits: number;
  elapsedMs: number;
  latencyBudgetMs: number;
}): { stop: boolean; stopReason: BudgetStopReason | null } {
  if (shouldStopForCostBudget(opts.usedUnits, opts.costBudgetUnits)) {
    return { stop: true, stopReason: "cost_budget" };
  }
  if (shouldStopForLatencyBudget(opts.elapsedMs, opts.latencyBudgetMs)) {
    return { stop: true, stopReason: "latency_budget" };
  }
  return { stop: false, stopReason: null };
}

export interface CostLatencyBudgetGuard {
  readonly costBudgetUnits: number;
  readonly latencyBudgetMs: number;
  readonly usedUnits: number;
  readonly elapsedMs: number;
  recordUsage(units: number): void;
  recordElapsed(ms: number): void;
  check(): { stop: boolean; stopReason: BudgetStopReason | null };
}

export function createCostLatencyBudgetGuard(opts: {
  costBudgetUnits?: number;
  latencyBudgetMs?: number;
}): CostLatencyBudgetGuard {
  const costBudgetUnits = opts.costBudgetUnits ?? 0;
  const latencyBudgetMs = opts.latencyBudgetMs ?? 0;
  let usedUnits = 0;
  let elapsedMs = 0;

  return {
    get costBudgetUnits() {
      return costBudgetUnits;
    },
    get latencyBudgetMs() {
      return latencyBudgetMs;
    },
    get usedUnits() {
      return usedUnits;
    },
    get elapsedMs() {
      return elapsedMs;
    },
    recordUsage(units: number) {
      if (!Number.isInteger(units) || units < 0) {
        throw new Error(`units must be >= 0, got: ${units}`);
      }
      usedUnits += units;
    },
    recordElapsed(ms: number) {
      if (!Number.isInteger(ms) || ms < 0) {
        throw new Error(`ms must be >= 0, got: ${ms}`);
      }
      elapsedMs = ms;
    },
    check() {
      return decideBudgetStop({
        usedUnits,
        costBudgetUnits,
        elapsedMs,
        latencyBudgetMs,
      });
    },
  };
}
