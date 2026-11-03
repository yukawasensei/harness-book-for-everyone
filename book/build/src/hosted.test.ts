import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { mkdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { createLocalServer } from "./server/index.js";
import { hostingFromEnv, publicData, TenantQuota, type HostingOptions } from "./server/hosting.js";
import { ProjectStore } from "./project/store.js";
import { createStageSession } from "./agent/session.js";
import { fixture, packageRoot, sample } from "./testing/fixtures.js";
import { fakeStream } from "./testing/fake-model.js";
import type { SessionFactory } from "./server/runs.js";
import type { ProjectDetail } from "./server/protocol.js";

// 公开的合成测试令牌，不可作为部署凭据。
const tokens = { alice: "test-alice-token-public-000001", bob: "test-bob-token-public-00000002" };
const hosting: HostingOptions = { mode: "hosted", tokens, maxConcurrent: 1, dailyRuns: 20, origin: "https://studio.example" };
const factory: SessionFactory = async options => {
  const session = await createStageSession({ ...options, root: packageRoot });
  session.agent.streamFunction = fakeStream(session.model!, [
    { call: "write_draft", args: { artifact: sample("story") }, text: `服务路径 ${options.store.sessionDir(options.projectId)}` }, { text: "请审阅" },
  ]).fn;
  return session;
};
async function setup(t: TestContext, config = hosting, sessionFactory = factory) {
  const f = fixture();
  const app = createLocalServer({ root: f.dir, hosting: config, sessionFactory });
  const base = await app.listen(0);
  t.after(async () => { await app.close(); f.cleanup(); });
  const request = (path: string, user: keyof typeof tokens | null = "alice", data?: unknown, extra: RequestInit = {}) => fetch(base + path, {
    method: data === undefined ? "GET" : "POST", ...extra,
    headers: { ...(user ? { Authorization: `Bearer ${tokens[user]}` } : {}), ...(data === undefined ? {} : { "Content-Type": "application/json" }), ...extra.headers },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const create = async (user: keyof typeof tokens = "alice") => (await (await request("/api/projects", user, { title: `${user} 的项目` })).json()) as ProjectDetail;
  return { ...f, app, base, request, create };
}
async function ended(f: Awaited<ReturnType<typeof setup>>, id: string) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const value = await (await f.request(`/api/projects/${id}`)).json() as ProjectDetail;
    if (!value.running) return value;
    await setTimeout(10);
  }
  throw new Error("运行未结束");
}

test("hosted 所有 REST/SSE 需要令牌；配置、错误令牌及查询令牌也不能绕过", async t => {
  const f = await setup(t);
  for (const path of ["/api/config", "/api/quota", "/api/projects", "/api/projects/unknown", "/api/projects/unknown/events", "/api/projects/unknown/sessions"]) {
    assert.equal((await f.request(path, null)).status, 401, path);
  }
  assert.equal((await f.request("/api/projects", null, { title: "未授权" })).status, 401);
  assert.equal((await f.request(`/api/projects?token=${tokens.alice}`, null)).status, 401);
  assert.equal((await f.request("/api/projects", null, undefined, { headers: { Authorization: "Bearer invalid" } })).status, 401);
  const settings = await (await f.request("/api/config")).json();
  assert.equal(settings.deployment, "hosted"); assert.equal(settings.user_id, "alice");
  assert.ok(!JSON.stringify(settings).includes(tokens.alice));
});

test("两个租户列表、读写、评分、运行、中断、SSE 与原始会话均隔离", async t => {
  const f = await setup(t), a = await f.create(), b = await f.create("bob");
  for (const [user, own, other] of [["alice", a, b], ["bob", b, a]] as const) {
    const list = await (await f.request("/api/projects", user)).json() as ProjectDetail[];
    assert.deepEqual(list.map(p => p.id), [own.id]);
    for (const suffix of ["", "/events", "/ratings", "/stages/story/versions/1", "/sessions"]) {
      const response = await f.request(`/api/projects/${other.id}${suffix}`, user);
      assert.equal(response.status, 404, suffix); assert.equal((await response.json()).error, "项目不存在");
    }
    for (const suffix of ["abort", "stages/story/run", "stages/story/adopt", "stages/story/discard", "stages/story/request-changes", "stages/story/confirm-valid", "stages/board/reassemble", "stages/story/rating"]) {
      assert.equal((await f.request(`/api/projects/${other.id}/${suffix}`, user, { version: 1 })).status, 404, suffix);
    }
    assert.equal((await f.request(`/api/projects/${own.id}/sessions/raw.jsonl`, user)).status, 404);
  }
  assert.equal(new ProjectStore(f.dir, "alice").load(a.id).id, a.id);
  assert.throws(() => new ProjectStore(f.dir, "alice").load(b.id), /项目不存在/);
});

test("非法 ID、编码路径穿越与阶段路径均被拒绝", async t => {
  const f = await setup(t), p = await f.create();
  for (const id of ["..", "../bob", "/etc/passwd", "a/b", "a\\b", "a\0b"]) {
    assert.throws(() => new ProjectStore(f.dir, "alice").projectDir(id));
  }
  for (const suffix of ["%2e%2e%2fbob", "%2Fetc%2Fpasswd", "%00", "%ZZ"]) {
    assert.ok((await f.request(`/api/projects/${suffix}`)).status >= 400);
  }
  assert.equal((await f.request(`/api/projects/${p.id}/stages/%2e%2e%2fsessions/versions/1`)).status, 422);
});

test("真实路径检查阻止项目、嵌套文件、暂存临时文件与用户根符号链接逃逸", async t => {
  const f = await setup(t), a = await f.create(), b = await f.create("bob");
  const store = new ProjectStore(f.dir, "alice"), other = new ProjectStore(f.dir, "bob");
  symlinkSync(other.projectDir(b.id), join(store.root, "linked"));
  assert.throws(() => store.load("linked"), /越界/);
  assert.equal((await f.request("/api/projects/linked")).status, 422);
  symlinkSync(join(other.projectDir(b.id), "project.json"), join(store.projectDir(a.id), "audit.jsonl"));
  assert.throws(() => store.auditAction(a.id, "test", {}), /越界/);
  mkdirSync(join(store.projectDir(a.id), "staging"));
  symlinkSync(join(other.projectDir(b.id), "project.json"), join(store.projectDir(a.id), "staging", "script.json.tmp"));
  assert.throws(() => store.saveStaging(a.id, "script", { finalized_version: null }), /越界/);
  mkdirSync(join(store.projectDir(a.id), "artifacts"));
  symlinkSync(other.projectDir(b.id), join(store.projectDir(a.id), "artifacts", "story"));
  assert.throws(() => store.writeDraft(a.id, "story", sample("story")), /越界/);
  symlinkSync(join(other.projectDir(b.id), "missing"), join(store.projectDir(a.id), "sessions"));
  assert.throws(() => store.sessionDir(a.id), /无效|越界/);
  renameSync(store.root, store.root + "-original");
  symlinkSync(other.root, store.root);
  assert.throws(() => store.load(a.id), /符号链接/);
  assert.throws(() => new ProjectStore(f.dir, "alice"), /符号链接/);
});

test("每用户并发在会话初始化期间预占；其他租户独立，中断后释放", async t => {
  let ready!: () => void;
  const gate = new Promise<void>(resolve => { ready = resolve; });
  const f = await setup(t, hosting, async options => { if (options.store.userId === "alice") await gate; return factory(options); });
  const a = await f.create(), a2 = await f.create(), b = await f.create("bob");
  const start = f.request(`/api/projects/${a.id}/stages/story/run`, "alice", {});
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await (await f.request("/api/quota")).json()).active === 1) break;
      await setTimeout(10);
    }
    const response = await f.request(`/api/projects/${a2.id}/stages/story/run`, "alice", {});
    assert.equal(response.status, 429); assert.match((await response.json()).error, /并发/);
    assert.equal((await f.request(`/api/projects/${b.id}/stages/story/run`, "bob", {})).status, 202);
    assert.equal((await f.request(`/api/projects/${a.id}/abort`, "alice", {})).status, 202);
  } finally { ready(); await start; }
  await ended(f, a.id);
  assert.equal((await f.request(`/api/projects/${a2.id}/stages/story/run`, "alice", {})).status, 202);
  await ended(f, a2.id);
  const audit = readFileSync(join(f.dir, "projects/alice/quota-audit.jsonl"), "utf8");
  assert.match(audit, /quota_denied/); assert.ok(!audit.includes(tokens.alice));
});

