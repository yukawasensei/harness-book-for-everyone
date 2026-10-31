/**
 * Context / session budget — harness-level gate for finite context windows.
 * Public curriculum helper: estimate size, decide stop or truncate.
 * Character counts are a teaching proxy for tokens (no tokenizer required).
 */

export type ContextBudgetPolicy = "stop" | "truncate";

export interface TextPart {
  type?: string;
  text?: string;
}

export interface ContextMessage {
  role?: string;
  content?: string | TextPart[];
}

export function parseContextBudgetChars(
  raw: string | undefined,
  defaultValue = 0,
): number {
  if (raw === undefined || raw.trim() === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`CONTEXT_BUDGET_CHARS must be an integer >= 0, got: ${raw}`);
  }
  return parsed;
}

export function parseInjectContextChars(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    return 0;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`EVAL_INJECT_CONTEXT_CHARS must be an integer >= 0, got: ${raw}`);
  }
  return parsed;
}

export function parseContextBudgetPolicy(
  raw: string | undefined,
  defaultValue: ContextBudgetPolicy = "stop",
): ContextBudgetPolicy {
  if (raw === undefined || raw.trim() === "") {
    return defaultValue;
  }
  const value = raw.trim().toLowerCase();
  if (value === "stop" || value === "truncate") {
    return value;
  }
  throw new Error(`CONTEXT_BUDGET_POLICY must be stop|truncate, got: ${raw}`);
}

/** Sum visible text characters across messages (string or text parts). */
export function estimateContextChars(messages: ContextMessage[]): number {
  let total = 0;
  for (const message of messages) {
    const content = message.content;
    if (typeof content === "string") {
      total += content.length;
      continue;
    }
    if (Array.isArray(content)) {
      for (const part of content) {
        if (typeof part?.text === "string") {
          total += part.text.length;
        }
      }
    }
  }
  return total;
}

export function shouldStopForContextBudget(
  estimatedChars: number,
  budgetChars: number,
): boolean {
  if (!Number.isInteger(estimatedChars) || estimatedChars < 0) {
    throw new Error(`estimatedChars must be >= 0, got: ${estimatedChars}`);
  }
  if (!Number.isInteger(budgetChars) || budgetChars < 0) {
    throw new Error(`budgetChars must be >= 0, got: ${budgetChars}`);
  }
  // budget 0 = gate off (unlimited for this teaching lab)
  if (budgetChars === 0) {
    return false;
  }
  return estimatedChars > budgetChars;
}

/**
 * Keep system messages + newest other messages until under budget.
 * Returns a new array; does not mutate input.
 */
export function truncateMessagesToBudget(
  messages: ContextMessage[],
  budgetChars: number,
): ContextMessage[] {
  if (budgetChars === 0) {
    return messages.slice();
  }
  if (estimateContextChars(messages) <= budgetChars) {
    return messages.slice();
  }

  const system = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const keptRest: ContextMessage[] = [];

  // Prefer newest non-system messages.
  for (let i = rest.length - 1; i >= 0; i -= 1) {
    const candidate = [...system, rest[i], ...keptRest];
    if (estimateContextChars(candidate) <= budgetChars) {
      keptRest.unshift(rest[i]);
    }
  }

  const result = [...system, ...keptRest];
  if (estimateContextChars(result) <= budgetChars) {
    return result;
  }

  // Even system alone may overflow — keep as many system messages from the end as fit.
  const keptSystem: ContextMessage[] = [];
  for (let i = system.length - 1; i >= 0; i -= 1) {
    const candidate = [system[i], ...keptSystem];
    if (estimateContextChars(candidate) <= budgetChars) {
      keptSystem.unshift(system[i]);
    }
  }
  return keptSystem;
}

export function buildPaddingMessage(chars: number): ContextMessage {
  const n = Math.max(0, chars);
  return {
    role: "user",
    content: n === 0 ? "" : "X".repeat(n),
  };
}
