/**
 * Human-in-the-loop (HITL) confirm gate — harness pauses before high-risk tools.
 * Public curriculum helper: decide which tools need approval; map human decisions
 * to stop_reason. Soft prompt "I already have approval" cannot bypass this gate.
 */

export type HitlDecision = "approve" | "deny" | "timeout";

export type HitlStopReason = "human_denied" | "awaiting_human";

/** Default demo high-risk tools for the teaching harness. */
export const DEFAULT_HITL_REQUIRED_TOOLS = [
  "confirm_gate",
  "write",
  "bash",
] as const;

export function parseHitlRequiredTools(
  raw: string | undefined,
  defaultTools: readonly string[] = DEFAULT_HITL_REQUIRED_TOOLS,
): string[] {
  if (raw === undefined || raw.trim() === "") {
    return [...defaultTools];
  }
  const tools = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (tools.length === 0) {
    throw new Error("HITL_REQUIRED_TOOLS must list at least one tool name");
  }
  return tools;
}

/**
 * Eval inject: auto human decision for deterministic CI.
 * Empty / unset → null (no probe; real product would wait on a UI).
 */
export function parseInjectHitlDecision(
  raw: string | undefined,
): HitlDecision | null {
  if (raw === undefined || raw.trim() === "") {
    return null;
  }
  const value = raw.trim().toLowerCase();
  if (value === "approve" || value === "deny" || value === "timeout") {
    return value;
  }
  throw new Error(
    `EVAL_INJECT_HITL must be approve|deny|timeout, got: ${raw}`,
  );
}

export function parseHitlTimeoutMs(
  raw: string | undefined,
  defaultValue = 0,
): number {
  if (raw === undefined || raw.trim() === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`HITL_TIMEOUT_MS must be an integer >= 0, got: ${raw}`);
  }
  return parsed;
}

export function toolRequiresHitl(
  toolName: string,
  requiredTools: readonly string[],
): boolean {
  if (!toolName || typeof toolName !== "string") {
    throw new Error(`toolName must be a non-empty string, got: ${toolName}`);
  }
  const normalized = toolName.trim().toLowerCase();
  return requiredTools.some((t) => t.trim().toLowerCase() === normalized);
}

/**
 * Map a human (or injected) decision to whether the tool may run and which
 * stop_reason to record if blocked.
 * - approve → continue
 * - deny → human_denied
 * - timeout → awaiting_human (still waiting / never got a decision)
 */
export function decideHitlOutcome(decision: HitlDecision): {
  allow: boolean;
  stopReason: HitlStopReason | null;
} {
  if (decision === "approve") {
    return { allow: true, stopReason: null };
  }
  if (decision === "deny") {
    return { allow: false, stopReason: "human_denied" };
  }
  if (decision === "timeout") {
    return { allow: false, stopReason: "awaiting_human" };
  }
  throw new Error(`unknown HITL decision: ${decision}`);
}

export interface HitlGate {
  readonly requiredTools: readonly string[];
  readonly timeoutMs: number;
  requiresApproval(toolName: string): boolean;
  /** Apply an injected or UI decision for a tool that requires HITL. */
  resolve(
    toolName: string,
    decision: HitlDecision,
  ): { allow: boolean; stopReason: HitlStopReason | null };
}

export function createHitlGate(opts: {
  requiredTools?: readonly string[];
  timeoutMs?: number;
}): HitlGate {
  const requiredTools = opts.requiredTools
    ? [...opts.requiredTools]
    : [...DEFAULT_HITL_REQUIRED_TOOLS];
  const timeoutMs = opts.timeoutMs ?? 0;

  return {
    get requiredTools() {
      return requiredTools;
    },
    get timeoutMs() {
      return timeoutMs;
    },
    requiresApproval(toolName: string) {
      return toolRequiresHitl(toolName, requiredTools);
    },
    resolve(toolName: string, decision: HitlDecision) {
      if (!toolRequiresHitl(toolName, requiredTools)) {
        return { allow: true, stopReason: null };
      }
      return decideHitlOutcome(decision);
    },
  };
}