test("每日配额跨项目共享、落盘且重启保留；分阶段复用 usage；UTC 换日恢复", async t => {
  const config = { ...hosting, dailyRuns: 1 };
  const f = await setup(t, config), a = await f.create(), a2 = await f.create();
  assert.equal((await f.request(`/api/projects/${a.id}/stages/story/run`, "alice", {})).status, 202);
  const result = await ended(f, a.id);
  const response = await f.request(`/api/projects/${a2.id}/stages/story/run`, "alice", {});
  assert.equal(response.status, 429); assert.match((await response.json()).error, /今日/);
  const quota = new TenantQuota(f.dir, "alice", config);
  assert.equal(quota.snapshot().runs, 1);
  assert.equal(quota.snapshot().stages.story?.tokens, result.last_run?.usage?.totalTokens);
  assert.throws(() => quota.reserve(a2.id, "story"), /今日/);
  const second = createLocalServer({ root: f.dir, hosting: config, sessionFactory: factory });
  const base = await second.listen(0);
  try {
    assert.equal((await fetch(`${base}/api/projects/${a2.id}/stages/story/run`, { method: "POST", headers: { Authorization: `Bearer ${tokens.alice}`, "Content-Type": "application/json" }, body: "{}" })).status, 429);
  } finally { await second.close(); }
  writeFileSync(join(f.dir, "projects/alice/quota.json"), JSON.stringify({ day: "2000-01-01", runs: 900, stages: {} }));
  assert.equal(quota.snapshot().runs, 0);
  const release = quota.reserve(a2.id, "story"); release();
  assert.equal(quota.snapshot().stages.story?.usage_unknown, 1);
});

