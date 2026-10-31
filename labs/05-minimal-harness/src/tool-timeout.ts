/** Pure tool-timeout helpers — unit-testable without Ollama. */

export class ToolTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message?: string) {
    super(message ?? `tool timed out after ${timeoutMs}ms`);
    this.name = "ToolTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export function parseToolTimeoutMs(
  raw: string | undefined,
  defaultValue = 0,
): number {
  if (raw === undefined || raw.trim() === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`TOOL_TIMEOUT_MS must be an integer >= 0, got: ${raw}`);
  }
  return parsed;
}

/**
 * Race a promise against a harness-level timeout.
 * timeoutMs <= 0 means "no timeout" (wait forever / until AbortSignal).
 */
export async function withToolTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    const reason = signal.reason;
    throw reason instanceof Error ? reason : new Error(String(reason ?? "aborted"));
  }

  if (!Number.isInteger(timeoutMs) || timeoutMs < 0) {
    throw new Error(`timeoutMs must be an integer >= 0, got: ${timeoutMs}`);
  }

  if (timeoutMs === 0 && !signal) {
    return work;
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    };

    const settleReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const settleResolve = (value: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onAbort = () => {
      const reason = signal?.reason;
      settleReject(reason instanceof Error ? reason : new Error(String(reason ?? "aborted")));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        settleReject(new ToolTimeoutError(timeoutMs));
      }, timeoutMs);
    }

    work.then(settleResolve, settleReject);
  });
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!Number.isInteger(ms) || ms < 0) {
    throw new Error(`sleep ms must be an integer >= 0, got: ${ms}`);
  }
  if (signal?.aborted) {
    const reason = signal.reason;
    return Promise.reject(reason instanceof Error ? reason : new Error(String(reason ?? "aborted")));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      const reason = signal?.reason;
      reject(reason instanceof Error ? reason : new Error(String(reason ?? "aborted")));
    };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}
