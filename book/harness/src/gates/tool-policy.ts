// Ch5 · 工具策略：在 pi 的 beforeToolCall 钩子里，执行前逐个检查。
// 第 1 道：工具必须在白名单里（纵深防御：即便模型“编”出一个没注册的工具名）。
// 第 2 道：路径参数必须落在 workspace 里。
import { checkPath, pathArgs } from "./path-sandbox.js";

export type PolicyDecision =
  | { allow: true }
  | { allow: false; stopReason: "tool_denied" | "path_denied"; details: Record<string, unknown> };

export function decideToolCall(
  call: { toolName: string; args: unknown },
  policy: { allowedTools: string[]; workspaceRoot: string },
): PolicyDecision {
  if (!policy.allowedTools.includes(call.toolName)) {
    return { allow: false, stopReason: "tool_denied", details: { toolName: call.toolName } };
  }
  for (const requested of pathArgs(call.args)) {
    const verdict = checkPath(policy.workspaceRoot, requested);
    // 只记相对路径和原因，绝不把本机绝对路径写进 trace。
    if (!verdict.ok) {
      return { allow: false, stopReason: "path_denied", details: { toolName: call.toolName, requestedPath: requested, reason: verdict.reason } };
    }
  }
  return { allow: true };
}