test("会话初始化失败也计日次数、释放并发并保留真实失败状态", async t => {
  const f = await setup(t, hosting, async () => { throw new Error("初始化失败，路径 /srv/private/session.jsonl"); });
  const a = await f.create();
  const r = await f.request(`/api/projects/${a.id}/stages/story/run`, "alice", {});
  assert.equal(r.status, 422); assert.ok(!(await r.text()).includes("/srv/"));
  const quota = await (await f.request("/api/quota")).json();
  assert.equal(quota.active, 0); assert.equal(quota.runs, 1);
});

test("REST/SSE 对服务器路径脱敏，原始会话留在服务端，审阅 actor 来自令牌", async t => {
  const f = await setup(t), a = await f.create();
  const controller = new AbortController();
  const response = await f.request(`/api/projects/${a.id}/events`, "alice", undefined, { signal: controller.signal });
  assert.equal(response.status, 200);
  const reader = response.body!.getReader();
  let frames = "";
  const reading = (async () => { const decoder = new TextDecoder(); try { for (;;) { const r = await reader.read(); if (r.done) break; frames += decoder.decode(r.value); } } catch { if (!controller.signal.aborted) throw new Error("SSE 读取失败"); } })();
  try {
    assert.equal((await f.request(`/api/projects/${a.id}/stages/story/run`, "alice", {})).status, 202);
    await ended(f, a.id);
    assert.equal((await f.request(`/api/projects/${a.id}/stages/story/adopt`, "alice", { version: 1 })).status, 200);
    for (let attempt = 0; !frames.includes('"run_ended"') && attempt < 100; attempt++) await setTimeout(10);
    assert.match(frames, /run_ended/); assert.ok(!frames.includes(f.dir)); assert.match(frames, /已隐藏/);
    assert.match(readFileSync(join(f.dir, "projects/alice", a.id, "audit.jsonl"), "utf8"), /"actor":"alice"/);
    const reviewed = await f.request(`/api/projects/${a.id}/stages/story/request-changes`, "alice", { version: 1, note: "请检查 /srv/private/session.jsonl 的草稿" });
    assert.equal(reviewed.status, 200);
    const payload = await reviewed.text(); assert.ok(!payload.includes("/srv/") && payload.includes("路径已隐藏"));
    assert.match(readFileSync(join(f.dir, "projects/alice", a.id, "audit.jsonl"), "utf8"), /\/srv\/private/);
  } finally { controller.abort(); await reading; }
  const raw = { encoded: JSON.stringify({ path: "/srv/private/raw.jsonl" }).replaceAll("/", "\\/"), path: "/etc/private/config", nested: [`C:\\service\\sessions\\raw.jsonl`, `路径 ${f.dir}/sessions/raw.jsonl`, tokens.bob], url: "https://studio.example/api" };
  const cleaned = JSON.stringify(publicData(raw, f.dir, Object.values(tokens)));
  assert.ok(!cleaned.includes("private") && !cleaned.includes("/etc/") && !cleaned.includes("service") && !cleaned.includes(f.dir) && !cleaned.includes(tokens.bob));
  assert.match(cleaned, /https:\/\/studio.example\/api/);
});

