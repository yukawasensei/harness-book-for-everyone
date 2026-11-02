import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { connectProject, type EventConnection, type Connection } from "../web/src/live.js";
import { appendEvent } from "../web/src/timeline.js";
import { missingEventsNotice, runSummary, toolErrorText, toolResultText, stageBadge, readerMessage, runRequestText, DEMO_CHANGE_NOTE, DEMO_SCRIPT_CHANGE_NOTE, demoChangeNote, demoRevisionNotice, reviewLabels } from "../web/src/presentation.js";
import { rememberSelectedProject, restoreSelectedProject } from "../web/src/project-selection.js";
import type { ProjectDetail, ProjectEvent, RunResult } from "./server/protocol.js";
import { assertRunnable, initialWorkflow } from "./workflow/index.js";
import { createLocalServer } from "./server/index.js";
import { stagePrompt } from "./agent/prompts.js";
import { fixture, packageRoot, sample } from "./testing/fixtures.js";

const snapshot = (): ProjectDetail => ({
  id: "test-project", title: "离线网页测试", stages: initialWorkflow(), running: null, last_run: null,
  run_blocked_reasons: { topic: null, synopsis: "依赖未采用", script: "依赖未采用", bible: "依赖未采用", storyboard: "依赖未采用", prompts: "依赖未采用" },
});
function event(source: EventConnection, id: number, data: ProjectEvent) {
  source.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data), lastEventId: String(id) }));
}

test("页面 SSE 出错后实际读取详情轮询；重连快照恢复实时状态并停止轮询；卸载关闭连接", async () => {
  const source: EventConnection = { onmessage: null, onerror: null, close: () => { closed = true; } };
  const connections: Connection[] = [], states: ProjectDetail[] = [];
  let reads = 0, closed = false;
  const adopted = snapshot();
  adopted.stages.topic.status = "adopted";
  adopted.stages.topic.versions = [1];
  adopted.stages.topic.adopted_version = 1;
  adopted.stages.synopsis.status = "ready";
  const feed = connectProject("test-project", {
    state: project => states.push(project), connection: connection => connections.push(connection),
    event: () => {}, error: message => assert.fail(message),
  }, {
    open: url => { assert.equal(url, "/api/projects/test-project/events"); return source; },
    read: async url => { assert.equal(url, "/api/projects/test-project"); reads++; return adopted; }, pollMs: 10,
  });
  try {
    event(source, 1, { type: "project_state", project: snapshot() });
    source.onerror?.(new Event("error"));
    await setTimeout(35);
    assert.ok(reads >= 3);
    assert.equal(states.at(-1)?.stages.synopsis.status, "ready");
    // 模拟服务重启后从 1 编号，不能永远忽略新连接。
    event(source, 1, { type: "project_state", project: adopted });
    const before = reads;
    await setTimeout(30);
    assert.equal(reads, before);
    assert.deepEqual(connections, ["connecting", "live", "polling", "live"]);
  } finally { feed.close(); }
  assert.equal(closed, true);
  const count = states.length;
  event(source, 3, { type: "project_state", project: snapshot() });
  assert.equal(states.length, count);
});

test("晚到的轮询不覆盖 SSE 新快照；重复事件不重复追加；关闭后忽略在途结果", async () => {
  const source: EventConnection = { onmessage: null, onerror: null, close: () => {} };
  let resolve!: (project: ProjectDetail) => void;
  let reads = 0;
  const states: ProjectDetail[] = [], received: ProjectEvent[] = [];
  const feed = connectProject("test-project", {
    state: p => states.push(p), event: e => received.push(e), connection: () => {}, error: message => assert.fail(message),
  }, { open: () => source, read: () => { reads++; return new Promise(r => { resolve = r; }); } });
  try {
    event(source, 10, { type: "project_state", project: { ...snapshot(), title: "新快照" } });
    event(source, 10, { type: "project_state", project: snapshot() });
    resolve(snapshot());
    await setTimeout(0);
    assert.equal(states.length, 1);
    assert.equal(states[0].title, "新快照");
    assert.equal(received.length, 1);
    const pending = feed.refresh();
    feed.close();
    resolve(snapshot());
    await pending;
    assert.equal(reads, 2);
    assert.equal(states.length, 1);
  } finally { feed.close(); }
});

test("页面合并流式文本、更新工具成功/错误；缺失结束事件保持未知而非伪成功", () => {
  const context = { stage: "topic" as const, run_id: "run-one" };
  let rows = appendEvent([], { ...context, type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "开始", contentIndex: 0 } });
  rows = appendEvent(rows, { ...context, type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "创作", contentIndex: 0 } });
  assert.deepEqual(rows[0], { kind: "text", id: "run-one:text:0", text: "开始创作" });
  for (const [callId, isError] of [["bad", true], ["good", false]] as const) {
    rows = appendEvent(rows, { ...context, type: "tool_execution_start", toolCallId: callId, toolName: "write_draft", args: { artifact: {} } });
    rows = appendEvent(rows, { ...context, type: "tool_execution_end", toolCallId: callId, toolName: "write_draft", isError, result: {} });
  }
  assert.ok(rows.some(r => r.kind === "tool" && r.status === "error"));
  assert.ok(rows.some(r => r.kind === "tool" && r.status === "success"));
  rows = appendEvent(rows, { ...context, type: "tool_execution_start", toolCallId: "lost", toolName: "read_upstream", args: {} });
  rows = appendEvent(rows, { type: "project_state", project: snapshot() });
  assert.ok(rows.some(r => r.kind === "tool" && r.id === "run-one:lost" && r.status === "unknown"));
});

