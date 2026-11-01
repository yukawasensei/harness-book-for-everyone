// Ch7 · 上下文预算 / Context budget
// 上下文窗口是有限的：工具结果越堆越多，迟早撑爆。两种处理：
//   stop     —— 每轮结束估算上下文，超预算就停（context_budget），不把超大上下文再喂给模型；
//   truncate —— 单次工具结果超过上限就截断并打标记，然后继续跑（降级而不是停机）。
// 字符数是 token 的教学代理（不需要 tokenizer）。

type Part = { type?: string; text?: string };
type Message = { role?: string; content?: string | Part[] };

/** 统计所有消息里可见文本的字符数。 */
export function estimateContextChars(messages: readonly unknown[]): number {
  let total = 0;
  for (const message of messages as Message[]) {
    const content = message?.content;
    if (typeof content === "string") total += content.length;
    else if (Array.isArray(content)) for (const part of content) if (typeof part?.text === "string") total += part.text.length;
  }
  return total;
}

export const TRUNCATION_MARKER = "\n…[harness: tool result truncated]";

/** 把工具结果的文本部分截到 maxChars（0 = 不截）；返回新内容和是否截断。 */
export function truncateToolContent<T extends Part>(content: T[], maxChars: number): { content: T[]; truncated: boolean; originalChars: number } {
  const originalChars = content.reduce((n, p) => n + (typeof p.text === "string" ? p.text.length : 0), 0);
  if (maxChars <= 0 || originalChars <= maxChars) return { content, truncated: false, originalChars };
  let budget = maxChars;
  const out = content.map((part) => {
    if (typeof part.text !== "string") return part;
    const kept = part.text.slice(0, Math.max(0, budget));
    budget -= kept.length;
    return { ...part, text: kept };
  });
  let last = -1;
  out.forEach((p, i) => {
    if (typeof p.text === "string") last = i;
  });
  if (last >= 0) out[last] = { ...out[last], text: `${out[last].text}${TRUNCATION_MARKER}` };
  return { content: out, truncated: true, originalChars };
}
