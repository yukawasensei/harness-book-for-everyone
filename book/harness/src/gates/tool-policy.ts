// Ch5 · 工具策略：在 pi 的 beforeToolCall 钩子里，执行前逐个检查。
// 第 1 道：工具必须在白名单里（纵深防御：即便模型“编”出一个没注册的工具名）。
// 第 2 道：路径参数必须落在 workspace 里。
// 第 3 道（Ch8）：写类工具的路径还必须落在 writable_dirs 里——能读的地方，不等于能写的地方。
import { relative, sep } from "node:path";
import { checkPath, pathArgs } from "./path-sandbox.js";

/** 会改动文件的工具。 */
export const WRITE_TOOLS = ["write", "edit"];

function isUnder(relPath: string, dir: string): boolean {
  const rel = relative(dir, relPath);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep);
}

export type PolicyDecision =
  | { allow: true }
  | { allow: false; stopReason: "tool_denied" | "path_denied"; details: Record<string, unknown> };

export function decideToolCall(
  call: { toolName: string; args: unknown },
  policy: { allowedTools: string[]; workspaceRoot: string; writableDirs?: string[] },
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
    if (WRITE_TOOLS.includes(call.toolName) && !(policy.writableDirs ?? []).some((dir) => isUnder(verdict.relativePath, dir))) {
      return { allow: false, stopReason: "path_denied", details: { toolName: call.toolName, requestedPath: requested, reason: "not in writable_dirs" } };
    }
  }
  return { allow: true };
}
