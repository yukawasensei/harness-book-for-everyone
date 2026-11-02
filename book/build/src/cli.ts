import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STAGES, parseStage } from "./contracts/index.js";
import { ProjectStore } from "./project/store.js";
import { scrubSecrets } from "./agent/model.js";

const usage = "用法：new <title> | status <project> | run <project> <stage> | adopt <project> <stage> <version>";

export async function main(args: string[], root = resolve(dirname(fileURLToPath(import.meta.url)), "..")): Promise<void> {
  if (process.platform !== "linux") throw new Error("请在 Linux / WSL 中运行");
  const [command, ...rest] = args;
  const store = new ProjectStore(root);
  if (command === "new" && rest.length === 1) {
    const project = store.create(rest[0]);
    console.log(`已建项目：${project.id}\n标题：${project.title}`);
  } else if (command === "status" && rest.length === 1) {
    const project = store.load(rest[0]);
    console.log(`${project.id} · ${project.title}`);
    for (const stage of STAGES) {
      const state = project.stages[stage];
      console.log(`${stage}: ${state.status} | versions=${state.versions.join(",") || "-"} | adopted=${state.adopted_version ?? "-"}`);
    }
  } else if (command === "adopt" && rest.length === 3) {
    if (!/^[1-9][0-9]*$/.test(rest[2])) throw new Error("版本号必须为正整数，如 1");
    const version = Number(rest[2]);
    if (!Number.isSafeInteger(version)) throw new Error("版本号超出安全整数范围");
    store.adopt(rest[0], parseStage(rest[1]), version);
    console.log(`已采用 ${rest[1]} v${version}`);
  } else if (command === "run" && rest.length === 2) {
    const stage = parseStage(rest[1]);
    const { createStageSession } = await import("./agent/session.js");
    const { runStage } = await import("./agent/run.js");
    const session = await createStageSession({ root, store, projectId: rest[0], stage });
    try {
      const result = await runStage(session, store, rest[0], stage);
      console.log(`stop_reason=${result.stop_reason}`);
      if (result.stop_reason !== "draft_written") throw new Error(`阶段运行未完成：${result.stop_reason}；${result.errors.join("; ")}`);
    } finally { session.dispose(); }
  } else {
    throw new Error(usage);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    console.error(scrubSecrets(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
