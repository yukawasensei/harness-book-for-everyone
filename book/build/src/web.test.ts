import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { connectProject, mergeTimelineItems, type EventConnection, type Connection } from "../web/src/lib/api/index.js";
import { appendEvent } from "../web/src/features/chat/lib/append-event.js";
import { formatToolArgs, TOOL_ARG_LABELS } from "../web/src/features/chat/lib/format-tool-args.js";
import { missingEventsNotice, nextActionStage, projectHasProgress, runSummary, toolErrorText, toolResultText, stageBadge, stageNames, stageStatusHelp, readerMessage, runRequestText, DEMO_CHANGE_NOTE, DEMO_SCRIPT_CHANGE_NOTE, demoChangeNote, demoRevisionNotice, reviewLabels } from "../web/src/features/artifacts/lib/presentation.js";
import { progressChip, processStatusLabel } from "../web/src/features/artifacts/lib/process-status.js";
import { rememberSelectedProject, restoreSelectedProject } from "../web/src/features/sessions/lib/project-selection.js";
import type { ProjectDetail, ProjectEvent, RunResult, TimelineItem } from "./server/protocol.js";
import { assertRunnable, initialWorkflow } from "./workflow/index.js";
import { createLocalServer } from "./server/index.js";
import { stagePrompt } from "./agent/prompts.js";
import { fixture, packageRoot, sample } from "./testing/fixtures.js";

test("分镜板文本导出保留原文、指定历史版本及鉴权，并沿用JSON错误提示", async t => {
  const { endpoints, ApiError, setAccessToken } = await import("../web/src/lib/api/index.js");
  t.after(() => setAccessToken(""));
  const text = "# 分镜板 v3\n\n```text\n提示词原文\n```\n";
  const mock = t.mock.method(globalThis, "fetch", async (url: string | URL | Request, options?: RequestInit) => {
    assert.equal(url, "/api/projects/project%20id/stages/board/versions/3/export?format=markdown");
    assert.equal(options?.method, "GET");
    assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer public-export-test-token");
    return new Response(text, { headers: { "Content-Type": "text/markdown" } });
  });
  setAccessToken("public-export-test-token");
  assert.equal(await endpoints.projects.exportBoard("project id", 3), text);
  mock.mock.mockImplementation(async () => new Response(JSON.stringify({ error: "版本不可用" }), { status: 422 }));
  await assert.rejects(endpoints.projects.exportBoard("project id", 3), error => error instanceof ApiError && error.status === 422 && error.message === "版本不可用");
  mock.mock.mockImplementation(async () => new Response("{}", { status: 401 }));
  await assert.rejects(endpoints.projects.exportBoard("project id", 3), /令牌无效或已失效/);
  setAccessToken("");
  await assert.rejects(endpoints.projects.exportBoard("project id", 3), /未填写访问令牌/);
});

const snapshot = (): ProjectDetail => ({
  format_version: 2 as const, id: "test-project", title: "离线网页测试", updated_at: "2026-01-01T00:00:00.000Z", stages: initialWorkflow(), running: null, last_run: null,
  run_blocked_reasons: { story: null, script: "依赖未采用", bible: "依赖未采用", board: "依赖未采用" },
});
function event(source: EventConnection, id: number, data: ProjectEvent) {
  source.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data), lastEventId: String(id) }));
}

