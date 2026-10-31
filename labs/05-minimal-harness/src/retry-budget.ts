/**
 * Retry & degrade — harness-level budget for tool/model failures.
 * Public curriculum helper: decide retry vs stop/degrade; backoff is pure math.
 */

export type RetryExhaustAction = "stop" | "skip_tool" | "partial";

export function parseMaxRetries(
  raw: string | undefined,
  defaultValue = 0,
): number {
  if (raw === undefined || raw.trim() === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`MAX_RETRIES must be an integer >= 0, got: ${raw}`);
  }
  return parsed;
}

export function parseRetryBackoffMs(
  raw: string | undefined,
  defaultValue = 0,
): number {
  if (raw === undefined || raw.trim() === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`RETRY_BACKOFF_MS must be an integer >= 0, got: ${raw}`);
  }
  return parsed;
}

export function parseOnRetryExhausted(
  raw: string | undefined,
  defaultValue: RetryExhaustAction = "stop",
): RetryExhaustAction {
  if (raw === undefined || raw.trim() === "") {
    return defaultValue;
  }
  const value = raw.trim().toLowerCase();
  if (value === "stop" || value === "skip_tool" || value === "partial") {
    return value;
  }
  throw new Error(`ON_RETRY_EXHAUSTED must be stop|skip_tool|partial, got: ${raw}`);
}

export function parseInjectToolFailures(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim() === "") {
    return false;
  }
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/**
 * failureCount is 1-based after each failed attempt.
 * With maxRetries=2: allow retry after fail#1 and fail#2; exhaust after fail#3
 * (i.e. initial try + 2 retries = 3 attempts).
 */
export function shouldRetryAfterFailure(
  failureCount: number,
  maxRetries: number,
): boolean {
  if (!Number.isInteger(failureCount) || failureCount < 1) {
    throw new Error(`failureCount must be >= 1, got: ${failureCount}`);
  }
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new Error(`maxRetries must be >= 0, got: ${maxRetries}`);
  }
  return failureCount <= maxRetries;
}

/** Linear backoff: attemptIndex (1-based retry number) * baseMs. */
export function nextBackoffMs(retryNumber: number, baseMs: number): number {
  if (!Number.isInteger(retryNumber) || retryNumber < 1) {
    throw new Error(`retryNumber must be >= 1, got: ${retryNumber}`);
  }
  if (!Number.isInteger(baseMs) || baseMs < 0) {
    throw new Error(`baseMs must be >= 0, got: ${baseMs}`);
  }
  return retryNumber * baseMs;
}

export function decideOnRetryExhausted(
  action: RetryExhaustAction,
): { stopReason: "retry_exhausted"; degrade: RetryExhaustAction } {
  return { stopReason: "retry_exhausted", degrade: action };
}

export interface RetryBudgetGuard {
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly onExhausted: RetryExhaustAction;
  readonly failureCount: number;
  readonly exhausted: boolean;
  /** Record a failure; returns whether another attempt should run. */
  recordFailure(): { retry: boolean; backoffMs: number; exhausted: boolean };
}

export function createRetryBudgetGuard(opts: {
  maxRetries: number;
  backoffMs?: number;
  onExhausted?: RetryExhaustAction;
}): RetryBudgetGuard {
  const maxRetries = opts.maxRetries;
  const backoffMs = opts.backoffMs ?? 0;
  const onExhausted = opts.onExhausted ?? "stop";
  let failureCount = 0;
  let exhausted = false;

  return {
    get maxRetries() {
      return maxRetries;
    },
    get backoffMs() {
      return backoffMs;
    },
    get onExhausted() {
      return onExhausted;
    },
    get failureCount() {
      return failureCount;
    },
    get exhausted() {
      return exhausted;
    },
    recordFailure() {
      failureCount += 1;
      const retry = shouldRetryAfterFailure(failureCount, maxRetries);
      if (!retry) {
        exhausted = true;
        return { retry: false, backoffMs: 0, exhausted: true };
      }
      return {
        retry: true,
        backoffMs: nextBackoffMs(failureCount, backoffMs),
        exhausted: false,
      };
    },
  };
}
