/**
 * Node 自定义 resolve hook：让 `tsx --test` 与 Vite 共用 `@/` 等路径别名。
 * 由 `register-web-aliases.mjs` 注册。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const webSrc = path.join(packageRoot, "web", "src");
const srcRoot = path.join(packageRoot, "src");

const exact = {
  "@contracts": path.join(srcRoot, "contracts", "index.ts"),
  "@workflow": path.join(srcRoot, "workflow", "index.ts"),
};

const prefixes = [
  ["@/", webSrc],
  ["@server/", path.join(srcRoot, "server")],
  ["@contracts/", path.join(srcRoot, "contracts")],
  ["@workflow/", path.join(srcRoot, "workflow")],
  ["@project/", path.join(srcRoot, "project")],
];

function tryFile(base) {
  const withoutJs = base.replace(/\.jsx?$/i, "");
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${withoutJs}.ts`,
    `${withoutJs}.tsx`,
    `${withoutJs}.js`,
    `${withoutJs}.jsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
    path.join(withoutJs, "index.ts"),
    path.join(withoutJs, "index.tsx"),
    path.join(withoutJs, "index.js"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // 只改写 specifier，交给后续 tsx loader 处理 .ts/.tsx，避免 shortCircuit 绕过转译。
  if (Object.hasOwn(exact, specifier)) {
    return nextResolve(pathToFileURL(exact[specifier]).href, context);
  }
  for (const [prefix, dir] of prefixes) {
    if (!specifier.startsWith(prefix)) continue;
    const rest = specifier.slice(prefix.length);
    const found = tryFile(path.join(dir, rest));
    if (!found) {
      throw Object.assign(new Error(`Cannot find package '${specifier}' (alias ${prefix})`), { code: "ERR_MODULE_NOT_FOUND" });
    }
    return nextResolve(pathToFileURL(found).href, context);
  }
  return nextResolve(specifier, context);
}