test("页面 SSE 出错后实际读取详情轮询；重连快照恢复实时状态并停止轮询；卸载关闭连接", async () => {
  const source: EventConnection = { onmessage: null, onerror: null, close: () => { closed = true; } };
  const connections: Connection[] = [], states: ProjectDetail[] = [];
  let reads = 0, closed = false;
  const adopted = snapshot();
  adopted.stages.story.status = "adopted";
  adopted.stages.story.versions = [1];
  adopted.stages.story.adopted_version = 1;
  adopted.stages.script.status = "ready";
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
    assert.equal(states.at(-1)?.stages.script.status, "ready");
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

test("轮询或重连后时间线按 id 合并不重复，同 id 以后到为准", () => {
  const note = (id: string, text: string): TimelineItem => ({
    kind: "assistant_note", id, at: "2026-01-01T00:00:00.000Z", text,
  });
  const review = (id: string, version: number): TimelineItem => ({
    kind: "review_request", id, at: "2026-01-01T00:01:00.000Z", stage: "script", version,
  });
  const cached = [note("n1", "旧说明"), review("r1", 1)];
  const polled = [note("n1", "轮询更新"), review("r1", 1), review("r2", 2)];
  const merged = mergeTimelineItems(cached, polled);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map(item => item.id), ["n1", "r1", "r2"]);
  assert.equal(merged[0].kind === "assistant_note" && merged[0].text, "轮询更新");
  const again = mergeTimelineItems(merged, [review("r2", 2), note("n1", "重连再取")]);
  assert.equal(again.length, 3);
  assert.equal(again[0].kind === "assistant_note" && again[0].text, "重连再取");
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
  const context = { stage: "story" as const, run_id: "run-one" };
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
  const raw = JSON.stringify({ content: [{ type: "text", text: "story schema 不合规：缺少 title" }] });
  const rows = appendEvent([], { type: "run_ended", run: {
    id: "run-retried", stage: "story", started_at: "2026-11-02T00:00:00Z", abort_requested: false,
    stop_reason: "draft_written", errors: [raw],
  } });
  const row = rows[0];
  assert.ok(row.kind === "note");
  assert.match(row.text, /草稿已保存，待审阅；过程中被校验拒绝 1 次/);
  assert.ok(!row.text.includes(raw));
  assert.deepEqual(row.details, [raw]);
});

const completed = (errors: string[] = []): RunResult => ({
  id: "run-before-refresh", stage: "story", started_at: "2026-11-02T00:00:00Z", abort_requested: false,
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
    { type: "text", text: "story schema 不合规：缺少 title" },
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
  project.running = { id: "active-before-refresh", stage: "story", started_at: "2026-11-02T00:00:00Z", abort_requested: false };
  project.last_run = null;
  assert.ok(missingEventsNotice(project, []));
  assert.equal(missingEventsNotice(project, appendEvent([], { type: "run_started", run: project.running })), null);
  project.running = null;
  project.stages.story.versions = [1];
  assert.ok(missingEventsNotice(project, []));
});

test("禁用原因来自真实依赖状态；已采用阶段可进入返工", async () => {
  const f = fixture();
  const app = createLocalServer({ root: packageRoot, store: f.store });
  try {
    const base = await app.listen(0);
    const read = async () => (await fetch(`${base}/api/projects/${f.project.id}`)).json() as Promise<ProjectDetail>;
    let project = await read();
    assert.equal(project.run_blocked_reasons.story, null);
    assert.throws(() => assertRunnable(project.stages, "script"), error => {
      assert.equal(project.run_blocked_reasons.script, (error as Error).message); return true;
    });
    f.store.writeDraft(f.project.id, "story", sample("story"));
    assert.equal((await read()).run_blocked_reasons.story, null);
    f.store.adopt(f.project.id, "story", 1);
    project = await read();
    assert.doesNotThrow(() => assertRunnable(project.stages, "story"));
    assert.equal(project.run_blocked_reasons.story, null);
    assert.equal(project.run_blocked_reasons.script, null);
    f.store.writeDraft(f.project.id, "script", sample("script"));
    f.store.adopt(f.project.id, "script", 1);
    project = await read();
    assert.equal(project.run_blocked_reasons.bible, null);
    f.store.writeDraft(f.project.id, "bible", sample("bible"));
    f.store.adopt(f.project.id, "bible", 1);
    project = await read();
    assert.equal(project.run_blocked_reasons.board, null);
    f.store.writeDraft(f.project.id, "board", sample("board"));
    f.store.adopt(f.project.id, "board", 1);
    project = await read();
    assert.ok(stagePrompt("board"));
    assert.equal(project.run_blocked_reasons.board, null);
  } finally { await app.close(); f.cleanup(); }
});


test("阶段与版本统一待审阅，运行徽标跟随实际运行阶段", () => {
  assert.equal(stageBadge("pending_review", "story", null).text, "待审阅");
  assert.equal(stageBadge("pending_review", "story", null).text, reviewLabels.pending);
  assert.deepEqual(stageBadge("pending_review", "story", { ...completed(), stage: "story" }), { text: "运行中", className: "running" });
  assert.equal(stageBadge("locked", "script", { ...completed(), stage: "story" }).text, "锁定");
});

test("工序条状态用文案稿说法；窄屏进度标签形如 2/4 剧本 · 待审阅", () => {
  const project = snapshot();
  assert.equal(processStatusLabel(project, "story"), "未开始");
  project.stages.story.status = "adopted";
  project.stages.story.versions = [1];
  project.stages.story.adopted_version = 1;
  project.stages.script.status = "pending_review";
  project.stages.script.versions = [1];
  assert.equal(processStatusLabel(project, "story"), "已采用");
  assert.equal(processStatusLabel(project, "script"), "待审阅");
  assert.equal(progressChip(project).text, "2/4 剧本 · 待审阅");
  project.running = { id: "r1", stage: "script", started_at: "2026-01-01T00:00:00.000Z", abort_requested: false };
  assert.equal(processStatusLabel(project, "script"), "进行中");
  assert.equal(progressChip(project).text, "2/4 剧本 · 进行中");
});

test("状态词有大白话说明；无进度时引导下一步为故事", () => {
  assert.match(stageStatusHelp("锁定") ?? "", /上一道还没采用/);
  assert.match(stageStatusHelp("可运行") ?? "", /可以开始运行/);
  assert.match(stageStatusHelp("待审阅") ?? "", /采用/);
  assert.equal(stageStatusHelp("不存在的状态"), null);
  const fresh = snapshot();
  assert.equal(projectHasProgress(fresh), false);
  assert.equal(nextActionStage(fresh, ["story", "script", "bible", "board"]), "story");
  fresh.stages.story.versions = [1];
  fresh.stages.story.status = "pending_review";
  assert.equal(projectHasProgress(fresh), true);
  assert.equal(nextActionStage(fresh, ["story", "script", "bible", "board"]), "story");
  assert.equal(
    Object.values(stageNames).join(" → "),
    "故事 → 剧本 → 设定集 → 分镜板",
  );
});

test("采用阶段可返工，待更新徽标中文显示；修改消息逐字显示意见", () => {
  const states = initialWorkflow();
  states.story.status = "adopted";
  let reason = "";
  try { assertRunnable(states, "story"); } catch (error) { reason = (error as Error).message; }
  const visible = readerMessage(reason);
  assert.ok(!/P[0-9]|留到/.test(visible));
  assert.equal(visible, "");
  assert.equal(stageBadge("stale", "board", null).text, "待更新");
  assert.ok(!readerMessage("已采用版本不可丢弃或要求修改；返工留到 P8").includes("P8"));
  const note = "  把孩子换成一位老站长。\n保留空白格。  ";
  const message = runRequestText("story", "额外要求", { version: 1, note });
  assert.ok(message.includes(note));
  assert.ok(message.includes("额外要求"));
  assert.match(message, /故事 v1/);
});


test("演示预填意见；自定义意见提示预设结果，真实模式不误提示", () => {
  assert.match(DEMO_CHANGE_NOTE, /把孩子换成一位老站长/);
  assert.equal(demoRevisionNotice(true, DEMO_CHANGE_NOTE), null);
  assert.equal(demoRevisionNotice(true, "改成太空站"), "离线演示的修改结果为预设内容");
  assert.equal(demoRevisionNotice(false, "改成太空站"), null);
});

test("剧本演示预填仅改 S02 的意见；汇总结果可读显示原版本与重交、沿用场号", () => {
  assert.equal(demoChangeNote("story"), DEMO_CHANGE_NOTE);
  assert.equal(demoChangeNote("script"), DEMO_SCRIPT_CHANGE_NOTE);
  assert.match(DEMO_SCRIPT_CHANGE_NOTE, /只修改 S02/);
  assert.equal(demoRevisionNotice(true, DEMO_SCRIPT_CHANGE_NOTE, "script"), null);
  assert.equal(demoRevisionNotice(true, DEMO_CHANGE_NOTE, "script"), "离线演示的修改结果为预设内容");
  assert.equal(demoRevisionNotice(false, "删掉第一场", "script"), null);
  assert.equal(toolResultText({ content: [{ type: "text", text: "本版相对 v1：重交/新增 S02；沿用 S01、S03；删除 无。" }] }), "本版相对 v1：重交 S02；沿用 S01、S03。");
});

test("运行提交被 429 拒绝时不追加运行消息，202 后才追加一次", async t => {
  const { submitRun, ApiError } = await import("../web/src/lib/api/index.js");
  const rows: string[] = [];
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: "已达到今日运行次数上限" }), { status: 429 }));
  await assert.rejects(submitRun("/api/projects/example/stages/story/run", {}, () => rows.push("运行故事")), error => error instanceof ApiError && error.status === 429);
  assert.equal(rows.length, 0);
  let respond!: (response: Response) => void;
  fetchMock.mock.mockImplementation(() => new Promise<Response>(resolve => { respond = resolve; }));
  const pending = submitRun("/api/projects/example/stages/story/run", {}, () => rows.push("运行故事"));
  assert.equal(rows.length, 0);
  respond(new Response("{}", { status: 202 }));
  await pending;
  assert.deepEqual(rows, ["运行故事"]);
});

