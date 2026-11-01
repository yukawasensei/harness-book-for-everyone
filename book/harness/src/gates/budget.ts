// Ch9 · 成本与延迟预算 / Cost & latency budget
// 预算罩住整次运行（所有轮、所有工具），不是单次调用：每一步“都不贵”，加起来也可能超。
//   成本：累计 token（本地模型不花钱，用 token 当成本代理；接云模型时换成金额即可）；
//   延迟：从运行开始算的墙钟时间。
// 在两处检查：每轮结束后（下一次模型调用之前）、每个工具执行之前。

export type UsageLike = { input?: number; output?: number; totalTokens?: number };

export function createBudgetGuard(options: { tokenBudget: number; latencyBudgetMs: number; now?: () => number }) {
  const now = options.now ?? Date.now;
  const startedAt = now();
  let tokens = 0;
  return {
    get tokens() {
      return tokens;
    },
    elapsedMs: () => now() - startedAt,
    /** 记一次模型调用的用量。 */
    recordUsage(usage: UsageLike | undefined) {
      if (!usage) return;
      tokens += usage.totalTokens ?? (usage.input ?? 0) + (usage.output ?? 0);
    },
    /** 超了返回停机原因和证据；没超返回 undefined。0 = 不设该项预算。 */
    check(): { stopReason: "cost_budget" | "latency_budget"; details: Record<string, number> } | undefined {
      if (options.tokenBudget > 0 && tokens > options.tokenBudget) {
        return { stopReason: "cost_budget", details: { tokens, tokenBudget: options.tokenBudget } };
      }
      const elapsed = now() - startedAt;
      if (options.latencyBudgetMs > 0 && elapsed > options.latencyBudgetMs) {
        return { stopReason: "latency_budget", details: { elapsedMs: elapsed, latencyBudgetMs: options.latencyBudgetMs } };
      }
      return undefined;
    },
  };
}
