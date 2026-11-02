import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import type { TranscriptContext } from "@earendil-works/pi-ai";
import { createLocalServer } from "./server/index.js";
import { createStageSession } from "./agent/session.js";
import { createDemoSession } from "./server/demo.js";
import { fakeStream, type Turn } from "./testing/fake-model.js";
import { fixture, packageRoot, sample } from "./testing/fixtures.js";
import type { ProjectDetail, ProjectEvent } from "./server/protocol.js";
import type { SessionFactory } from "./server/runs.js";

async function setup(options: { script?: Turn[]; waitForAbort?: boolean; beforeSession?: () => Promise<void>; factory?: SessionFactory } = {}) {
  const f = fixture();
  const contexts: TranscriptContext[] = [];
  const app = createLocalServer({
    root: packageRoot, store: f.store,
    sessionFactory: options.factory ?? (async sessionOptions => {
      await options.beforeSession?.();
      const session = await createStageSession({ ...sessionOptions, model: { provider: "ollama", id: "qwen3.8:27b" } });
      const fake = fakeStream(session.model!, options.script ?? [
        { call: "write_draft", args: { artifact: sample("topic") }, text: "正在写草稿" }, { text: "请审阅" },
      ], { waitForAbort: options.waitForAbort });
      session.agent.streamFunction = (...args) => {
        const stream = fake.fn(...args);
        contexts.push(fake.contexts.at(-1)!);
        return stream;
      };
      return session;
    }),
  });
  try {
    const base = await app.listen(0);
    const path = `/api/projects/${f.project.id}`;
    const get = async (url = path) => fetch(base + url);
    const post = async (url: string, data: unknown = {}) => fetch(base + url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    return {
      ...f, base, path, app, get, post, contexts,
      detail: async () => (await get()).json() as Promise<ProjectDetail>,
      cleanup: async () => { await app.close(); f.cleanup(); },
    };
  } catch (error) { f.cleanup(); throw error; }
}

async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const value = await read();
    if (accept(value)) return value;
    await setTimeout(10);
  }
  throw new Error("等待状态超时");
}

async function subscribe(base: string, path: string) {
  const controller = new AbortController();
  const response = await fetch(base + path + "/events", { signal: controller.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type")!, /text\/event-stream/);
  const frames: { id: number; event: ProjectEvent }[] = [];
  const reader = response.body!.getReader();
  const pumping = (async () => {
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (frame.startsWith(":")) continue;
        const id = Number(frame.match(/^id: (\d+)$/m)?.[1]);
        const data = frame.match(/^data: (.*)$/m)?.[1];
        assert.ok(data && Number.isSafeInteger(id));
        frames.push({ id, event: JSON.parse(data) });
      }
    }
  })();
  // 主动取消会抛 AbortError；其他读取错误仍需暴露。
  const done = pumping.catch(error => { if (!controller.signal.aborted) throw error; });
  await eventually(async () => frames.length, count => count > 0);
  return { frames, close: async () => { controller.abort(); await done; } };
}

