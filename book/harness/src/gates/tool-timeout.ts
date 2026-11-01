// Ch4 · 工具超时 / Tool timeout
// 超时属于 harness，不属于工具：任何自定义工具都被同一个包装器罩住。
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

export class ToolTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`tool timed out after ${timeoutMs}ms`);
    this.name = "ToolTimeoutError";
  }
}

/** work 与计时器赛跑；timeoutMs <= 0 表示不设超时。 */
export function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) return work;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ToolTimeoutError(timeoutMs)), timeoutMs);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** 给工具套上超时：超时就通知 harness（onTimeout），并让这次工具调用以错误结束。 */
export function withToolTimeout<T extends ToolDefinition<any, any>>(
  tool: T,
  timeoutMs: number,
  onTimeout: (info: { toolName: string; timeoutMs: number }) => void,
): T {
  if (timeoutMs <= 0) return tool;
  return {
    ...tool,
    async execute(...args: unknown[]) {
      try {
        return await withTimeout((tool.execute as (...a: unknown[]) => Promise<unknown>)(...args), timeoutMs);
      } catch (error) {
        if (error instanceof ToolTimeoutError) onTimeout({ toolName: tool.name, timeoutMs });
        throw error;
      }
    },
  } as T;
}
