// Ch8 · 人机确认门 / Human-in-the-loop confirm gate
// 有副作用的工具（写文件、发消息、花钱……）执行前必须由人确认；不确认就不执行。
// 确认者是可替换的：
//   - 读者真跑：HITL_MODE=tty，在终端里按 y/N（超时视为拒绝）；
//   - 评测：case 里写 hitl_decision，作为“模拟的人”，trace 里标 simulated=true。
import { createInterface } from "node:readline/promises";

export type HitlRequest = { toolName: string; args: unknown };
export type HitlDecision = { approved: boolean; by: "simulated" | "human"; reason: string };
export type Approver = (request: HitlRequest) => Promise<HitlDecision>;

export function simulatedApprover(decision: "approve" | "deny"): Approver {
  return async () => ({ approved: decision === "approve", by: "simulated", reason: `case hitl_decision=${decision}` });
}

/** 终端确认：只有明确输入 y/yes 才算同意；超时、回车、其它输入都算拒绝。 */
export function ttyApprover(timeoutMs: number): Approver {
  return async ({ toolName, args }) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      const answer = await rl.question(`\n[HITL] 允许执行 ${toolName} ${JSON.stringify(args)} ? (y/N) `, { signal: timeout });
      const approved = /^y(es)?$/i.test(answer.trim());
      return { approved, by: "human", reason: approved ? "approved" : "denied" };
    } catch {
      return { approved: false, by: "human", reason: `no answer within ${timeoutMs}ms` };
    } finally {
      rl.close();
    }
  };
}

/** 安全默认：没配确认者时一律拒绝（宁可不做，也不在没人看着时写文件）。 */
export const denyAllApprover: Approver = async () => ({ approved: false, by: "simulated", reason: "no approver configured" });
