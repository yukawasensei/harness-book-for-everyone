import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, symlinkSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { test, type TestContext } from "node:test";
import { STAGES, type Stage } from "./contracts/index.js";
import { createStageSession } from "./agent/session.js";
import { stagePrompt } from "./agent/prompts.js";
import { createLocalServer } from "./server/index.js";
import { createDemoSession } from "./server/demo.js";
import type { HostingOptions } from "./server/hosting.js";
import type { SessionFactory } from "./server/runs.js";
import type { MessageResponse, ProjectDetail, TimelineItem, TimelineResponse } from "./server/protocol.js";
import { ProjectStore } from "./project/store.js";
import { fakeStream } from "./testing/fake-model.js";
import { fixture, packageRoot, sample } from "./testing/fixtures.js";

const factory: SessionFactory = async options => {
  const session = await createStageSession({ ...options, root: packageRoot, model: { provider: "ollama", id: "qwen3.8:27b" } });
  session.agent.streamFunction = fakeStream(session.model!, options.stage === "story" ? [
    { call: "write_draft", args: { artifact: sample(options.stage) }, text: `开始创作 ${options.stage}` }, { text: "请审阅" },
  ] : options.stage === "script" ? [
    ...sample("script").scenes.map(scene => ({ call: "write_scene", args: { scene } })),
    { call: "finalize_draft", args: {} }, { text: "请审阅" },
  ] : [{ text: "无法交稿，请重试" }]).fn;
  return session;
};
// 合成公开令牌，仅用于隔离测试。
const tokens = { alice: "test-conversation-alice-0001", bob: "test-conversation-bob-000002" };
const hosting: HostingOptions = { mode: "hosted", tokens, dailyRuns: 20, maxConcurrent: 1 };
async function setup(t: TestContext, sessionFactory = factory, hosted?: HostingOptions) {
  const f = fixture();
  let app = createLocalServer({ root: hosted ? f.dir : packageRoot, ...(hosted ? { hosting: hosted } : { store: f.store }), sessionFactory });
  let base = await app.listen(0);
  t.after(async () => { await app.close(); f.cleanup(); });
  const request = (path: string, data?: unknown, method = data === undefined ? "GET" : "POST", user: keyof typeof tokens | null = "alice") => fetch(base + path, {
    method, headers: { "Content-Type": "application/json", ...(hosted && user ? { Authorization: `Bearer ${tokens[user]}` } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const path = `/api/projects/${f.project.id}`;
  const detail = async (id = f.project.id) => (await (await request(`/api/projects/${id}`)).json()) as ProjectDetail;
  const timeline = async (id = f.project.id) => (await (await request(`/api/projects/${id}/timeline`)).json() as TimelineResponse).items;
  const restart = async () => {
    await app.close();
    app = createLocalServer({ root: hosted ? f.dir : packageRoot, ...(hosted ? { hosting: hosted } : { store: new ProjectStore(f.dir) }), sessionFactory });
    base = await app.listen(0);
  };
  return { ...f, request, path, detail, timeline, restart };
}
async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeout = 10000) {
  const deadline = Date.now() + timeout;
  do { const value = await read(); if (accept(value)) return value; await setTimeout(10); } while (Date.now() < deadline);
  throw new Error("等待对话状态超时");
}
const noteContains = (items: TimelineItem[], text: RegExp) => items.some(i => i.kind === "assistant_note" && text.test(i.text));
function seed(f: ReturnType<typeof fixture>, stages: readonly Stage[] = STAGES) {
  for (const stage of stages) { f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1); }
}

for (const hosted of [undefined, hosting]) {
  test(`updated_at随消息、采用更新，列表详情一致且新store重启保留（${hosted ? "hosted" : "local"}）`, async t => {
    const f = await setup(t, factory, hosted);
    const created = await (await f.request("/api/projects", { title: "更新时间测试" })).json() as ProjectDetail;
    assert.equal(new Date(created.updated_at).toISOString(), created.updated_at);
    const initial = await f.detail(created.id);
    await setTimeout(20);
    assert.equal((await f.request(`/api/projects/${created.id}/messages`, { text: "写一个故事" })).status, 200);
    const drafted = await eventually(() => f.detail(created.id), p => !p.running && p.stages.story.status === "pending_review");
    assert.ok(Date.parse(drafted.updated_at) > Date.parse(initial.updated_at));
    await setTimeout(20);
    assert.equal((await f.request(`/api/projects/${created.id}/stages/story/adopt`, { version: 1 })).status, 200);
    const adopted = await eventually(() => f.detail(created.id), p => !p.running && p.stages.script.status === "pending_review");
    assert.ok(Date.parse(adopted.updated_at) > Date.parse(drafted.updated_at));
    const list = await (await f.request("/api/projects")).json() as ProjectDetail[];
    assert.equal(list.find(p => p.id === created.id)?.updated_at, adopted.updated_at);
    await f.restart();
    assert.equal((await f.detail(created.id)).updated_at, adopted.updated_at);
    const restartedList = await (await f.request("/api/projects")).json() as ProjectDetail[];
    assert.equal(restartedList.find(p => p.id === created.id)?.updated_at, adopted.updated_at);
  });
}

test("updated_at取会话末条at、审计末条at、所有版本mtime的最大值，读取不刷新", async t => {
  const f = await setup(t);
  const id = f.project.id;
  f.store.writeDraft(id, "story", sample("story"));
  const conversationAt = "2031-01-01T00:00:00.000Z", auditAt = "2032-01-01T00:00:00.000Z", versionAt = "2033-01-01T00:00:00.000Z";
  f.store.appendConversation(id, [
    { id: "old-note", kind: "assistant_note", text: "历史记录", at: "2030-01-01T00:00:00.000Z" },
    { id: "note", kind: "assistant_note", text: "持久化时间".repeat(2000), at: conversationAt },
  ]);
  assert.equal((await f.detail()).updated_at, conversationAt);
  f.store.auditAction(id, "test_timestamp", { at: auditAt });
  assert.equal((await f.detail()).updated_at, auditAt);
  utimesSync(f.store.artifactPath(id, "story", 1), new Date(versionAt), new Date(versionAt));
  assert.equal((await f.detail()).updated_at, versionAt);
  // 老版本也可能被恢复或重新写入，不能只看版本号最大的文件。
  f.store.writeDraft(id, "story", sample("story"));
  assert.equal((await f.detail()).updated_at, versionAt);
  await f.restart();
  assert.equal((await f.detail()).updated_at, versionAt);
});

test("首条消息创建项目、默认标题前20字、采用推进无开关；消息校验在创建之前", async t => {
  const f = await setup(t);
  const message = "想拍一个雨天的候船亭故事，三分钟，温暖而克制";
  const r = await f.request("/api/projects", { message });
  assert.equal(r.status, 201);
  const p = await r.json() as ProjectDetail;
  assert.equal(p.title, Array.from(message).slice(0, 20).join("")); assert.ok(!Object.hasOwn(p, "autopilot"));
  await eventually(() => f.detail(p.id), p => !p.running && p.stages.story.status === "pending_review");
  assert.equal((await f.timeline(p.id))[0].kind, "user_message");
  const before = f.store.list().length;
  for (const data of [{ message: " " }, { message: 5 }, { message: "a".repeat(8001) }, { title: " " }]) assert.equal((await f.request("/api/projects", data)).status, 400);
  assert.equal(f.store.list().length, before);
  const blank = await (await f.request("/api/projects", {})).json() as ProjectDetail;
  assert.equal(blank.title, "新任务"); assert.equal(blank.running, null);
});

test("路由1：初始化期间消息409，中文指出阶段，审计但不追加用户消息", async t => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const f = await setup(t, async options => { entered(); await gate; return factory(options); });
  const starting = f.request(`${f.path}/messages`, { text: "先写故事" });
  try {
    await ready;
    const r = await f.request(`${f.path}/messages`, { text: "第二条不应进会话" });
    assert.equal(r.status, 409); assert.match((await r.json()).error, /正在写故事.*中断/);
    assert.equal((await f.timeline()).filter(i => i.kind === "user_message").length, 1);
    assert.ok(f.store.readAudit(f.project.id).some(r => r.action === "message_routed" && r.rule === 1));
  } finally { release(); await starting; }
  await eventually(f.detail, p => !p.running);
});

test("路由2：优先依赖顺序最前阶段的最新pending稿，原文作为意见并启动修改", async t => {
  const f = await setup(t);
  f.store.writeDraft(f.project.id, "story", sample("story"));
  f.store.writeDraft(f.project.id, "story", sample("story"));
  const r = await f.request(`${f.path}/messages`, { text: "把主角改成老站长" });
  assert.equal(r.status, 200);
  const result = await r.json() as MessageResponse;
  assert.equal(result.action, "revise"); assert.equal(result.run?.stage, "story");
  const p = await eventually(f.detail, p => !p.running && p.stages.story.versions.length === 3);
  assert.equal(p.stages.story.reviews?.[2].note, "把主角改成老站长");
  assert.equal(p.stages.story.reviews?.[1].status, "pending");
  const run = (await f.timeline()).find(i => i.kind === "run");
  assert.ok(run?.kind === "run" && run.revise_from === 2 && run.status === "done");
  assert.ok(f.store.readSessions(f.project.id).some(entries => JSON.stringify(entries).includes("把主角改成老站长")));
});

test("路由3：取首个可运行阶段并把消息传入真实SDK用户提示", async t => {
  const f = await setup(t); seed(f, ["story"]);
  const r = await f.request(`${f.path}/messages`, { text: "结尾留白，四个叙事拍" });
  const result = await r.json() as MessageResponse;
  assert.equal(result.action, "run"); assert.equal(result.run?.stage, "script");
  await eventually(f.detail, p => !p.running && p.stages.script.status === "pending_review");
  const entries = f.store.readSessions(f.project.id).flat();
  assert.ok(entries.some(e => e.type === "custom" && e.customType === "stage_run_start" && JSON.stringify(e.data).includes("结尾留白，四个叙事拍")));
  assert.ok(f.store.readAudit(f.project.id).some(r => r.action === "message_routed" && r.rule === 3));
});

test("多阶段有待审候选时，依赖顺序优先于后阶段与消息内容", async t => {
  const f = await setup(t); seed(f, ["story"]);
  f.store.writeDraft(f.project.id, "script", sample("script"));
  f.store.writeDraft(f.project.id, "story", sample("story"));
  f.store.writeDraft(f.project.id, "story", sample("story"));
  const result = await (await f.request(`${f.path}/messages`, { text: "改一下剧本" })).json() as MessageResponse;
  assert.equal(result.action, "revise"); assert.equal(result.run?.stage, "story");
  const p = await eventually(f.detail, p => !p.running && p.stages.story.versions.length === 4);
  assert.equal(p.stages.story.reviews?.[3].status, "changes_requested");
  assert.equal(p.stages.story.reviews?.[2].status, "pending");
  assert.equal(p.stages.script.reviews?.[1].status, "pending");
});

test("路由4：全部采用后只写完成说明，不创建运行", async t => {
  const f = await setup(t, async () => { throw new Error("完成后不应创建会话"); }); seed(f);
  const r = await f.request(`${f.path}/messages`, { text: "接下来呢" });
  const result = await r.json() as MessageResponse;
  assert.equal(result.action, "none"); assert.equal(result.run, undefined);
  assert.ok(noteContains(await f.timeline(), /全流程已完成.*右侧.*返工/));
  assert.ok(f.store.readAudit(f.project.id).some(r => r.action === "message_routed" && r.rule === 4));
});

test("路由5：上游换版后按依赖顺序重跑首个待更新阶段并说明", async t => {
  const f = await setup(t); seed(f);
  const next = { ...sample("story"), logline: "一个新故事让原故事需要重新审阅。" };
  f.store.writeDraft(f.project.id, "story", next); f.store.adopt(f.project.id, "story", 2, true);
  const r = await f.request(`${f.path}/messages`, { text: "沿用角色，但重写故事" });
  assert.equal(r.status, 200);
  const result = await r.json() as MessageResponse;
  assert.equal(result.action, "run"); assert.equal(result.run?.stage, "script");
  await eventually(f.detail, p => !p.running && p.stages.script.versions.length === 2);
  assert.ok(noteContains(await f.timeline(), /剧本待更新.*重跑/));
  assert.ok(f.store.readAudit(f.project.id).some(r => r.action === "message_routed" && r.rule === 5));
});

test("采用只启动紧邻下一道，重复采用不启动，无设置PATCH或持久化开关", async t => {
  const f = await setup(t);
  f.store.writeDraft(f.project.id, "story", sample("story"));
  assert.equal((await f.request(`${f.path}/stages/story/adopt`, { version: 1 })).status, 200);
  const p = await eventually(f.detail, p => !p.running && p.stages.script.status === "pending_review");
  assert.equal(p.stages.bible.status, "locked");
  assert.equal(f.store.readAudit(f.project.id).filter(r => r.action === "auto_started").length, 1);
  assert.ok(noteContains(await f.timeline(), /故事已采用，开始写剧本/));
  assert.equal((await f.request(`${f.path}/stages/story/adopt`, { version: 1 })).status, 200);
  assert.equal(f.store.readAudit(f.project.id).filter(r => r.action === "auto_started").length, 1);
  assert.equal((await f.request(f.path, { autopilot: false }, "PATCH")).status, 404);
  assert.ok(!Object.hasOwn(await f.detail(), "autopilot"));
  assert.ok(!readFileSync(join(f.store.projectDir(f.project.id), "project.json"), "utf8").includes("autopilot"));
  await f.restart(); assert.ok(!Object.hasOwn(await f.detail(), "autopilot"));
});

test("上游换版须确认并保留stale返工，不静默启动其他ready阶段", async t => {
  let starts = 0;
  const f = await setup(t, async options => { starts++; return factory(options); });
  seed(f, ["story", "script"]);
  f.store.writeDraft(f.project.id, "story", sample("story"));
  assert.equal((await f.request(`${f.path}/stages/story/adopt`, { version: 2 })).status, 422);
  assert.equal((await f.request(`${f.path}/stages/story/adopt`, { version: 2, confirmed: true })).status, 200);
  assert.equal((await f.detail()).stages.script.status, "stale");
  assert.equal(starts, 0);
});

test("下一道已有采用结果时不跳去更后面的ready阶段", async t => {
  let starts = 0;
  const f = await setup(t, async options => { starts++; return factory(options); });
  seed(f, ["story", "script"]);
  await f.request(`${f.path}/stages/story/adopt`, { version: 1 });
  assert.equal((await f.detail()).stages.bible.status, "ready");
  assert.equal(starts, 0);
});

test("丢弃与要求修改均不自动推进", async t => {
  let starts = 0;
  const f = await setup(t, async options => { starts++; return factory(options); });
  for (const [version, operation] of [[1, "discard"], [2, "request-changes"]] as const) {
    f.store.writeDraft(f.project.id, "story", sample("story"));
    assert.equal((await f.request(`${f.path}/stages/story/${operation}`, { version, note: "重新考虑" })).status, 200);
    assert.equal((await f.detail()).running, null);
  }
  assert.equal(starts, 0);
  assert.deepEqual((await f.timeline()).filter(i => i.kind === "review_decision").map(i => i.kind === "review_decision" && i.decision), ["discarded", "changes_requested"]);
});

test("同格式遗留开关不影响采用策略，读取不改盘，后续保存不再持久化设置", async t => {
  const f = await setup(t);
  const target = join(f.store.projectDir(f.project.id), "project.json");
  const raw = JSON.stringify({ ...f.store.load(f.project.id), autopilot: false });
  writeFileSync(target, raw);
  assert.ok(!Object.hasOwn(await f.detail(), "autopilot"));
  assert.equal(readFileSync(target, "utf8"), raw);
  f.store.writeDraft(f.project.id, "story", sample("story"));
  assert.equal((await f.request(`${f.path}/stages/story/adopt`, { version: 1 })).status, 200);
  await eventually(f.detail, p => !p.running && p.stages.script.status === "pending_review");
  assert.ok(!readFileSync(target, "utf8").includes("autopilot"));
});

test("采用触发的初始化期间占运行锁，重复采用409且仅创建一个下游会话", async t => {
  let enter!: () => void, release!: () => void, starts = 0;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const f = await setup(t, async options => { starts++; enter(); await gate; return factory(options); });
  f.store.writeDraft(f.project.id, "story", sample("story"));
  const first = f.request(`${f.path}/stages/story/adopt`, { version: 1 });
  try {
    await entered;
    assert.equal((await f.request(`${f.path}/stages/story/adopt`, { version: 1 })).status, 409);
    assert.equal((await f.request(`${f.path}/stages/script/run`, {})).status, 409);
    assert.equal(starts, 1);
    assert.equal((await f.detail()).stages.story.status, "adopted");
  } finally { release(); await first; }
  await eventually(f.detail, p => !p.running);
  assert.equal((await f.request(`${f.path}/stages/story/adopt`, { version: 1 })).status, 200);
  assert.equal(starts, 1);
});

test("自动推进遭每日配额拒绝不创建会话，采用仍成功，写说明和审计", async t => {
  let starts = 0;
  const f = await setup(t, async options => { starts++; return factory(options); }, { ...hosting, dailyRuns: 1 });
  const p = await (await f.request("/api/projects", { message: "雨天短片" })).json() as ProjectDetail;
  await eventually(() => f.detail(p.id), p => !p.running && p.stages.story.status === "pending_review");
  assert.equal((await f.request(`/api/projects/${p.id}/stages/story/adopt`, { version: 1 })).status, 200);
  assert.equal(starts, 1); assert.equal((await f.detail(p.id)).stages.script.status, "ready");
  assert.equal((await f.detail(p.id)).stages.story.status, "adopted");
  assert.ok(noteContains(await f.timeline(p.id), /自动推进已停下.*今日/));
  const store = new ProjectStore(f.dir, "alice");
  assert.ok(store.readAudit(p.id).some(r => r.action === "auto_stopped"));
  assert.ok(!store.readAudit(p.id).some(r => r.action === "auto_started"));
  await f.request(`/api/projects/${p.id}/stages/story/adopt`, { version: 1 });
  assert.equal(starts, 1);
  assert.equal(store.readAudit(p.id).filter(r => r.action === "auto_stopped").length, 1);
});

test("自动推进执行失败后不再跑下游，失败结论与说明重启仍可读", async t => {
  let starts = 0;
  const f = await setup(t, async options => {
    starts++;
    const session = await factory(options);
    session.agent.streamFunction = fakeStream(session.model!, [{ text: "假模型本次没有交稿" }]).fn;
    return session;
  });
  f.store.writeDraft(f.project.id, "story", sample("story"));
  await f.request(`${f.path}/stages/story/adopt`, { version: 1 });
  await eventually(f.detail, p => !p.running);
  assert.equal(starts, 1); assert.equal((await f.detail()).stages.bible.status, "locked");
  const items = await f.timeline();
  assert.ok(items.some(i => i.kind === "run" && i.stage === "script" && i.status === "failed" && i.stop_reason === "no_draft"));
  assert.ok(noteContains(items, /剧本运行失败.*停下/));
  await f.restart(); assert.deepEqual(await f.timeline(), items);
});

test("中断会落盘interrupted，并能从时间线重读", async t => {
  const f = await setup(t, async options => {
    const session = await factory(options);
    session.agent.streamFunction = fakeStream(session.model!, [], { waitForAbort: true }).fn;
    return session;
  });
  await f.request(`${f.path}/messages`, { text: "等待中断" });
  assert.equal((await f.request(`${f.path}/abort`, {})).status, 202);
  await eventually(f.detail, p => !p.running);
  assert.ok((await f.timeline()).some(i => i.kind === "run" && i.status === "interrupted" && i.stop_reason === "aborted"));
});

test("SSE新增timeline_item包含用户消息、运行更新和审阅卡片，与持久化id一致", async t => {
  const f = await setup(t);
  const controller = new AbortController();
  // 用现有本机路由开 SSE；reader 在 finally 中取消，服务不留常驻连接。
  const response = await f.request(`${f.path}/events`);
  const reader = response.body!.getReader();
  let frames = "";
  const pumping = (async () => {
    const decoder = new TextDecoder();
    try { for (;;) { const value = await reader.read(); if (value.done) break; frames += decoder.decode(value.value, { stream: true }); } }
    catch (error) { if (!controller.signal.aborted) throw error; }
  })();
  try {
    await f.request(`${f.path}/messages`, { text: "SSE时间线" });
    await eventually(f.detail, p => !p.running && p.stages.story.versions.length === 1);
    await f.request(`${f.path}/stages/story/adopt`, { version: 1 });
    await eventually(async () => frames, text => text.includes('"kind":"review_decision"'));
    const items = frames.split("\n\n").flatMap(frame => {
      const line = frame.split("\n").find(line => line.startsWith("data: "));
      if (!line) return [];
      const event = JSON.parse(line.slice(6));
      return event.type === "timeline_item" ? [event.item as TimelineItem] : [];
    });
    assert.ok(items.some(i => i.kind === "user_message"));
    assert.ok(items.some(i => i.kind === "review_request"));
    const runs = items.filter(i => i.kind === "run" && i.stage === "story");
    assert.deepEqual(runs.map(i => i.kind === "run" && i.status), ["running", "done"]);
    assert.equal(runs[0].id, runs[1].id);
    await eventually(f.detail, p => !p.running);
    const persisted = await f.timeline();
    assert.ok(items.every(i => persisted.some(p => p.id === i.id)));
  } finally { controller.abort(); await reader.cancel(); await pumping; }
});

test("失败与初始化失败都停下并落盘", async t => {
  const f = await setup(t, async options => {
    if (options.stage === "script") throw new Error("假模型初始化故障");
    const session = await factory(options);
    session.agent.streamFunction = fakeStream(session.model!, [{ text: "未交稿" }]).fn;
    return session;
  });
  await f.request(`${f.path}/messages`, { text: "写一个故事" });
  await eventually(f.detail, p => !p.running);
  assert.ok((await f.timeline()).some(i => i.kind === "run" && i.status === "failed" && i.stop_reason === "no_draft"));
  assert.ok(noteContains(await f.timeline(), /失败.*停下/));
  f.store.writeDraft(f.project.id, "story", sample("story"));
  assert.equal((await f.request(`${f.path}/stages/story/adopt`, { version: 1 })).status, 200);
  assert.ok((await f.timeline()).some(i => i.kind === "run" && i.stage === "script" && i.status === "failed"));
  assert.equal((await f.detail()).running, null);
  assert.equal((await f.detail()).stages.story.status, "adopted");
  assert.equal((await f.detail()).stages.bible.status, "locked");
});

test("时间线重启可读，run从会话还原有序文本及中文工具结果，路径脱敏且无系统提示", async t => {
  const f = await setup(t, async options => {
    const session = await factory(options);
    session.agent.streamFunction = fakeStream(session.model!, [
      { call: "write_draft", args: { artifact: {} }, text: `私有路径 /srv/private/transcript.jsonl 和 C:\\private\\draft.json` },
      { call: "write_draft", args: { artifact: sample("story") }, text: "修正后提交" }, { text: "结束请审阅" },
    ]).fn;
    return session;
  });
  await f.request(`${f.path}/messages`, { text: "用户提示不应放进run transcript" });
  await eventually(f.detail, p => !p.running && p.stages.story.versions.length === 1);
  const before = await f.timeline();
  const run = before.find(i => i.kind === "run");
  assert.ok(run?.kind === "run"); assert.equal(run.status, "done"); assert.equal(run.version, 1);
  assert.deepEqual(run.transcript?.map(t => t.type), ["text", "tool", "text", "tool", "text"]);
  const tools = run.transcript?.filter(t => t.type === "tool") ?? [];
  assert.deepEqual(tools.map(t => t.ok), [false, true]); assert.equal(tools[0].label, "提交草稿"); assert.ok(tools[0].error);
  const output = JSON.stringify(run.transcript);
  assert.ok(!output.includes("/srv/") && !output.includes("private") && !output.includes("C:"));
  assert.ok(!output.includes(stagePrompt("story")) && !output.includes("用户提示不应"));
  const log = readFileSync(join(f.store.projectDir(f.project.id), "conversation.jsonl"), "utf8");
  assert.ok(log.includes('"status":"running"') && log.includes('"status":"done"'));
  assert.equal(before.filter(i => i.kind === "run").length, 1);
  await f.restart(); assert.deepEqual(await f.timeline(), before);
});

test("同格式项目从版本和审计合成稳定最小时间线，首次写入延续历史且不重复决定", async t => {
  const f = await setup(t); seed(f, ["story"]);
  f.store.writeDraft(f.project.id, "script", sample("script"));
  const before = await f.timeline();
  assert.deepEqual(before.map(i => i.kind), ["review_request", "review_decision", "review_request"]);
  assert.equal(f.store.readConversation(f.project.id), null);
  assert.deepEqual(await f.timeline(), before);
  await f.request(`${f.path}/stages/script/discard`, { version: 1 });
  const after = await f.timeline(); assert.equal(after.length, 4);
  await f.restart(); assert.deepEqual(await f.timeline(), after);
});

test("服务重启恢复遗留运行条目为interrupted且只追加一次说明", async t => {
  const f = fixture(); t.after(f.cleanup);
  const run = { id: "orphan", stage: "story" as const, started_at: new Date().toISOString(), abort_requested: false };
  f.store.saveRunLock(f.project.id, run);
  f.store.appendConversation(f.project.id, [{ kind: "run", id: "timeline-orphan", at: run.started_at, run_id: run.id, stage: "story", status: "running" }]);
  for (let i = 0; i < 2; i++) {
    const app = createLocalServer({ root: packageRoot, store: f.store, sessionFactory: factory });
    const base = await app.listen(0);
    try {
      const { items } = await (await fetch(`${base}/api/projects/${f.project.id}/timeline`)).json() as TimelineResponse;
      assert.equal(items.filter(i => i.kind === "assistant_note").length, 1);
      assert.ok(items.some(i => i.kind === "run" && i.status === "interrupted"));
    } finally { await app.close(); }
  }
});

test("hosted新增时间线、消息与PATCH均鉴权并跨用户404，时间线令牌脱敏", async t => {
  const f = await setup(t, async options => {
    const session = await factory(options);
    session.agent.streamFunction = fakeStream(session.model!, [{ text: `令牌 ${tokens.alice}；路径 /srv/private/raw.jsonl` }]).fn;
    return session;
  }, hosting);
  const p = await (await f.request("/api/projects", { message: "自己的对话" })).json() as ProjectDetail;
  await eventually(() => f.detail(p.id), p => !p.running);
  for (const [suffix, data, method] of [["/timeline", undefined, "GET"], ["/messages", { text: "跨用户" }, "POST"], ["", { autopilot: false }, "PATCH"]] as const) {
    assert.equal((await f.request(`/api/projects/${p.id}${suffix}`, data, method, null)).status, 401);
    assert.equal((await f.request(`/api/projects/${p.id}${suffix}`, data, method, "bob")).status, 404);
  }
  const items = JSON.stringify(await f.timeline(p.id));
  assert.ok(!items.includes(tokens.alice) && !items.includes("/srv/") && !items.includes("private"));
  const store = new ProjectStore(f.dir, "alice");
  assert.ok(store.readAudit(p.id).filter(r => r.action === "message_routed").every(r => r.actor === "alice"));
});

test("新增文件路径沿用真实路径隔离，拒绝conversation及session符号链接逃逸", async t => {
  const f = await setup(t, factory, hosting);
  const a = await (await f.request("/api/projects", { title: "alice" })).json() as ProjectDetail;
  const b = await (await f.request("/api/projects", { title: "bob" }, "POST", "bob")).json() as ProjectDetail;
  const alice = new ProjectStore(f.dir, "alice"), bob = new ProjectStore(f.dir, "bob");
  symlinkSync(join(bob.projectDir(b.id), "project.json"), join(alice.projectDir(a.id), "conversation.jsonl"));
  assert.ok((await f.request(`/api/projects/${a.id}/timeline`)).status >= 400);
  assert.ok((await f.request(`/api/projects/${a.id}/messages`, { text: "不能写入bob" })).status >= 400);
  mkdirSync(join(alice.projectDir(a.id), "sessions"));
  symlinkSync(join(bob.projectDir(b.id), "project.json"), join(alice.projectDir(a.id), "sessions", "linked.jsonl"));
  assert.throws(() => alice.readSessions(a.id), /越界/);
});

test("离线演示一句话、对话改稿、逐道采用到提示词，全程保留人工审阅门", async t => {
  const f = await setup(t, createDemoSession);
  assert.equal((await f.request(`${f.path}/messages`, { text: "拍一部候船亭短片" })).status, 200);
  await eventually(f.detail, p => !p.running && p.stages.story.status === "pending_review");
  const revision = await (await f.request(`${f.path}/messages`, { text: "把孩子换成老站长" })).json() as MessageResponse;
  assert.equal(revision.action, "revise");
  await eventually(f.detail, p => !p.running && p.stages.story.versions.length === 2);
  assert.ok(f.store.readVersion(f.project.id, "story", 2).logline.includes("老站长"));
  for (const [index, stage] of STAGES.entries()) {
    const p = await f.detail(); const version = p.stages[stage].versions.at(-1)!;
    assert.equal(p.stages[stage].status, "pending_review");
    assert.equal((await f.request(`${f.path}/stages/${stage}/adopt`, { version })).status, 200);
    if (index < STAGES.length - 1) await eventually(f.detail, p => !p.running && p.stages[STAGES[index + 1]].status === "pending_review", 25000);
    assert.equal((await f.request(`${f.path}/stages/${stage}/adopt`, { version })).status, 200);
    assert.equal((await f.detail()).running, null);
    assert.equal(f.store.readAudit(f.project.id).filter(r => r.action === "auto_started").length, Math.min(index + 1, 3));
  }
  assert.ok(Object.values((await f.detail()).stages).every(s => s.status === "adopted"));
  assert.equal(f.store.readAudit(f.project.id).filter(r => r.action === "auto_started").length, 3);
});
