import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export function assertId(id: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id)) throw new Error("项目 ID 不合规（不接受路径）");
}

/** 包含尚未创建的尾部；逐级 lstat，悬空链接也不能当作不存在。 */
export function containedPath(root: string, ...parts: string[]) {
  const target = resolve(root, ...parts);
  const inside = (base: string, path: string) => {
    const rel = relative(base, path);
    return rel === "" || (!rel.startsWith(`..`) && !isAbsolute(rel));
  };
  if (!inside(resolve(root), target)) throw new Error("路径越界，拒绝访问");
  function physical(path: string): string {
    try { lstatSync(path); return realpathSync(path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // lstat 成功但 realpath 失败表示悬空链接，必须拒绝。
      try { lstatSync(path); throw new Error("路径链接无效，拒绝访问"); }
      catch (nested) { if ((nested as NodeJS.ErrnoException).code !== "ENOENT") throw nested; }
      const parent = dirname(path);
      if (parent === path) throw error;
      return resolve(physical(parent), relative(parent, path));
    }
  }
  if (!inside(physical(resolve(root)), physical(target))) throw new Error("路径越界，拒绝访问");
  return target;
}

/** 用户根目录不允许链接到另一个用户，即使两者都在 projects 下。 */
export function tenantRoot(packageRoot: string, userId: string) {
  assertId(userId);
  const path = containedPath(resolve(packageRoot, "projects"), userId);
  try { if (lstatSync(path).isSymbolicLink()) throw new Error("用户目录不可为符号链接"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  return path;
}
