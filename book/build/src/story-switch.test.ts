import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { STAGES, parseStage } from "./contracts/index.js";
import { fixture, packageRoot } from "./testing/fixtures.js";
import { ProjectStore } from "./project/store.js";
import { createLocalServer } from "./server/index.js";

function bytes(directory: string): Record<string, string> {
  return Object.fromEntries(readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? Object.entries(bytes(path)).map(([key, value]) => [`${entry.name}/${key}`, value])
      : [[entry.name, readFileSync(path).toString("base64")]];
  }));
}

test("四工序持久化最终格式且不接受旧阶段", () => {
  const f = fixture(); try {
    assert.deepEqual(STAGES, ["story", "script", "bible", "board"]);
    assert.equal(Reflect.get(f.project, "format_version"), 2);
    for (const stage of ["topic", "synopsis", "storyboard", "prompts"]) assert.throws(() => parseStage(stage), /未知阶段/);
  } finally { f.cleanup(); }
});

for (const hosted of [false, true]) for (const preview of [false, true]) test(`${preview ? "五工序过渡" : "六工序旧"}项目 load/list/API/启动恢复均拒读，所有文件逐字不变（${hosted ? "hosted" : "local"}）`, async () => {
  const f = fixture();
  const store = hosted ? new ProjectStore(f.dir, "alice") : f.store;
  const project = hosted ? store.create("旧作品") : f.project;
  let app: ReturnType<typeof createLocalServer> | undefined;
  try {
    const directory = store.projectDir(project.id);
    const stages = Object.fromEntries((preview ? ["story", "script", "bible", "storyboard", "prompts"] : ["topic", "synopsis", "script", "bible", "storyboard", "prompts"]).map(stage => [stage, { status: "ready", versions: [], adopted_version: null }]));
    writeFileSync(join(directory, "project.json"), JSON.stringify({ ...(preview ? { format_version: "story-merge-preview" } : {}), id: project.id, title: "旧作品", stages }));
    for (const file of ["run-lock.json", "conversation.jsonl", "audit.jsonl", "staging/script.json", "artifacts/topic/v1.json", "sessions/old.jsonl"]) {
      const target = join(directory, file); mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file === "run-lock.json" ? JSON.stringify({ id: "old-run", stage: "topic", status: "running", started_at: "2026-01-01T00:00:00Z", abort_requested: false }) : file === "conversation.jsonl" ? JSON.stringify({ kind: "run", id: "old-timeline", run_id: "old-run", stage: "topic", status: "running", at: "2026-01-01T00:00:00Z" }) + "\n" : "原始证据\n");
    }
    const before = bytes(directory);
    assert.throws(() => store.load(project.id), { code: "PROJECT_FORMAT_UNSUPPORTED" });
    assert.deepEqual(store.list(), []);
    app = createLocalServer({ root: hosted ? f.dir : packageRoot, ...(hosted ? { hosting: { mode: "hosted", tokens: { alice: "test-old-format-alice-0001" } } as const } : { store }), sessionFactory: async () => { throw new Error("旧项目不得创建模型会话"); } });
    const base = await app.listen(0);
    const headers = hosted ? { Authorization: "Bearer test-old-format-alice-0001" } : undefined;
    assert.deepEqual(await (await fetch(`${base}/api/projects`, { headers })).json(), []);
    for (const suffix of ["", "/timeline", "/stages/topic/versions/1"]) {
      const response = await fetch(`${base}/api/projects/${project.id}${suffix}`, { headers });
      assert.equal(response.status, 409);
      const data = await response.json(); assert.equal(data.code, "PROJECT_FORMAT_UNSUPPORTED");
      assert.match(data.error, /原文件未修改/); assert.ok(!JSON.stringify(data).includes(directory));
    }
    for (const suffix of ["/messages", "/stages/story/run", "/stages/story/adopt"]) {
      assert.equal((await fetch(`${base}/api/projects/${project.id}${suffix}`, { method: "POST", headers, body: "{}" })).status, 409);
    }
    await app.close(); app = undefined;
    assert.deepEqual(bytes(directory), before);
  } finally { if (app) await app.close(); f.cleanup(); }
});

test("拒绝未知格式、缺失/混合阶段键及无效版本状态，读取不落盘", () => {
  const f = fixture(); try {
    const file = join(f.store.projectDir(f.project.id), "project.json");
    const input = JSON.parse(readFileSync(file, "utf8"));
    const changes = [
      (p: any) => delete p.format_version,
      (p: any) => p.format_version = "story-merge-preview",
      (p: any) => p.format_version = "future",
      (p: any) => delete p.stages.story,
      (p: any) => p.stages.topic = p.stages.story,
      (p: any) => p.stages.story.versions = ["1"],
      (p: any) => p.stages.story.status = "unknown",
      (p: any) => p.stages.story.adopted_version = 99,
    ];
    for (const change of changes) {
      const p = structuredClone(input); change(p); const raw = JSON.stringify(p); writeFileSync(file, raw);
      assert.throws(() => f.store.load(f.project.id)); assert.equal(readFileSync(file, "utf8"), raw);
    }
  } finally { f.cleanup(); }
});
