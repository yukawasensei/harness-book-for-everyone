// Ch7 · 重试与降级 / Retry & degrade
// 工具失败时由 harness 重试，而不是指望模型“再试一次”。次数有上限；用完后按产品决定：
//   stop    —— 停机（retry_exhausted），宁可不答也不乱答；
//   degrade —— 返回一个明确标注的兜底结果，让模型在“缺这项数据”的前提下继续。
import { setTimeout as sleep } from "node:timers/promises";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

export type OnExhausted = "stop" | "degrade";

export type RetryEvents = {
  onRetry: (info: { toolName: string; attempt: number; error: string }) => void;
  onExhausted: (info: { toolName: string; attempts: number; error: string; action: OnExhausted }) => void;
};

/** 第 n 次重试前等待 backoffMs * 2^(n-1)（指数退避）。 */
export function backoffDelay(backoffMs: number, retryNumber: number): number {
  return backoffMs <= 0 ? 0 : backoffMs * 2 ** (retryNumber - 1);
}

export function withRetry<T extends ToolDefinition<any, any>>(
  tool: T,
  options: { maxRetries: number; backoffMs: number; onExhausted: OnExhausted },
  events: RetryEvents,
): T {
  if (options.maxRetries <= 0 && options.onExhausted === "stop") return tool;
  return {
    ...tool,
    async execute(...args: unknown[]) {
      const run = tool.execute as (...a: unknown[]) => Promise<unknown>;
      let lastError = "";
      for (let attempt = 1; attempt <= options.maxRetries + 1; attempt += 1) {
        try {
          return await run(...args);
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          if (attempt <= options.maxRetries) {
            events.onRetry({ toolName: tool.name, attempt, error: lastError });
            await sleep(backoffDelay(options.backoffMs, attempt));
          }
        }
      }
      const attempts = options.maxRetries + 1;
      events.onExhausted({ toolName: tool.name, attempts, error: lastError, action: options.onExhausted });
      if (options.onExhausted === "degrade") {
        return {
          content: [{ type: "text", text: `[degraded] ${tool.name} is unavailable after ${attempts} attempts. Answer without this data and say so. 该数据暂不可用，请在不使用它的前提下作答并说明。` }],
          details: { degraded: true, attempts },
        };
      }
      throw new Error(`${tool.name} failed after ${attempts} attempts: ${lastError}`);
    },
  } as T;
}