test("hosted 拒绝异站 Origin；没有令牌配置、重名令牌、非法用户和零配额时拒绝启动", async t => {
  const f = await setup(t);
  const response = await f.request("/api/projects", "alice", { title: "外站" }, { headers: { Origin: "https://evil.example" } });
  assert.equal(response.status, 403);
  assert.equal((await f.request("/api/projects", "alice", { title: "同站" }, { headers: { Origin: "https://studio.example" } })).status, 201);
  for (const config of [{ mode: "hosted" }, { ...hosting, tokens: { "../user": tokens.alice } }, { ...hosting, tokens: { alice: tokens.alice, bob: tokens.alice } }, { ...hosting, dailyRuns: 0 }]) {
    assert.throws(() => createLocalServer({ root: f.dir, hosting: config as HostingOptions }));
  }
  assert.throws(() => hostingFromEnv({ HARNESS_MODE: "invalid" }));
  assert.throws(() => hostingFromEnv({ HARNESS_MODE: "hosted", HARNESS_ACCESS_TOKENS: "malformed" }));
  assert.deepEqual(hostingFromEnv({}), { mode: "local" });
});

test("网页令牌在 sessionStorage 拒绝读写时仍使用内存，并随 REST 请求头发送", async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage"), originalFetch = globalThis.fetch;
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "sessionStorage", descriptor); else Reflect.deleteProperty(globalThis, "sessionStorage");
    globalThis.fetch = originalFetch;
  });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("存储被禁用"); } });
  const client = await import(new URL("../web/src/lib/api/client.ts?blocked-storage", import.meta.url).href) as typeof import("../web/src/lib/api/client.js");
  assert.equal(client.getAccessToken(), "");
  client.setAccessToken(tokens.alice);
  globalThis.fetch = async (input, options) => {
    assert.equal(input, "/api/projects");
    assert.equal(new Headers(options?.headers).get("authorization"), `Bearer ${tokens.alice}`);
    return new Response("[]", { status: 200 });
  };
  assert.deepEqual(await client.api("/api/projects"), []);
  client.setAccessToken(""); assert.deepEqual(client.authorizationHeaders(), {});
});

