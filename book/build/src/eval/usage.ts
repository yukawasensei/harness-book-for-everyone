import type { Usage } from '@earendil-works/pi-ai';

/** SDK 返回的 token 与配置刊例估算 USD；没有 usage 时返回 undefined。 */
export function sumUsage(items: Usage[]): Usage | undefined {
  if (!items.length) return undefined;
  return items.reduce<Usage>((sum, item) => ({
    input: sum.input + item.input, output: sum.output + item.output,
    cacheRead: sum.cacheRead + item.cacheRead, cacheWrite: sum.cacheWrite + item.cacheWrite,
    totalTokens: sum.totalTokens + item.totalTokens,
    cost: { input: sum.cost.input + item.cost.input, output: sum.cost.output + item.cost.output,
      cacheRead: sum.cost.cacheRead + item.cost.cacheRead, cacheWrite: sum.cost.cacheWrite + item.cost.cacheWrite,
      total: sum.cost.total + item.cost.total },
  }), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } });
}
