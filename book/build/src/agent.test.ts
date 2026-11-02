import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { getCurrentSystemPrompt, getCurrentTools } from "@earendil-works/pi-ai";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { Value } from "typebox/value";
import { createStageSession, createStageTools } from "./agent/session.js";
import { STAGE_PROMPTS, TOPIC_PROMPT } from "./agent/prompts.js";
import { runStage } from "./agent/run.js";
import { fakeStream, type Turn } from "./testing/fake-model.js";
import { fixture, packageRoot, sample } from "./testing/fixtures.js";

async function setup(script: Turn[]) {
  const f = fixture();
  try {
    const session = await createStageSession({
      root: packageRoot, store: f.store, projectId: f.project.id, stage: "topic",
      model: { provider: "ollama", id: "qwen3.8:27b" },
    });
    const fake = fakeStream(session.model!, script);
    session.agent.streamFunction = fake.fn;
    return { ...f, session, fake, cleanup: () => { session.dispose(); f.cleanup(); } };
  } catch (error) { f.cleanup(); throw error; }
}

test("模型只见两个工具；硬调 bash/read/write/edit 也不能执行", async () => {
  const f = await setup([
    ...["bash", "read", "write", "edit"].map(call => ({ call, args: {} })), { text: "结束" },
  ]);
  try {
    const failures: string[] = [];
    f.session.subscribe(e => { if (e.type === "tool_execution_end" && e.isError) failures.push(e.toolName); });
    await f.session.prompt("开始");
    assert.deepEqual(f.session.getActiveToolNames().sort(), ["read_upstream", "write_draft"]);
    assert.deepEqual(f.session.getAllTools().map(t => t.name).sort(), ["read_upstream", "write_draft"]);
    for (const context of f.fake.contexts) {
      assert.deepEqual(getCurrentTools(context.messages).map(t => t.name).sort(), ["read_upstream", "write_draft"]);
    }
    assert.deepEqual(failures, ["bash", "read", "write", "edit"]);
    assert.equal(existsSync(join(f.store.projectDir(f.project.id), "artifacts")), false);
  } finally { f.cleanup(); }
});

test("两轮模型上下文系统提示与模板逐字相同，不残留默认 cwd 或 AGENTS", async () => {
  const f = await setup([{ text: "一" }, { text: "二" }]);
  try {
    await f.session.prompt("第一轮"); await f.session.prompt("第二轮");
    for (const context of f.fake.contexts) {
      assert.equal(getCurrentSystemPrompt(context.messages), TOPIC_PROMPT);
      assert.equal(context.messages.filter(m => m.role === "system").length, 1);
      assert.ok(!getCurrentSystemPrompt(context.messages).includes(packageRoot));
    }
  } finally { f.cleanup(); }
});

test("write_draft 缺字段不落盘且把错误返回模型", async () => {
  const f = await setup([{ call: "write_draft", args: { artifact: { title: "不完整" } } }, { text: "收到错误" }]);
  try {
    await f.session.prompt("提交");
    assert.equal(existsSync(join(f.store.projectDir(f.project.id), "artifacts")), false);
    assert.equal(f.store.load(f.project.id).stages.topic.status, "ready");
    assert.match(JSON.stringify(f.fake.contexts[1].messages), /schema 不合规/);
  } finally { f.cleanup(); }
});

test("write_draft 数字字符串不被 SDK 转换成合规草稿", async () => {
  const f = await setup([
    { call: "write_draft", args: { artifact: { ...sample("topic"), target_minutes: "3" } } }, { text: "收到错误" },
  ]);
  try {
    await f.session.prompt("提交");
    assert.equal(existsSync(f.store.artifactPath(f.project.id, "topic", 1)), false);
    assert.match(JSON.stringify(f.fake.contexts[1].messages), /schema 不合规/);
    assert.deepEqual(f.store.load(f.project.id).stages.topic.versions, []);
  } finally { f.cleanup(); }
});

