// Ch4 · 轮数上限 / Max turns
// 一轮 = 模型回复一次（以及它请求的工具都执行完）。到上限就刹车，不管模型还想不想继续。
import type { AgentSession } from "@earendil-works/pi-coding-agent";

type FinishTurn = NonNullable<AgentSession["agent"]["finishTurn"]>;

/** Adapt a stop predicate to pi 1.x without forcing extra turns or counting hard exits. */
export function finishTurnWhen(shouldStop: (turn: Parameters<FinishTurn>[0]) => boolean | Promise<boolean>): FinishTurn {
  return async (turn) => {
    if (turn.message.stopReason === "error" || turn.message.stopReason === "aborted") return undefined;
    return await shouldStop(turn) ? { action: "end" } : undefined;
  };
}

export function createMaxTurnsGuard(maxTurns: number) {
  if (!Number.isInteger(maxTurns) || maxTurns < 1) {
    throw new Error(`max_turns must be a positive integer, got: ${maxTurns}`);
  }
  let completed = 0;
  return {
    get completed() {
      return completed;
    },
    /** 每完成一轮调用一次；返回 true 表示该停了。 */
    recordTurn(): boolean {
      completed += 1;
      return completed >= maxTurns;
    },
  };
}