test("成功写草稿的运行记录显示拒绝次数摘要，原始错误只保留在详情", () => {
  const raw = JSON.stringify({ content: [{ type: "text", text: "topic schema 不合规：缺少 title" }] });
  const rows = appendEvent([], { type: "run_ended", run: {
    id: "run-retried", stage: "topic", started_at: "2026-11-02T00:00:00Z", abort_requested: false,
    stop_reason: "draft_written", errors: [raw],
  } });
  const row = rows[0];
  assert.ok(row.kind === "note");
  assert.match(row.text, /草稿已保存，待审阅；过程中被校验拒绝 1 次/);
  assert.ok(!row.text.includes(raw));
  assert.deepEqual(row.details, [raw]);
});

const completed = (errors: string[] = []): RunResult => ({
  id: "run-before-refresh", stage: "topic", started_at: "2026-11-02T00:00:00Z", abort_requested: false,
  stop_reason: "draft_written", errors,
});

test("最近运行成功后保持正常色摘要；失败仍有失败状态，原始错误不混进摘要", () => {
  const run = completed(["原始错误一", "原始错误二"]);
  assert.deepEqual(runSummary(run), { text: "草稿已保存，待审阅；过程中被校验拒绝 2 次", failed: false });
  assert.deepEqual(runSummary(completed()), { text: "草稿已保存，待审阅", failed: false });
  assert.deepEqual(runSummary({ ...run, stop_reason: "model_error" }), { text: "模型请求失败", failed: true });
  assert.deepEqual(runSummary({ ...run, stop_reason: "aborted" }), { text: "运行已中断", failed: false });
});

test("工具错误从 content.text 提取多段可读拒绝原因，不输出原始 JSON；缺失时给可读回退", () => {
  const result = { content: [
    { type: "text", text: "topic schema 不合规：缺少 title" },
    { type: "image", data: "忽略非文本块" },
    { type: "text", text: "target_minutes 必须为正数" },
    { type: "text", text: 123 }, null,
  ], details: { internal: "仅在原始结果展开区显示" } };
  assert.equal(toolErrorText(result), "产物缺少片名；目标时长必须为正数");
  for (const value of [undefined, null, {}, { content: null }, { content: [{ type: "text", text: " " }] }]) {
    assert.match(toolErrorText(value), /未收到可读原因.*展开查看原始结果/);
  }
});

test("刷新后恢复当前项目；新建或切换后的选择也持久保存，空 ID 不覆盖", () => {
  const values = new Map<string, string>();
  const access = () => ({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  });
  const projects = [{ id: "first" }, { id: "selected" }, { id: "new" }];
  rememberSelectedProject("selected", access);
  assert.equal(restoreSelectedProject(projects, access), "selected");
  rememberSelectedProject("new", access);
  rememberSelectedProject("", access);
  assert.equal(restoreSelectedProject(projects, access), "new");
});

test("localStorage 缺失、已存项目不存在或读写抛错时均可回退，项目列表空时返回空 ID", () => {
  const projects = [{ id: "first" }];
  const empty = () => ({ getItem: () => null, setItem: () => {} });
  const missing = () => ({ getItem: () => "deleted", setItem: () => {} });
  const blockedAccess = () => { throw new Error("存储访问被禁用"); };
  const blockedMethods = () => ({
    getItem: () => { throw new Error("读取被拒绝"); },
    setItem: () => { throw new Error("写入失败或空间已满"); },
  });
  for (const access of [empty, missing, blockedAccess, blockedMethods]) {
    assert.equal(restoreSelectedProject(projects, access), "first");
    assert.equal(restoreSelectedProject([], access), "");
    assert.doesNotThrow(() => rememberSelectedProject("first", access));
  }
});

test("刷新或服务重启后的已有运行给缺失事件说明；新项目及已收到的当前运行不误提示", () => {
  const project = snapshot();
  assert.equal(missingEventsNotice(null, []), null);
  assert.equal(missingEventsNotice(project, []), null);
  project.last_run = completed();
  assert.match(missingEventsNotice(project, [])!, /刷新前的实时事件未保存.*会话记录/);
  const rows = appendEvent([], { type: "run_ended", run: project.last_run });
  assert.equal(missingEventsNotice(project, rows), null);
  project.running = { id: "active-before-refresh", stage: "topic", started_at: "2026-11-02T00:00:00Z", abort_requested: false };
  project.last_run = null;
  assert.ok(missingEventsNotice(project, []));
  assert.equal(missingEventsNotice(project, appendEvent([], { type: "run_started", run: project.running })), null);
  project.running = null;
  project.stages.topic.versions = [1];
  assert.ok(missingEventsNotice(project, []));
});