test("write_draft 可修正错误后保存 v1，pending_review，不自动采用", async () => {
  const f = await setup([
    { call: "read_upstream", args: {} },
    { call: "write_draft", args: { artifact: {} } },
    { call: "write_draft", args: { artifact: sample("topic") } }, { text: "等待人工采用" },
  ]);
  try {
    const result = await runStage(f.session, f.store, f.project.id, "topic");
    assert.equal(result.stop_reason, "draft_written");
    assert.equal(result.errors.length, 1);
    const upstreamResult = f.fake.contexts[1].messages.find(m => m.role === "toolResult");
    assert.ok(upstreamResult && JSON.stringify(upstreamResult).includes('"null"'));
    assert.deepEqual(JSON.parse(readFileSync(f.store.artifactPath(f.project.id, "topic", 1), "utf8")), sample("topic"));
    const state = f.store.load(f.project.id).stages;
    assert.equal(state.topic.status, "pending_review");
    assert.equal(state.synopsis.status, "locked");
    f.store.adopt(f.project.id, "topic", 1);
    assert.equal(f.store.load(f.project.id).stages.synopsis.status, "ready");
  } finally { f.cleanup(); }
});

test("read_upstream 按 stage 读依赖的采用版本，忽略较新的未采用草稿", async () => {
  const f = await setup([{ text: "未运行" }]);
  try {
    f.store.writeDraft(f.project.id, "topic", sample("topic"));
    f.store.writeDraft(f.project.id, "topic", { ...sample("topic"), title: "未采用版本" });
    f.store.adopt(f.project.id, "topic", 1);
    const tool = createStageTools(f.store, f.project.id, "synopsis").find(t => t.name === "read_upstream")!;
    const context = f.session.extensionRunner!.createToolContext("upstream-test", undefined);
    const result = await tool.execute("upstream-test", { stage: "topic" }, undefined, undefined, context);
    assert.deepEqual(JSON.parse((result.content[0] as { type: "text"; text: string }).text), sample("topic"));
  } finally { f.cleanup(); }
});

test("read_upstream 越界读取先拒绝，不读项目或产物文件", async () => {
  const f = await setup([{ text: "未运行" }]);
  try {
    const tool = createStageTools(f.store, f.project.id, "storyboard").find(t => t.name === "read_upstream")!;
    const context = f.session.extensionRunner!.createToolContext("forbidden", undefined);
    let diskReads = 0;
    f.store.load = () => { diskReads += 1; throw new Error("不应读项目文件"); };
    f.store.readAdopted = () => { diskReads += 1; throw new Error("不应读产物文件"); };
    for (const stage of ["topic", "synopsis", "storyboard", "prompts", "../script"]) {
      assert.equal(Value.Check(tool.parameters, { stage }), false);
      await assert.rejects(() => tool.execute("forbidden", { stage }, undefined, undefined, context), /不是.*依赖/);
    }
    assert.equal(Value.Check(tool.parameters, {}), false);
    assert.equal(diskReads, 0);
  } finally { f.cleanup(); }
});

test("storyboard 能分别读取 script 与 bible；prompts 能读 storyboard 与 bible", async () => {
  const f = await setup([{ text: "未运行" }]);
  try {
    for (const stage of ["topic", "synopsis", "script", "bible"] as const) {
      f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
    }
    const context = f.session.extensionRunner!.createToolContext("dependencies", undefined);
    const storyboardTool = createStageTools(f.store, f.project.id, "storyboard").find(t => t.name === "read_upstream")!;
    for (const stage of ["script", "bible"] as const) {
      assert.equal(Value.Check(storyboardTool.parameters, { stage }), true);
      const result = await storyboardTool.execute("dependencies", { stage }, undefined, undefined, context);
      assert.deepEqual(JSON.parse((result.content[0] as { text: string }).text), sample(stage));
    }
    f.store.writeDraft(f.project.id, "storyboard", sample("storyboard")); f.store.adopt(f.project.id, "storyboard", 1);
    const promptsTool = createStageTools(f.store, f.project.id, "prompts").find(t => t.name === "read_upstream")!;
    for (const stage of ["storyboard", "bible"] as const) {
      assert.equal(Value.Check(promptsTool.parameters, { stage }), true);
      const result = await promptsTool.execute("dependencies", { stage }, undefined, undefined, context);
      assert.deepEqual(JSON.parse((result.content[0] as { text: string }).text), sample(stage));
    }
  } finally { f.cleanup(); }
});