test("网页 401、403、429 具有中文提示并保留服务端配额原因", async t => {
  const originalFetch = globalThis.fetch; t.after(() => { globalThis.fetch = originalFetch; });
  const client = await import("../web/src/lib/api/index.js");
  for (const status of [401, 403, 429]) {
    globalThis.fetch = async () => new Response("{}", { status });
    await assert.rejects(client.api("/api/config"), error => error instanceof client.ApiError && error.status === status && /[\u4e00-\u9fff]/.test(error.message));
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "已达到今日运行次数上限" }), { status: 429 });
  await assert.rejects(client.api("/api/projects"), /今日运行次数/);
});

test("网页 hosted SSE 使用请求头鉴权，正确拼接跨字节和跨块事件且关闭后不重连", async t => {
  const originalFetch = globalThis.fetch; t.after(() => { globalThis.fetch = originalFetch; });
  const client = await import("../web/src/lib/api/index.js");
  const { authenticatedEvents } = await import("../web/src/lib/api/index.js");
  client.setAccessToken(tokens.alice); t.after(() => client.setAccessToken(""));
  const bytes = new TextEncoder().encode('id: 1\ndata: {"text":"中文事件"}\n\n: heartbeat\n\nid: 2\ndata: {"text":"完成"}\n\n');
  let requests = 0;
  globalThis.fetch = async (input, options) => {
    requests++;
    assert.equal(input, "/api/projects/example/events");
    assert.equal(new Headers(options?.headers).get("authorization"), `Bearer ${tokens.alice}`);
    return new Response(new ReadableStream({ start(controller) {
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    } }));
  };
  const source = authenticatedEvents("/api/projects/example/events"); t.after(() => source.close());
  const frames: { id: string; text: string }[] = [];
  source.onmessage = event => { frames.push({ id: event.lastEventId, text: JSON.parse(event.data).text }); if (frames.length === 2) source.close(); };
  for (let attempt = 0; frames.length !== 2 && attempt < 100; attempt++) await setTimeout(10);
  assert.deepEqual(frames, [{ id: "1", text: "中文事件" }, { id: "2", text: "完成" }]);
  assert.equal(requests, 1);
});

test("hosted 分镜板重拼装不消耗模型配额、不建会话，仍需确认及人工采用", async t => {
  let calls = 0;
  const config = { ...hosting, dailyRuns: 1 };
  const f = await setup(t, config, async () => { calls++; throw new Error("重拼装不应创建模型会话"); });
  const p = await f.create(), store = new ProjectStore(f.dir, "alice");
  for (const stage of ["story", "script", "bible", "board"] as const) { store.writeDraft(p.id, stage, sample(stage)); store.adopt(p.id, stage, 1); }
  const bible = sample("bible"); bible.characters[0].appearance = bible.characters[0].appearance.replace("浅灰", "深灰");
  store.writeDraft(p.id, "bible", bible); store.adopt(p.id, "bible", 2, true);
  const quota = new TenantQuota(f.dir, "alice", config); quota.reserve(p.id, "board")();
  const quotaFile = join(f.dir, "projects/alice/quota.json"), before = readFileSync(quotaFile, "utf8");
  const route = `/api/projects/${p.id}/stages/board`;
  assert.equal((await f.request(`${route}/run`, "alice", { confirmed: true })).status, 429);
  assert.equal((await f.request(`${route}/reassemble`, "alice", {})).status, 422);
  assert.equal((await f.request(`${route}/reassemble`, "alice", { confirmed: true })).status, 200);
  assert.equal(calls, 0); assert.equal(readFileSync(quotaFile, "utf8"), before);
  assert.equal(store.load(p.id).stages.board.adopted_version, 1);
  assert.equal(store.load(p.id).stages.board.reviews?.[2].status, "pending");
  assert.equal((await f.request(`${route}/adopt`, "alice", { version: 2 })).status, 422);
  assert.equal((await f.request(`${route}/adopt`, "alice", { version: 2, confirmed: true })).status, 200);
  assert.equal(store.load(p.id).stages.board.status, "adopted");
  assert.equal(calls, 0); assert.equal(readFileSync(quotaFile, "utf8"), before);
});
