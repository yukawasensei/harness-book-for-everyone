import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStageSession, type StageSessionOptions } from "../agent/session.js";
import { fakeStream } from "../testing/fake-model.js";
import { DEPENDENCIES } from "../workflow/index.js";

/** 显式离线演示；真实 SDK、业务工具与存储照常工作，不调用模型供应商。 */
export async function createDemoSession(options: StageSessionOptions) {
  const session = await createStageSession({ ...options, model: { provider: "ollama", id: "qwen3.8:27b" } });
  const artifact = JSON.parse(readFileSync(resolve(options.root, `examples/sample-project/${options.stage}.json`), "utf8"));
  const versions = options.store.load(options.projectId).stages[options.stage].versions;
  // 固定修改示例：把孩子换成老站长，不解释任意修改意见。
  if (options.stage === "synopsis") {
    const topic = options.store.readAdopted(options.projectId, "topic");
    artifact.title = topic.title;
    artifact.logline = topic.logline;
    if (topic.logline.includes("老站长") || versions.length) {
      artifact.beats = artifact.beats.map((beat: string) => beat.replaceAll("麦冬", "老站长何望"));
    }
  }
  if (versions.length) {
    artifact.logline = "急着填满旧候船亭时刻表的志愿者，与坚持保留空白格的老站长争执后，决定用三分钟听完一位修表师没讲完的告别。";
  }
  const dependency = DEPENDENCIES[options.stage][0];
  session.agent.streamFunction = fakeStream(session.model!, [
    { call: "read_upstream", args: dependency ? { stage: dependency } : {}, text: "这是离线演示。先检查上游，再提交草稿。" },
    { call: "write_draft", args: { artifact: {} } },
    { call: "write_draft", args: { artifact } },
    { text: "已修正字段并保存草稿，请在右侧预览后采用。" },
  ], { delayMs: 700 }).fn;
  return session;
}
