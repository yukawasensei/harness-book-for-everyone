import assert from "node:assert/strict";
import { readFileSync, writeFileSync, renameSync, symlinkSync } from "node:fs";
import { test, type TestContext } from "node:test";
import { join } from "node:path";
import { STAGES } from "./contracts/index.js";
import { assembleBoard, boardInput } from "./contracts/board.js";
import { createLocalServer } from "./server/index.js";
import { ProjectStore } from "./project/store.js";
import { fixture, sample } from "./testing/fixtures.js";

const tokens = { alice: "public-export-alice-token-0001", bob: "public-export-bob-token-000002" };
async function setup(t: TestContext, hosted = false) {
  const f = fixture();
  const store = hosted ? new ProjectStore(f.dir, "alice") : f.store;
  const project = hosted ? store.create("完整分镜板") : f.project;
  for (const stage of STAGES) { store.writeDraft(project.id, stage, sample(stage)); store.adopt(project.id, stage, 1); }
  const app = createLocalServer({ root: f.dir, ...(hosted ? { hosting: { mode: "hosted" as const, tokens, dailyRuns: 1 } } : { store }),
    sessionFactory: async () => { throw new Error("导出不能调用模型"); } });
  const base = await app.listen(0);
  t.after(async () => { await app.close(); f.cleanup(); });
  const path = `/api/projects/${project.id}/stages/board/versions/1/export?format=markdown`;
  const request = (url = path, user: keyof typeof tokens | null = "alice") => fetch(base + url, {
    headers: hosted && user ? { Authorization: `Bearer ${tokens[user]}` } : {},
  });
  return { ...f, store, project, base, path, request };
}

test("版本化 Markdown 导出包含整板全部镜头与存储提示词，且不改作品或审计", async t => {
  const f = await setup(t);
  const before = readFileSync(join(f.store.projectDir(f.project.id), "project.json"), "utf8");
  const audit = f.store.readAudit(f.project.id);
  const response = await f.request();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type")!, /text\/markdown.*utf-8/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-disposition")!, /attachment;.*board-v1\.md/);
  const markdown = await response.text();
  assert.match(markdown, /分镜板 v1/);
  for (const shot of sample("board").shots) {
    for (const text of [shot.shot_id, shot.scene_id, shot.shot_size, shot.camera, shot.action, shot.dialogue ?? "无", shot.final_prompt]) assert.ok(markdown.includes(text));
    assert.ok(markdown.includes(`${shot.duration_s} 秒`));
  }
  assert.equal(readFileSync(join(f.store.projectDir(f.project.id), "project.json"), "utf8"), before);
  assert.deepEqual(f.store.readAudit(f.project.id), audit);
});

test("导出历史版本使用历史提示词，新设定及重拼装不污染旧导出", async t => {
  const f = await setup(t);
  const old = await (await f.request()).text();
  const bible = sample("bible"); bible.characters[0].appearance = "银灰色短发，穿藏蓝色风衣，右手戴一枚铜戒。";
  f.store.writeDraft(f.project.id, "bible", bible); f.store.adopt(f.project.id, "bible", 2, true);
  f.store.reassembleBoard(f.project.id, true);
  assert.equal((await f.request()).status, 200);
  assert.equal(await (await f.request()).text(), old);
  const next = await (await f.request(f.path.replace("versions/1/", "versions/2/"))).text();
  assert.ok(next.includes(bible.characters[0].appearance)); assert.ok(!old.includes(bible.characters[0].appearance));
  const adopted = await fetch(`${f.base}/api/projects/${f.project.id}/stages/board/adopt`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: 2, confirmed: true }),
  });
  assert.equal(adopted.status, 200);
  assert.equal((await adopted.json()).running, null);
  assert.ok(!f.store.readAudit(f.project.id).some(row => row.action === "auto_started"));
});

test("特殊反引号、HTML与换行保持文本并封在不会提前结束的代码块内", async t => {
  const f = await setup(t);
  const input = boardInput(sample("board"));
  const action = "第一行\n``````\n# 标题\n<script>alert('x')</script>\n最后一行";
  input.shots[0].action = action;
  const bible = sample("bible"); bible.characters[0].appearance += "\n```\n保留换行与反引号。";
  f.store.writeDraft(f.project.id, "bible", bible); f.store.adopt(f.project.id, "bible", 2, true);
  const board = assembleBoard(input, sample("script"), bible);
  f.store.writeDraft(f.project.id, "board", board);
  const response = await f.request(f.path.replace("versions/1/", "versions/2/"));
  assert.equal(response.status, 200);
  const markdown = await response.text();
  for (const [text, minimum] of [[action, 7], [board.shots[0].final_prompt, 4]] as const) {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(markdown, new RegExp(`(\`{${minimum},})text\\n` + escaped + "\\n\\1(?=\\n)"));
  }
});

test("导出严格拒绝版本、阶段、格式与客户端路径参数", async t => {
  const f = await setup(t);
  for (const path of [
    f.path.replace("/1/", "/0/"), f.path.replace("/1/", "/1.2/"), f.path.replace("/1/", "/9007199254740993/"),
    f.path.replace("/1/", "/%2e%2e%2foutside/"), f.path.replace("board/", "story/"),
    f.path.replace("markdown", "html"), f.path + "&path=outside", f.path + "&format=markdown",
    f.path.replace(f.project.id, "%2e%2e%2foutside"), f.path.replace("/1/", "/99/"),
  ]) assert.ok((await f.request(path)).status >= 400, path);
});

test("导出复用读版本闸门，篡改提示词拒绝且不修复文件", async t => {
  const f = await setup(t);
  const target = f.store.artifactPath(f.project.id, "board", 1);
  const board = sample("board"); board.shots[0].final_prompt = "伪造提示词";
  const raw = JSON.stringify(board); writeFileSync(target, raw);
  const response = await f.request(); assert.equal(response.status, 422);
  assert.equal(readFileSync(target, "utf8"), raw);
});

test("hosted导出鉴权、跨租户404、内容脱敏且不消耗模型配额", async t => {
  const f = await setup(t, true);
  assert.equal((await f.request(f.path, null)).status, 401);
  assert.equal((await f.request(f.path, "bob")).status, 404);
  const input = boardInput(sample("board")); input.shots[0].action += ` ${tokens.alice} /srv/private/source.txt`;
  f.store.writeDraft(f.project.id, "board", assembleBoard(input, sample("script"), sample("bible")));
  const quotaBefore = await (await f.request("/api/quota")).json();
  const response = await f.request(f.path.replace("versions/1/", "versions/2/"));
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(!text.includes(tokens.alice) && !text.includes("/srv/") && !text.includes("private"));
  assert.ok(text.includes("[已隐藏]") && text.includes("[路径已隐藏]"));
  assert.deepEqual(await (await f.request("/api/quota")).json(), quotaBefore);
});

test("hosted导出拒绝版本文件符号链接跨租户逃逸且错误不泄露路径", async t => {
  const f = await setup(t, true);
  const bob = new ProjectStore(f.dir, "bob"), project = bob.create("bob作品");
  const path = f.store.artifactPath(f.project.id, "board", 1);
  renameSync(path, path + ".original"); symlinkSync(join(bob.projectDir(project.id), "project.json"), path);
  const response = await f.request(); assert.ok(response.status >= 400);
  const text = await response.text(); assert.ok(!text.includes(f.dir) && !text.includes(project.id));
});
