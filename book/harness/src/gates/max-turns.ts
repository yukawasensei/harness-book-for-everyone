// Ch4 · 轮数上限 / Max turns
// 一轮 = 模型回复一次（以及它请求的工具都执行完）。到上限就刹车，不管模型还想不想继续。
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