test("禁用原因由服务端真实状态机和模板检查给出：依赖未采用、已采用、模板未实现", async () => {
  const f = fixture();
  const app = createLocalServer({ root: packageRoot, store: f.store });
  try {
    const base = await app.listen(0);
    const read = async () => (await fetch(`${base}/api/projects/${f.project.id}`)).json() as Promise<ProjectDetail>;
    let project = await read();
    assert.equal(project.run_blocked_reasons.topic, null);
    assert.throws(() => assertRunnable(project.stages, "synopsis"), error => {
      assert.equal(project.run_blocked_reasons.synopsis, (error as Error).message); return true;
    });
    f.store.writeDraft(f.project.id, "topic", sample("topic"));
    assert.equal((await read()).run_blocked_reasons.topic, null);
    f.store.adopt(f.project.id, "topic", 1);
    project = await read();
    assert.throws(() => assertRunnable(project.stages, "topic"), error => {
      assert.equal(project.run_blocked_reasons.topic, (error as Error).message); return true;
    });
    assert.equal(project.run_blocked_reasons.synopsis, null);
    f.store.writeDraft(f.project.id, "synopsis", sample("synopsis"));
    f.store.adopt(f.project.id, "synopsis", 1);
    project = await read();
    assert.equal(project.run_blocked_reasons.script, null);
    f.store.writeDraft(f.project.id, "script", sample("script"));
    f.store.adopt(f.project.id, "script", 1);
    project = await read();
    assert.equal(project.run_blocked_reasons.bible, null);
    f.store.writeDraft(f.project.id, "bible", sample("bible"));
    f.store.adopt(f.project.id, "bible", 1);
    project = await read();
    assert.equal(project.run_blocked_reasons.storyboard, null);
    f.store.writeDraft(f.project.id, "storyboard", sample("storyboard"));
    f.store.adopt(f.project.id, "storyboard", 1);
    project = await read();
    assert.throws(() => stagePrompt("prompts"), error => {
      assert.equal(project.run_blocked_reasons.prompts, (error as Error).message); return true;
    });
  } finally { await app.close(); f.cleanup(); }
});


test("阶段与版本统一待审阅，运行徽标跟随实际运行阶段", () => {
  assert.equal(stageBadge("pending_review", "topic", null).text, "待审阅");
  assert.equal(stageBadge("pending_review", "topic", null).text, reviewLabels.pending);
  assert.deepEqual(stageBadge("pending_review", "topic", { ...completed(), stage: "topic" }), { text: "运行中", className: "running" });
  assert.equal(stageBadge("locked", "synopsis", { ...completed(), stage: "topic" }).text, "锁定");
});

test("读者看到采用限制的原因，不暴露章节排期；修改消息逐字显示已保存意见", () => {
  const states = initialWorkflow();
  states.topic.status = "adopted";
  let reason = "";
  try { assertRunnable(states, "topic"); } catch (error) { reason = (error as Error).message; }
  const visible = readerMessage(reason);
  assert.ok(!/P[0-9]|留到/.test(visible));
  assert.match(visible, /暂不支持.*运行/);
  assert.equal(visible, "选题已采用，暂不支持再次运行。");
  assert.ok(!readerMessage("已采用版本不可丢弃或要求修改；返工留到 P8").includes("P8"));
  const note = "  把孩子换成一位老站长。\n保留空白格。  ";
  const message = runRequestText("topic", "额外要求", { version: 1, note });
  assert.ok(message.includes(note));
  assert.ok(message.includes("额外要求"));
  assert.match(message, /选题 v1/);
});


test("演示预填意见；自定义意见提示预设结果，真实模式不误提示", () => {
  assert.match(DEMO_CHANGE_NOTE, /把孩子换成一位老站长/);
  assert.equal(demoRevisionNotice(true, DEMO_CHANGE_NOTE), null);
  assert.equal(demoRevisionNotice(true, "改成太空站"), "离线演示的修改结果为预设内容");
  assert.equal(demoRevisionNotice(false, "改成太空站"), null);
});

test("剧本演示预填仅改 S02 的意见；汇总结果可读显示原版本与重交、沿用场号", () => {
  assert.equal(demoChangeNote("topic"), DEMO_CHANGE_NOTE);
  assert.equal(demoChangeNote("script"), DEMO_SCRIPT_CHANGE_NOTE);
  assert.match(DEMO_SCRIPT_CHANGE_NOTE, /只修改 S02/);
  assert.equal(demoRevisionNotice(true, DEMO_SCRIPT_CHANGE_NOTE, "script"), null);
  assert.equal(demoRevisionNotice(true, DEMO_CHANGE_NOTE, "script"), "离线演示的修改结果为预设内容");
  assert.equal(demoRevisionNotice(false, "删掉第一场", "script"), null);
  assert.equal(toolResultText({ content: [{ type: "text", text: "本版相对 v1：重交/新增 S02；沿用 S01、S03；删除 无。" }] }), "本版相对 v1：重交 S02；沿用 S01、S03。");
});
