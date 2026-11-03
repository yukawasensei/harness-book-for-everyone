import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createLocalServer } from "./server/index.js";
import { fixture, packageRoot } from "./testing/fixtures.js";
import { readerMessage, revisionDescription, stageBadge } from "../web/src/features/artifacts/lib/presentation.js";
import { stagePrompt } from "./agent/prompts.js";
import { ProjectStore } from "./project/store.js";
import { STAGES } from "./contracts/index.js";

test("项目列表跳过文件、无项目文件的目录、不合规 ID 和坏项目；每项一行警告，HTTP 不再 500", async t => {
  const f = fixture();
  const app = createLocalServer({ root: packageRoot, store: f.store });
  const warning = t.mock.method(console, "warn", () => {});
  try {
    writeFileSync(join(f.store.root, "notes.txt"), "非项目文件");
    for (const name of ["photos", "bad.id", "broken"]) mkdirSync(join(f.store.root, name));
    writeFileSync(join(f.store.root, "broken/project.json"), "{}");
    const base = await app.listen(0);
    const response = await fetch(base + "/api/projects");
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json() as { id: string }[]).map(p => p.id), [f.project.id]);
    assert.equal(warning.mock.calls.length, 4);
    for (const call of warning.mock.calls) {
      assert.equal(call.arguments.length, 1);
      assert.match(String(call.arguments[0]), /跳过.*项目/);
      assert.ok(!String(call.arguments[0]).includes("\n"));
    }
  } finally { await app.close(); f.cleanup(); }
});

test("未开放模板使用独立导航状态，不管依赖是否解锁", () => {
  for (const status of ["locked", "ready", "pending_review"] as const) {
    assert.deepEqual(stageBadge(status, "prompts", null, false), { text: "暂未开放", className: "unavailable" });
  }
  assert.equal(stageBadge("ready", "bible", null, true).text, "可运行");
});

test("各阶段提示与工具结果只显示中文阶段、审阅状态", () => {
  for (const stage of STAGES) {
    const visible = readerMessage(`不能运行 ${stage}：依赖阶段 script 尚未采用版本`);
    assert.ok(!/\b(topic|synopsis|script|bible|storyboard|prompts)\b/.test(visible));
    assert.match(visible, /剧本 尚未采用版本/);
  }
  assert.ok(stagePrompt("prompts"));
  assert.equal(readerMessage("已保存 prompts v1；status=pending_review"), "已保存 分镜提示词 v1；待审阅");
  assert.equal(readerMessage("已保存 bible v1；status=pending_review，等待人工采用"), "已保存 设定集 v1；待审阅，等待人工采用");
});

test("修改记录省略空项，有删除时保留实际场号", () => {
  const revision = { revise_from: 1, resubmitted: ["S02"], reused: ["S01", "S03"], removed: [] };
  assert.equal(revisionDescription(revision), "相对 v1：重交 S02；沿用 S01、S03");
  assert.equal(revisionDescription({ ...revision, reused: [], removed: ["S03"] }), "相对 v1：重交 S02；删除 S03");
  assert.equal(readerMessage("本版相对 v1：重交/新增 S02；沿用 S01、S03；删除 无。"), "本版相对 v1：重交 S02；沿用 S01、S03。");
});

test("阶段记忆按项目保存，刷新和项目切换恢复各自阶段；坏值与不可用存储回退", async () => {
  const { rememberSelectedStage, restoreSelectedStage } = await import("../web/src/features/sessions/lib/project-selection.js");
  const values = new Map<string, string>();
  const access = () => ({ getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } });
  rememberSelectedStage("a", "bible", access); rememberSelectedStage("b", "script", access);
  assert.equal(restoreSelectedStage("a", access), "bible"); assert.equal(restoreSelectedStage("b", access), "script");
  assert.equal(restoreSelectedStage("new", access), "topic");
  for (const key of values.keys()) values.set(key, "unknown");
  assert.equal(restoreSelectedStage("a", access), "topic");
  const blocked = () => { throw new Error("不可用"); };
  assert.equal(restoreSelectedStage("a", blocked), "topic");
  assert.doesNotThrow(() => rememberSelectedStage("a", "script", blocked));
});


test("local 扫描静默跳过 hosted 用户分区，仍列出本机项目并警告真正坏项目", t => {
  const f = fixture(); t.after(f.cleanup);
  const hosted = new ProjectStore(f.dir, "alice");
  const privateProject = hosted.create("用户私有项目");
  mkdirSync(join(f.store.root, "bob"));
  writeFileSync(join(f.store.root, "bob/quota.json"), JSON.stringify({ day: "2000-01-01", runs: 1, stages: {} }));
  mkdirSync(join(f.store.root, "broken"));
  writeFileSync(join(f.store.root, "broken/project.json"), "{}");
  const warning = t.mock.method(console, "warn", () => {});
  assert.deepEqual(f.store.list().map(project => project.id), [f.project.id]);
  assert.equal(warning.mock.calls.length, 1);
  assert.match(String(warning.mock.calls[0].arguments[0]), /broken/);
  assert.deepEqual(hosted.list().map(project => project.id), [privateProject.id]);
});