test("401 区分未填写与失效令牌，按该次请求实际发送的身份判断", async t => {
  const { api, setAccessToken, getAccessToken, ApiError } = await import("../web/src/lib/api/index.js");
  const previous = getAccessToken(); t.after(() => setAccessToken(previous));
  const requests: Headers[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, options?: RequestInit) => {
    requests.push(new Headers(options?.headers));
    setAccessToken(""); // 等待响应期间切换身份，不得改变这次请求的错误含义。
    return new Response(JSON.stringify({ error: "请填写有效的访问令牌后连接" }), { status: 401 });
  });
  setAccessToken("");
  await assert.rejects(api("/api/config"), error => error instanceof ApiError && error.message === "未填写访问令牌");
  setAccessToken("public-invalid-token-for-test");
  await assert.rejects(api("/api/config"), error => error instanceof ApiError && error.message === "令牌无效或已失效");
  assert.equal(requests[0].has("authorization"), false);
  assert.equal(requests[1].get("authorization"), "Bearer public-invalid-token-for-test");
});

test("工具参数摘要映射中文标签；未知键进入技术详情", () => {
  assert.equal(TOOL_ARG_LABELS.shot_id, "镜头编号");
  assert.equal(TOOL_ARG_LABELS.shot_part, "镜头描述");
  assert.equal(TOOL_ARG_LABELS.stage, "阶段");
  assert.equal(TOOL_ARG_LABELS.scene_id, "场次编号");
  assert.equal(TOOL_ARG_LABELS.artifact, "草稿");

  const shot = formatToolArgs({ shot_id: "S03-02", shot_part: "陆岑开口，风吹进候船亭。" });
  assert.deepEqual(shot.lines, [
    { label: "镜头编号", value: "S03-02" },
    { label: "镜头描述", value: "陆岑开口，风吹进候船亭。" },
  ]);
  assert.equal(shot.technical, null);
  assert.ok(!JSON.stringify(shot.lines).includes("shot_id"));
  assert.ok(!JSON.stringify(shot.lines).includes("shot_part"));

  const staged = formatToolArgs('{"stage":"story"}');
  assert.deepEqual(staged.lines, [{ label: "阶段", value: "故事" }]);
  assert.equal(staged.technical, null);

  const mixed = formatToolArgs({ shot_id: "S01-01", debug_token: "raw", foo: 1 });
  assert.deepEqual(mixed.lines, [{ label: "镜头编号", value: "S01-01" }]);
  assert.match(mixed.technical!, /debug_token/);
  assert.match(mixed.technical!, /"foo": 1/);

  const summary = formatToolArgs("stage: script, version: 1");
  assert.deepEqual(summary.lines, [
    { label: "阶段", value: "剧本" },
    { label: "版本", value: "1" },
  ]);
  assert.equal(summary.technical, null);
});
