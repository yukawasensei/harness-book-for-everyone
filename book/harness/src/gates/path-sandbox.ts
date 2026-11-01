// Ch5 · 路径沙箱 / Path sandbox
// 白名单只管“能用哪个工具”，管不了“工具去读哪里”。read 在白名单里，照样能读 ../../ 外面的文件。
// 所以凡是带路径参数的工具，执行前都要过这道闸：解析成真实路径后，必须仍在 workspace 里。
import { realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

/** pi 内置文件工具里装路径的参数名。 */
export const PATH_ARG_KEYS = ["path", "file_path"] as const;

export type PathVerdict =
  | { ok: true; relativePath: string }
  | { ok: false; reason: string };

/** 找到最长的、真实存在的祖先目录并 realpath（叶子还不存在时也能判断符号链接逃逸）。 */
function realpathOfExistingPrefix(absolutePath: string): string {
  let cursor = absolutePath;
  const tail: string[] = [];
  for (;;) {
    try {
      return resolve(realpathSync(cursor), ...tail);
    } catch {
      const parent = dirname(cursor);
      if (parent === cursor) return absolutePath;
      tail.unshift(basename(cursor));
      cursor = parent;
    }
  }
}

export function checkPath(workspaceRoot: string, requested: unknown): PathVerdict {
  if (typeof requested !== "string" || requested.trim() === "") return { ok: false, reason: "empty path" };
  if (requested.includes("\0")) return { ok: false, reason: "null byte in path" };
  const root = realpathSync(workspaceRoot);
  const real = realpathOfExistingPrefix(resolve(root, requested));
  const rel = relative(root, real);
  if (rel === "") return { ok: true, relativePath: "." };
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return { ok: false, reason: "resolves outside workspace" };
  }
  return { ok: true, relativePath: rel };
}

/** 从工具参数里取出所有路径值（没有路径参数的工具返回空数组）。 */
export function pathArgs(args: unknown): string[] {
  if (!args || typeof args !== "object") return [];
  const record = args as Record<string, unknown>;
  return PATH_ARG_KEYS.filter((key) => key in record).map((key) => String(record[key]));
}
