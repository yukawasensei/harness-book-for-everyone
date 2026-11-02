import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Artifacts, type Stage } from "../contracts/index.js";
import { ProjectStore } from "../project/store.js";

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function sample<S extends Stage>(stage: S): Artifacts[S] {
  return JSON.parse(readFileSync(join(packageRoot, "examples/sample-project", `${stage}.json`), "utf8"));
}

/** 测试只在本包已忽略的 projects/ 内创建和清理自己生成的夹具。 */
export function fixture() {
  mkdirSync(join(packageRoot, "projects"), { recursive: true });
  const dir = mkdtempSync(join(packageRoot, "projects", ".test-"));
  const store = new ProjectStore(dir);
  const project = store.create("离线测试短片");
  return { dir, store, project, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
