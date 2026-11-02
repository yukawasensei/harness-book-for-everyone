import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { validateArtifact, type Artifacts } from "./contracts/index.js";
import { createStageSession } from "./agent/session.js";
import { runStage } from "./agent/run.js";
import { getCurrentSystemPrompt, getCurrentTools } from "@earendil-works/pi-ai";
import { fakeStream } from "./testing/fake-model.js";
import { fixture, packageRoot, sample } from "./testing/fixtures.js";

function setup() {
  const f = fixture();
  for (const stage of ["topic", "synopsis", "script"] as const) {
    f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
  }
  return f;
}
function rejected(change: (bible: Artifacts["bible"]) => void, reason: RegExp) {
  const f = setup();
  try {
    const bible = sample("bible"); change(bible);
    const path = join(f.store.projectDir(f.project.id), "project.json");
    const before = readFileSync(path, "utf8");
    assert.throws(() => f.store.writeDraft(f.project.id, "bible", bible), reason);
    assert.equal(readFileSync(path, "utf8"), before);
    assert.equal(existsSync(join(f.store.projectDir(f.project.id), "artifacts/bible")), false);
  } finally { f.cleanup(); }
}
test("设定集缺台词角色时拒绝，指出名称与来源场，不形成版本", () => {
  rejected(b => { b.characters = b.characters.filter(c => c.name !== "麦冬"); }, /覆盖检查.*麦冬.*S01/s);
});
test("aliases 匹配称呼变体，只检查采用剧本而非最新候选；采用前后分镜锁定与解锁", () => {
  const f = fixture();
  try {
    for (const stage of ["topic", "synopsis"] as const) {
      f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
    }
    const script = sample("script");
    for (const scene of script.scenes) for (const line of scene.lines) {
      if (line.kind === "dialogue" && line.character === "陆岑") line.character = "修表师";
    }
    f.store.writeDraft(f.project.id, "script", script);
    const candidate = sample("script");
    candidate.scenes[0].lines.push({ kind: "dialogue", character: "候选角色", text: "未采用" });
    f.store.writeDraft(f.project.id, "script", candidate); f.store.adopt(f.project.id, "script", 1);
    const bible = sample("bible"); bible.characters[2].aliases = ["修表师"];
    assert.equal(f.store.writeDraft(f.project.id, "bible", bible), 1);
    assert.equal(f.store.load(f.project.id).stages.bible.reviews?.[1].status, "pending");
    assert.equal(f.store.load(f.project.id).stages.storyboard.status, "locked");
    assert.equal(f.store.adopt(f.project.id, "bible", 1).stages.storyboard.status, "ready");
  } finally { f.cleanup(); }
});
for (const group of ["characters", "props", "locations"] as const) {
  test(`${group} 来源场不存在、空列表、重复场号、缺字段都拒绝`, () => {
    rejected(b => { b[group][0].appears_in = ["S99"]; }, /来源场.*S99.*不存在/);
    rejected(b => { b[group][0].appears_in = []; }, /schema 不合规/);
    rejected(b => { b[group][0].appears_in = ["S01", "S01"]; }, /schema 不合规/);
    rejected(b => { Reflect.deleteProperty(b[group][0], "appears_in"); }, /来源场.*appears_in.*重新抽取/);
  });
  test(`${group} ID 唯一且为正的两位分类编号`, () => {
    rejected(b => { b[group].push(structuredClone(b[group][0]) as never); }, /编号重复/);
    for (const id of ["C1", "../outside", "L00", "P001"]) rejected(b => { b[group][0].id = id; }, /schema 不合规/);
  });
}
test("每场至少关联一个地点；角色来源场必须覆盖其台词", () => {
  rejected(b => { b.locations[0].appears_in = ["S01"]; }, /S03.*缺少关联地点/);
  rejected(b => { b.characters[0].appears_in = ["S01"]; }, /程禾.*来源场.*S02/);
});
test("同名或别名跨角色歧义、空别名与重复别名拒绝", () => {
  rejected(b => { b.characters[1].name = b.characters[0].name; }, /称呼.*重复/);
  rejected(b => { b.characters[1].aliases = [b.characters[0].name]; }, /称呼.*重复/);
  for (const aliases of [[" "], ["孩子", "孩子"]]) rejected(b => { b.characters[1].aliases = aliases; }, /schema 不合规/);
});
for (const [group, field] of [["characters", "appearance"], ["props", "description"], ["locations", "description"]] as const) {
  test(`${group} 固定描述长度边界、场次号及剧情词粗筛`, () => {
    for (const description of ["短", "静".repeat(161), " ".repeat(20) + "短"]) rejected(b => { Reflect.set(b[group][0], field, description); }, /固定描述.*12.*160/);
    for (const marker of ["S02", "s03", "第十二场", "第 2 场"]) rejected(b => { Reflect.set(b[group][0], field, `灰色布面与银色边框，${marker}中的固定造型。`); }, /固定描述.*场次号/);
    for (const verb of ["拿起", "走进", "放下", "决定"]) rejected(b => { Reflect.set(b[group][0], field, `灰色布面与银色边框，人物${verb}蓝色计时器。`); }, new RegExp(`固定描述.*剧情词.*${verb}`));
    for (const size of [12, 160]) {
      const bible = sample("bible"); Reflect.set(bible[group][0], field, "灰".repeat(size));
      assert.doesNotThrow(() => validateArtifact("bible", bible));
    }
  });
}
test("旧设定集缺来源明确拒绝读取与采用，不猜测迁移，原文件与状态不变，可重新抽取新版本", () => {
  const f = setup();
  try {
    f.store.writeDraft(f.project.id, "bible", sample("bible"));
    const legacy = sample("bible");
    for (const entry of [...legacy.characters, ...legacy.props, ...legacy.locations]) Reflect.deleteProperty(entry, "appears_in");
    const path = f.store.artifactPath(f.project.id, "bible", 1);
    const raw = JSON.stringify(legacy); writeFileSync(path, raw);
    const before = readFileSync(join(f.store.projectDir(f.project.id), "project.json"), "utf8");
    assert.throws(() => f.store.readVersion(f.project.id, "bible", 1), /来源场.*appears_in.*重新抽取/);
    assert.throws(() => f.store.adopt(f.project.id, "bible", 1), /来源场.*appears_in.*重新抽取/);
    assert.equal(readFileSync(path, "utf8"), raw);
    assert.equal(readFileSync(join(f.store.projectDir(f.project.id), "project.json"), "utf8"), before);
    assert.equal(f.store.load(f.project.id).stages.storyboard.status, "locked");
    assert.equal(f.store.writeDraft(f.project.id, "bible", sample("bible")), 2);
  } finally { f.cleanup(); }
});
test("采用与读取复核覆盖，损坏版本无法绕过写入边界", () => {
  const f = setup();
  try {
    f.store.writeDraft(f.project.id, "bible", sample("bible"));
    const damaged = sample("bible"); damaged.characters.pop();
    writeFileSync(f.store.artifactPath(f.project.id, "bible", 1), JSON.stringify(damaged));
    assert.throws(() => f.store.adopt(f.project.id, "bible", 1), /覆盖检查.*陆岑/s);
    assert.throws(() => f.store.readVersion(f.project.id, "bible", 1), /覆盖检查.*陆岑/s);
    assert.equal(f.store.load(f.project.id).stages.storyboard.status, "locked");
  } finally { f.cleanup(); }
});
test("设定集会话白名单、提示、拒绝后补全及运行审计", async () => {
  const f = setup(); let session: Awaited<ReturnType<typeof createStageSession>> | undefined;
  try {
    const bad = sample("bible"); bad.characters.pop();
    session = await createStageSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "bible", model: { provider: "ollama", id: "qwen3.8:27b" } });
    const fake = fakeStream(session.model!, [
      { call: "read_upstream", args: { stage: "script" } }, { call: "write_draft", args: { artifact: bad } },
      { call: "write_draft", args: { artifact: sample("bible") } }, { text: "请审阅" },
    ]);
    session.agent.streamFunction = fake.fn;
    const result = await runStage(session, f.store, f.project.id, "bible");
    assert.equal(result.stop_reason, "draft_written"); assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /覆盖检查.*陆岑/s);
    assert.deepEqual(f.store.load(f.project.id).stages.bible.versions, [1]);
    assert.deepEqual(session.getActiveToolNames().sort(), ["read_upstream", "write_draft"]);
    assert.deepEqual(getCurrentTools(fake.contexts[0].messages).map(t => t.name).sort(), ["read_upstream", "write_draft"]);
    const prompt = getCurrentSystemPrompt(fake.contexts[0].messages);
    for (const rule of [/抽取/, /不.*发明/, /appears_in/, /12.*160/, /粗筛/]) assert.match(prompt, rule);
    const entries = session.sessionManager.getEntries();
    const start = entries.find(e => e.type === "custom" && e.customType === "stage_run_start");
    const end = entries.find(e => e.type === "custom" && e.customType === "stage_run_end");
    assert.ok(start?.type === "custom" && end?.type === "custom");
    assert.match(JSON.stringify(start.data), /model.*prompt.*tools.*context_notes/);
    assert.match(JSON.stringify(end.data), /duration_ms.*errors.*stop_reason/);
  } finally { session?.dispose(); f.cleanup(); }
});