test("topic 无依赖时空参数返回 null，指定阶段则向模型返回错误且不读盘", async () => {
  const f = await setup([{ call: "read_upstream", args: { stage: "topic" } }, { text: "知道了" }]);
  try {
    const tool = createStageTools(f.store, f.project.id, "topic").find(t => t.name === "read_upstream")!;
    const context = f.session.extensionRunner!.createToolContext("topic-read", undefined);
    let diskReads = 0;
    f.store.load = () => { diskReads += 1; throw new Error("不应读项目文件"); };
    f.store.readAdopted = () => { diskReads += 1; throw new Error("不应读产物文件"); };
    const result = await tool.execute("topic-read", {}, undefined, undefined, context);
    assert.equal((result.content[0] as { text: string }).text, "null");
    await f.session.prompt("尝试读取");
    const error = f.fake.contexts[1].messages.find(m => m.role === "toolResult");
    assert.ok(error && error.role === "toolResult" && error.isError);
    assert.equal(diskReads, 0);
  } finally { f.cleanup(); }
});

test("SessionManager 文件落在项目 sessions 中且可重开，包含运行审计字段", async () => {
  const f = await setup([{ call: "write_draft", args: { artifact: sample("topic") } }, { text: "完成草稿" }]);
  try {
    await runStage(f.session, f.store, f.project.id, "topic");
    const dir = f.store.sessionDir(f.project.id), file = f.session.sessionManager.getSessionFile()!;
    assert.ok(file.startsWith(`${dir}/`));
    assert.equal(readdirSync(dir).length, 1);
    const reopened = SessionManager.open(file, dir);
    const entries = reopened.getEntries();
    const start = entries.find(e => e.type === "custom" && e.customType === "stage_run_start");
    const end = entries.find(e => e.type === "custom" && e.customType === "stage_run_end");
    assert.ok(start && start.type === "custom");
    assert.ok(end && end.type === "custom");
    const metadata = start.data as Record<string, unknown>;
    assert.equal(metadata.model, "ollama/qwen3.8:27b");
    assert.equal(metadata.system_prompt, TOPIC_PROMPT);
    assert.deepEqual(metadata.tools, ["read_upstream", "write_draft"]);
    assert.equal(typeof metadata.prompt, "string");
    assert.equal(typeof metadata.context_notes, "string");
    const summary = end.data as Record<string, unknown>;
    assert.equal(summary.stop_reason, "draft_written");
    assert.equal(typeof summary.duration_ms, "number");
    assert.deepEqual(summary.errors, []);
    assert.match(JSON.stringify(reopened.buildSessionContext().messages), /完成草稿/);
  } finally { f.cleanup(); }
});

test("模型只回复文本不算交付；记录 no_draft", async () => {
  const f = await setup([{ text: "我已经完成了" }]);
  try {
    const result = await runStage(f.session, f.store, f.project.id, "topic");
    assert.equal(result.stop_reason, "no_draft");
    assert.equal(f.store.load(f.project.id).stages.topic.status, "ready");
  } finally { f.cleanup(); }
});

test("反复提交错误草稿在八轮停止，不生成版本", async () => {
  const f = await setup(Array.from({ length: 10 }, () => ({ call: "write_draft", args: { artifact: {} } })));
  try {
    const result = await runStage(f.session, f.store, f.project.id, "topic");
    assert.equal(result.stop_reason, "max_turns");
    assert.equal(f.fake.contexts.length, 8);
    assert.equal(result.errors.length, 8);
    assert.equal(existsSync(f.store.artifactPath(f.project.id, "topic", 1)), false);
  } finally { f.cleanup(); }
});

test("创建会话也受状态机约束，占位阶段明确拒绝运行", async () => {
  const f = fixture(); try {
    const options = { root: packageRoot, store: f.store, projectId: f.project.id, stage: "synopsis" as const };
    await assert.rejects(() => createStageSession(options), /topic 尚未采用/);
    f.store.writeDraft(f.project.id, "topic", sample("topic")); f.store.adopt(f.project.id, "topic", 1);
    await assert.rejects(() => createStageSession(options), /模板尚未实现/);
    assert.equal(existsSync(join(f.store.projectDir(f.project.id), "sessions")), false);
    for (const stage of ["synopsis", "script", "bible", "storyboard", "prompts"] as const) assert.equal(STAGE_PROMPTS[stage], null);
  } finally { f.cleanup(); }
});