test("HTTP 建/列项目、详情与版本 API；只监听 loopback，不提供静态文件", async () => {
  const f = await setup();
  try {
    const address = f.app.server.address();
    assert.ok(address && typeof address !== "string");
    assert.equal(address.address, "127.0.0.1");
    const created = await f.post("/api/projects", { title: "网页项目" });
    assert.equal(created.status, 201);
    const project = await created.json() as ProjectDetail;
    assert.equal(project.stages.topic.status, "ready");
    const list = await (await f.get("/api/projects")).json() as ProjectDetail[];
    assert.deepEqual(list.map(p => p.id).sort(), [f.project.id, project.id].sort());
    assert.equal((await f.get("/api/config")).status, 200);
    for (const path of ["/package.json", "/.env", "/api/projects/missing", `${f.path}/stages/topic/versions/1`]) {
      assert.ok((await f.get(path)).status >= 400);
    }
    assert.equal((await f.post("/api/projects", { title: " " })).status, 400);
    assert.equal((await f.get("/api/projects/%2e%2e%2foutside")).status, 422);
    const badJSON = await fetch(f.base + "/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(badJSON.status, 400);
    const external = await fetch(f.base + "/api/projects", { headers: { Origin: "https://other.example" } });
    assert.equal(external.status, 403);
  } finally { await f.cleanup(); }
});

test("SSE 转发真实 SDK text_delta、工具结束与阶段变化，每条 ID 递增；采用后解锁下一阶段", async () => {
  const f = await setup();
  const sse = await subscribe(f.base, f.path);
  try {
    assert.equal((await f.post(`${f.path}/stages/topic/run`, { instructions: "雨天，两位角色" })).status, 202);
    await eventually(async () => sse.frames, frames => frames.some(f => f.event.type === "run_ended"));
    assert.ok(sse.frames.some(f => f.event.type === "message_update" && f.event.assistantMessageEvent.type === "text_delta"));
    assert.ok(sse.frames.some(f => f.event.type === "tool_execution_end" && !f.event.isError));
    assert.ok(sse.frames.some(f => f.event.type === "project_state" && f.event.project.stages.topic.status === "pending_review"));
    assert.match(JSON.stringify(f.contexts[0].messages.find(m => m.role === "user")), /雨天，两位角色/);
    assert.equal((await f.detail()).last_run?.stop_reason, "draft_written");
    const artifact = await f.get(`${f.path}/stages/topic/versions/1`);
    assert.equal(artifact.status, 200);
    assert.deepEqual(await artifact.json(), sample("topic"));
    const adopted = await f.post(`${f.path}/stages/topic/adopt`, { version: 1 });
    assert.equal(adopted.status, 200);
    assert.equal((await f.detail()).stages.synopsis.status, "ready");
    await eventually(async () => sse.frames, frames => frames.some(f => f.event.type === "project_state" && f.event.project.stages.synopsis.status === "ready"));
    for (let i = 1; i < sse.frames.length; i++) assert.ok(sse.frames[i].id > sse.frames[i - 1].id);
  } finally { await sse.close(); await f.cleanup(); }
});

test("运行锁覆盖创建会话的 await；重复运行、采用均 409，启动期间可中断", async () => {
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const f = await setup({ beforeSession: async () => { enter(); await gate; } });
  let first: Promise<Response> | undefined;
  try {
    first = f.post(`${f.path}/stages/topic/run`);
    await entered;
    assert.equal((await f.post(`${f.path}/stages/topic/run`)).status, 409);
    assert.equal((await f.post(`${f.path}/stages/synopsis/run`)).status, 409);
    assert.equal((await f.post(`${f.path}/stages/topic/adopt`, { version: 1 })).status, 409);
    for (const operation of ["discard", "request-changes"]) {
      assert.equal((await f.post(`${f.path}/stages/topic/${operation}`, { version: 1, note: "改" })).status, 409);
    }
    assert.equal((await f.post(`${f.path}/abort`)).status, 202);
    release();
    assert.equal((await first).status, 202);
    const detail = await eventually(f.detail, p => !p.running && p.last_run !== null);
    assert.equal(detail.last_run?.stop_reason, "aborted");
    assert.equal(f.contexts.length, 0);
  } finally { release(); await first; await f.cleanup(); }
});

test("abort 传到 SDK/假模型 signal，运行结束、落盘 aborted、释放 409 锁", async () => {
  const f = await setup({ waitForAbort: true });
  try {
    assert.equal((await f.post(`${f.path}/stages/topic/run`)).status, 202);
    await eventually(async () => f.contexts.length, count => count === 1);
    assert.equal((await f.post(`${f.path}/stages/topic/run`)).status, 409);
    assert.equal((await f.post(`${f.path}/abort`)).status, 202);
    const detail = await eventually(f.detail, p => !p.running && p.last_run !== null);
    assert.equal(detail.last_run?.stop_reason, "aborted");
    assert.deepEqual(detail.stages.topic.versions, []);
    const file = readdirSync(f.store.sessionDir(f.project.id))[0];
    assert.match(readFileSync(join(f.store.sessionDir(f.project.id), file), "utf8"), /"stop_reason":"aborted"/);
    assert.equal((await f.post(`${f.path}/stages/topic/run`)).status, 202);
  } finally { await f.cleanup(); }
});

test("非法推进返回状态机原文；缺少模板或会话失败不留下运行锁", async () => {
  const f = await setup();
  try {
    const blocked = await f.post(`${f.path}/stages/synopsis/run`);
    assert.equal(blocked.status, 422);
    assert.match((await blocked.json() as { error: string }).error, /不能运行 synopsis：依赖阶段 topic 尚未采用版本/);
    const invalidAdopt = await f.post(`${f.path}/stages/topic/adopt`, { version: 1 });
    assert.equal(invalidAdopt.status, 422);
    f.store.writeDraft(f.project.id, "topic", sample("topic"));
    await f.post(`${f.path}/stages/topic/adopt`, { version: 1 });
    f.store.writeDraft(f.project.id, "synopsis", sample("synopsis"));
    f.store.adopt(f.project.id, "synopsis", 1);
    f.store.writeDraft(f.project.id, "script", sample("script"));
    f.store.adopt(f.project.id, "script", 1);
    f.store.writeDraft(f.project.id, "bible", sample("bible"));
    f.store.adopt(f.project.id, "bible", 1);
    const placeholder = await f.post(`${f.path}/stages/storyboard/run`);
    assert.equal(placeholder.status, 422);
    assert.match((await placeholder.json() as { error: string }).error, /模板尚未实现/);
    assert.equal((await f.detail()).running, null);
  } finally { await f.cleanup(); }
  const failed = await setup({ factory: async () => { throw new Error("模型配置不可用"); } });
  try {
    for (let i = 0; i < 2; i++) assert.equal((await failed.post(`${failed.path}/stages/topic/run`)).status, 422);
    assert.equal((await failed.detail()).running, null);
  } finally { await failed.cleanup(); }
});

test("SSE 断开不取消运行；轮询与重连快照显示草稿和运行结论，序号继续增长", async () => {
  const f = await setup();
  const first = await subscribe(f.base, f.path);
  const previous = first.frames.at(-1)!.id;
  try {
    await first.close();
    await f.post(`${f.path}/stages/topic/run`);
    const detail = await eventually(f.detail, p => !p.running && p.last_run !== null);
    assert.equal(detail.stages.topic.status, "pending_review");
    const second = await subscribe(f.base, f.path);
    try {
      assert.ok(second.frames[0].id > previous);
      const snapshot = second.frames[0].event;
      assert.equal(snapshot.type, "project_state");
      if (snapshot.type === "project_state") assert.deepEqual(snapshot.project, detail);
    } finally { await second.close(); }
  } finally { await first.close(); await f.cleanup(); }
});

test("不同项目可同时运行；关闭临时服务会中断自己的运行并关闭 SSE", async () => {
  const f = await setup({ waitForAbort: true });
  const sse = await subscribe(f.base, f.path);
  try {
    const other = f.store.create("另一个项目");
    assert.equal((await f.post(`${f.path}/stages/topic/run`)).status, 202);
    assert.equal((await f.post(`/api/projects/${other.id}/stages/topic/run`)).status, 202);
    await eventually(async () => f.contexts.length, n => n === 2);
  } finally { await f.cleanup(); await sse.close(); }
});

test("离线演示使用真实业务工具：错误卡片、修正草稿、完成摘要", async () => {
  const f = await setup({ factory: createDemoSession });
  const sse = await subscribe(f.base, f.path);
  try {
    await f.post(`${f.path}/stages/topic/run`);
    const detail = await eventually(f.detail, p => !p.running && p.last_run !== null);
    assert.equal(detail.last_run?.stop_reason, "draft_written");
    assert.equal(detail.last_run?.errors.length, 1);
    await eventually(async () => sse.frames, frames => frames.some(f => f.event.type === "run_ended"));
    assert.ok(sse.frames.some(f => f.event.type === "tool_execution_end" && f.event.isError));
    assert.deepEqual(f.store.readVersion(f.project.id, "topic", 1), sample("topic"));
  } finally { await sse.close(); await f.cleanup(); }
});

test("HTTP 审阅与修改运行：非法来源 4xx，SSE 带审阅状态，采用后禁止返工", async () => {
  const f = await setup();
  const sse = await subscribe(f.base, f.path);
  try {
    f.store.writeDraft(f.project.id, "topic", sample("topic"));
    const route = `${f.path}/stages/topic`;
    for (const revise_from of [1, 99, 0, "1", null]) {
      const response = await f.post(`${route}/run`, { revise_from });
      assert.ok(response.status >= 400 && response.status < 500);
      assert.ok((await response.json() as { error: string }).error);
    }
    assert.equal((await f.post(`${route}/request-changes`, { version: 1, note: " " })).status, 400);
    const note = "把结尾改为主动告别";
    assert.equal((await f.post(`${route}/request-changes`, { version: 1, note })).status, 200);
    await eventually(async () => sse.frames, frames => frames.some(f => f.event.type === "project_state"
      && f.event.project.stages.topic.reviews?.[1].status === "changes_requested"));
    assert.equal((await f.post(`${route}/run`, { revise_from: 1 })).status, 202);
    await eventually(f.detail, p => !p.running && p.stages.topic.versions.length === 2);
    const user = f.contexts[0].messages.find(m => m.role === "user");
    assert.ok(user?.role === "user" && Array.isArray(user.content));
    const prompt = user.content.filter(c => c.type === "text").map(c => c.text).join("");
    assert.ok(prompt.includes(readFileSync(f.store.artifactPath(f.project.id, "topic", 1), "utf8")));
    assert.ok(prompt.includes(note));
    assert.equal((await f.post(`${route}/discard`, { version: 2 })).status, 200);
    assert.equal((await f.post(`${route}/adopt`, { version: 2 })).status, 422);
    assert.equal((await f.post(`${route}/run`, { revise_from: 2 })).status, 422);
    assert.equal((await f.get(`${route}/versions/2`)).status, 200);
    f.store.writeDraft(f.project.id, "topic", sample("topic"));
    assert.equal((await f.post(`${route}/adopt`, { version: 3 })).status, 200);
    for (const operation of ["discard", "request-changes"]) {
      assert.equal((await f.post(`${route}/${operation}`, { version: 3, note: "改" })).status, 422);
    }
    assert.equal((await f.post(`${route}/run`, { revise_from: 1 })).status, 422);
    assert.equal((await f.detail()).stages.synopsis.status, "ready");
    const rows = readFileSync(join(f.store.projectDir(f.project.id), "audit.jsonl"), "utf8").trim().split("\n").map(row => JSON.parse(row));
    assert.deepEqual(rows.map(row => row.action), ["changes_requested", "discarded", "adopted"]);
    assert.ok(rows.every(row => row.actor === "local"));
  } finally { await sse.close(); await f.cleanup(); }
});

test("离线演示完整闭环：选题修改采用、梗概采用、逐场修正并汇总待审剧本", async () => {
  const f = await setup({ factory: createDemoSession });
  try {
    const topic = `${f.path}/stages/topic`;
    await f.post(`${topic}/run`);
    await eventually(f.detail, p => !p.running && p.stages.topic.versions.length === 1);
    const original = f.store.readVersion(f.project.id, "topic", 1);
    assert.equal((await f.post(`${topic}/request-changes`, { version: 1, note: "突出主角的主动选择" })).status, 200);
    assert.equal((await f.post(`${topic}/run`, { revise_from: 1 })).status, 202);
    await eventually(f.detail, p => !p.running && p.stages.topic.versions.length === 2);
    const revised = f.store.readVersion(f.project.id, "topic", 2);
    assert.notDeepEqual(revised, original);
    assert.match(revised.logline, /老站长/);
    assert.ok(!revised.logline.includes("孩子"));
    assert.equal((await f.post(`${topic}/adopt`, { version: 2 })).status, 200);
    const synopsis = `${f.path}/stages/synopsis`;
    assert.equal((await f.post(`${synopsis}/run`)).status, 202);
    await eventually(f.detail, p => !p.running && p.stages.synopsis.versions.length === 1);
    assert.equal((await f.post(`${synopsis}/adopt`, { version: 1 })).status, 200);
    assert.equal((await f.detail()).stages.script.status, "ready");
    const config = await (await f.get("/api/config")).json() as { runnable_stages: string[] };
    assert.deepEqual(config.runnable_stages, ["topic", "synopsis", "script", "bible"]);
    const sse = await subscribe(f.base, f.path);
    try {
      assert.equal((await f.post(`${f.path}/stages/script/run`)).status, 202);
      await eventually(f.detail, p => !p.running && p.stages.script.versions.length === 1);
      await eventually(async () => sse.frames, frames => frames.some(f => f.event.type === "run_ended" && f.event.run.stage === "script"));
      const events = sse.frames.map(frame => frame.event);
      const completed = events.filter(event => event.type === "tool_execution_end");
      assert.equal(completed.filter(event => event.toolName === "write_scene" && event.isError).length, 1);
      assert.equal(completed.filter(event => event.toolName === "write_scene" && !event.isError).length, 3);
      assert.ok(completed.some(event => event.toolName === "finalize_draft" && !event.isError));
      const artifact = f.store.readVersion(f.project.id, "script", 1);
      assert.deepEqual(artifact.scenes.map(scene => scene.scene_id), ["S01", "S02", "S03"]);
      assert.match(JSON.stringify(artifact), /老站长何望/);
      assert.ok(!JSON.stringify(artifact).includes("麦冬"));
      const detail = await f.detail();
      assert.equal(detail.stages.script.reviews?.[1].status, "pending");
      assert.equal(detail.stages.bible.status, "locked");
      const scriptPath = `${f.path}/stages/script`;
      assert.equal((await f.post(`${scriptPath}/request-changes`, { version: 1, note: "只修改 S02：让程禾先询问陆岑是否愿意讲述，其他场保持原样。" })).status, 200);
      const start = await f.post(`${scriptPath}/run`, { revise_from: 1 });
      assert.equal(start.status, 202);
      const run = await start.json() as { id: string };
      await eventually(f.detail, p => !p.running && p.stages.script.versions.length === 2);
      await eventually(async () => sse.frames, frames => frames.some(f => f.event.type === "run_ended" && f.event.run.id === run.id));
      const updated = f.store.readVersion(f.project.id, "script", 2);
      assert.equal(JSON.stringify(updated.scenes[0]), JSON.stringify(artifact.scenes[0]));
      assert.equal(JSON.stringify(updated.scenes[2]), JSON.stringify(artifact.scenes[2]));
      assert.notDeepEqual(updated.scenes[1], artifact.scenes[1]);
      assert.match(JSON.stringify(updated.scenes[1]), /你愿意讲给我们听吗/);
      const revisionEvents = sse.frames.map(frame => frame.event).filter(event => event.type === "tool_execution_end").filter(event => event.run_id === run.id);
      assert.deepEqual(revisionEvents.filter(event => event.toolName === "write_scene").map(event => event.isError), [false]);
      const finalized = revisionEvents.find(event => event.toolName === "finalize_draft");
      assert.ok(finalized);
      assert.match(JSON.stringify(finalized.result), /本版相对 v1：重交\/新增 S02；沿用 S01、S03/);
      const revisedDetail = await f.detail();
      assert.deepEqual(revisedDetail.last_run?.scene_changes, { revise_from: 1, resubmitted: ["S02"], reused: ["S01", "S03"], removed: [] });
      assert.equal(revisedDetail.stages.script.reviews?.[2].status, "pending");
      assert.equal(revisedDetail.stages.script.reviews?.[1].status, "changes_requested");
    } finally { await sse.close(); }
  } finally { await f.cleanup(); }
});

test("设定集离线 HTTP/SSE：漏角色被拒、补全待审、采用后分镜解锁；支持默认与老站长剧本", async () => {
  for (const older of [false, true]) {
    const f = await setup({ factory: createDemoSession });
    const sse = await subscribe(f.base, f.path);
    try {
      for (const stage of ["topic", "synopsis"] as const) {
        f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
      }
      const script = sample("script");
      if (older) for (const scene of script.scenes) {
        scene.summary = scene.summary.replaceAll("麦冬", "老站长何望");
        for (const line of scene.lines) {
          line.text = line.text.replaceAll("麦冬", "老站长何望");
          if (line.kind === "dialogue" && line.character === "麦冬") line.character = "老站长何望";
        }
      }
      f.store.writeDraft(f.project.id, "script", script); f.store.adopt(f.project.id, "script", 1);
      const route = `${f.path}/stages/bible`;
      assert.equal((await f.post(`${route}/run`)).status, 202);
      const detail = await eventually(f.detail, p => !p.running && p.stages.bible.versions.length === 1);
      await eventually(async () => sse.frames, frames => frames.some(f => f.event.type === "run_ended" && f.event.run.stage === "bible"));
      assert.equal(detail.last_run?.stop_reason, "draft_written");
      assert.equal(detail.last_run?.errors.length, 1);
      assert.match(detail.last_run!.errors[0], /覆盖检查.*陆岑.*S02/s);
      assert.equal(detail.stages.bible.reviews?.[1].status, "pending");
      assert.equal(detail.stages.storyboard.status, "locked");
      const writes = sse.frames.map(f => f.event).filter(e => e.type === "tool_execution_end" && e.toolName === "write_draft");
      assert.deepEqual(writes.map(e => e.type === "tool_execution_end" ? e.isError : undefined), [true, false]);
      const artifact = await (await f.get(`${route}/versions/1`)).json();
      assert.ok(!("logline" in artifact));
      if (older) {
        assert.equal(artifact.characters[1].name, "何望");
        assert.ok(artifact.characters[1].aliases.includes("老站长何望"));
        assert.ok(!JSON.stringify(artifact).includes("麦冬"));
      } else assert.deepEqual(artifact, sample("bible"));
      assert.equal((await f.post(`${route}/adopt`, { version: 1 })).status, 200);
      assert.equal((await f.detail()).stages.storyboard.status, "ready");
      await eventually(async () => sse.frames, frames => frames.some(f => f.event.type === "project_state" && f.event.project.stages.storyboard.status === "ready"));
    } finally { await sse.close(); await f.cleanup(); }
  }
});
