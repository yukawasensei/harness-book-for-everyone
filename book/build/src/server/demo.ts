import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStageSession, type StageSessionOptions } from "../agent/session.js";
import { fakeStream } from "../testing/fake-model.js";

/** 显式离线演示；真实 SDK、业务工具与存储照常工作，不调用模型供应商。 */
export async function createDemoSession(options: StageSessionOptions) {
  const session = await createStageSession({ ...options, model: { provider: "ollama", id: "qwen3.8:27b" } });
  const artifact = JSON.parse(readFileSync(resolve(options.root, "examples/sample-project/topic.json"), "utf8"));
  session.agent.streamFunction = fakeStream(session.model!, [
    { call: "read_upstream", args: {}, text: "这是离线演示。先检查上游，再提交草稿。" },
    { call: "write_draft", args: { artifact: {} } },
    { call: "write_draft", args: { artifact } },
    { text: "已修正字段并保存草稿，请在右侧预览后采用。" },
  ], { delayMs: 700 }).fn;
  return session;
}
