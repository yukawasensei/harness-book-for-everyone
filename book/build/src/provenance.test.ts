import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { STAGES } from "./contracts/index.js";
import { ScriptDraft } from "./agent/script-draft.js";
import { PromptDraft } from "./agent/prompt-draft.js";
import { ProjectStore } from "./project/store.js";
import { fixture, sample, packageRoot } from "./testing/fixtures.js";
import { createLocalServer } from "./server/index.js";
import { createStageSession } from "./agent/session.js";
import { runStage } from "./agent/run.js";
import { fakeStream } from "./testing/fake-model.js";

function complete(f: ReturnType<typeof fixture>) {
  for (const stage of STAGES) { f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1); }
}
function changeBible(f: ReturnType<typeof fixture>) {
  const bible = sample("bible"); bible.characters[0].appearance = bible.characters[0].appearance.replace("浅灰", "深灰");
  f.store.writeDraft(f.project.id, "bible", bible);
  f.store.adopt(f.project.id, "bible", 2, true);
  return bible;
}
test("来源落盘；改设定标记下游、历史提示词仍按原来源可读；确认与零模型拼装恢复", () => {
  const f = fixture(); try {
    complete(f);
    assert.deepEqual(f.store.load(f.project.id).provenance?.storyboard?.[1].based_on, { script: 1, bible: 1 });
    const original = f.store.readVersion(f.project.id, "prompts", 1);
    const bible = changeBible(f);
    assert.equal(f.store.load(f.project.id).stages.storyboard.status, "stale");
    assert.equal(f.store.load(f.project.id).stages.prompts.status, "stale");
    assert.deepEqual(f.store.readVersion(f.project.id, "prompts", 1), original);
    assert.throws(() => f.store.confirmValid(f.project.id, "storyboard", " ", true), /理由/);
    f.store.confirmValid(f.project.id, "storyboard", "只改外观，引用和动作仍有效", true);
    const version = f.store.reassemblePrompts(f.project.id, true);
    assert.equal(version, 2);
    const next = f.store.readVersion(f.project.id, "prompts", version);
    assert.deepEqual(next.items.map(i => i.shot_part), original.items.map(i => i.shot_part));
    for (const item of next.items.filter(i => i.injected_ids.includes("C01"))) assert.ok(item.final_prompt.includes(bible.characters[0].appearance));
    f.store.adopt(f.project.id, "prompts", version, true);
    assert.ok(STAGES.every(s => f.store.load(f.project.id).stages[s].status === "adopted"));
    const audit = readFileSync(join(f.store.projectDir(f.project.id), "audit.jsonl"), "utf8");
    assert.match(audit, /confirmed_valid/); assert.match(audit, /reassemble/); assert.match(audit, /只改外观/);
  } finally { f.cleanup(); }
});
test("间接失效沿依赖传递；二次确认防止绕过切换，丢弃不可选，回切可恢复", () => {
  const f = fixture(); try {
    complete(f); f.store.writeDraft(f.project.id, "topic", sample("topic"));
    assert.throws(() => f.store.adopt(f.project.id, "topic", 2), /确认/);
    f.store.adopt(f.project.id, "topic", 2, true);
    for (const stage of STAGES.slice(1)) assert.equal(f.store.load(f.project.id).stages[stage].status, "stale", stage);
    f.store.adopt(f.project.id, "topic", 1, true);
    assert.ok(STAGES.every(s => f.store.load(f.project.id).stages[s].status === "adopted"));
    f.store.writeDraft(f.project.id, "topic", sample("topic")); f.store.discard(f.project.id, "topic", 3);
    assert.throws(() => f.store.adopt(f.project.id, "topic", 3, true), /discarded/);
  } finally { f.cleanup(); }
});
test("影响按 ID 与字段比较，准确映射镜头及提示词；非描述变化不允许重新拼装", () => {
  const f = fixture(); try {
    complete(f); changeBible(f);
    const impact = f.store.bibleImpact(f.project.id);
    assert.deepEqual(impact.changes.map(c => [c.id, c.fields]), [["C01", ["appearance"]]]);
    const expected = sample("storyboard").shots.filter(s => s.character_ids.includes("C01")).map(s => s.shot_id);
    assert.deepEqual(impact.shots, expected); assert.deepEqual(impact.prompts, expected);
    f.store.confirmValid(f.project.id, "storyboard", "外观不改变分镜", true);
    const changed = f.store.readAdopted(f.project.id, "bible"); changed.characters[0].personality += "安静。";
    f.store.writeDraft(f.project.id, "bible", changed); f.store.adopt(f.project.id, "bible", 3, true);
    f.store.confirmValid(f.project.id, "storyboard", "人物动作无需修改", true);
    assert.throws(() => f.store.reassemblePrompts(f.project.id, true), /固定描述/);
  } finally { f.cleanup(); }
});
test("按场暂存落盘与新实例恢复；重新开始清空，来源变化拒绝续跑", () => {
  const f = fixture(); try {
    for (const stage of ["topic", "synopsis"] as const) { f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1); }
    const draft = new ScriptDraft(f.store, f.project.id); draft.reset(); draft.write(sample("script").scenes[0]);
    const store = new ProjectStore(f.dir), resumed = new ScriptDraft(store, f.project.id);
    resumed.reset(undefined, "resume"); assert.equal(resumed.snapshot().scenes.length, 1);
    resumed.write(sample("script").scenes[1]); assert.equal(store.readStaging(f.project.id, "script")?.snapshot.scenes?.length, 2);
    f.store.writeDraft(f.project.id, "synopsis", sample("synopsis")); f.store.adopt(f.project.id, "synopsis", 2, true);
    assert.throws(() => resumed.reset(undefined, "resume"), /来源/);
    resumed.reset(undefined, "restart"); assert.equal(resumed.snapshot().scenes.length, 0);
  } finally { f.cleanup(); }
});
test("残留运行锁在服务恢复时标记 interrupted 且审计仅一次；旧来源显示未知", () => {
  const f = fixture(); try {
    complete(f);
    const file = join(f.store.projectDir(f.project.id), "project.json"), old = f.store.load(f.project.id);
    delete old.provenance; writeFileSync(file, JSON.stringify(old));
    assert.equal(new ProjectStore(f.dir).load(f.project.id).provenance, undefined);
    changeBible(f);
    assert.equal(f.store.load(f.project.id).stages.storyboard.status, "stale");
    assert.equal(f.store.load(f.project.id).stages.prompts.status, "stale");
    assert.equal(f.store.load(f.project.id).provenance?.storyboard, undefined);
    assert.deepEqual(f.store.readVersion(f.project.id, "prompts", 1), sample("prompts"));
    f.store.saveRunLock(f.project.id, { id: "orphan", stage: "script", started_at: new Date().toISOString(), abort_requested: false });
    f.store.recoverInterruptedRuns(); f.store.recoverInterruptedRuns();
    assert.equal(f.store.lastInterruptedRun(f.project.id)?.stop_reason, "interrupted");
    const audit = readFileSync(join(f.store.projectDir(f.project.id), "audit.jsonl"), "utf8");
    assert.equal(audit.split('"action":"interrupted"').length - 1, 1);
  } finally { f.cleanup(); }
});
test("按镜暂存经新会话继续；真实模型请求上下文预装已交镜头，最终拼装与原文相同", async () => {
  const f = fixture(); let session;
  try {
    for (const stage of STAGES.slice(0, -1)) { f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1); }
    const first = sample("prompts").items[0];
    const draft = new PromptDraft(f.store, f.project.id); draft.reset(); draft.write({ shot_id: first.shot_id, shot_part: first.shot_part });
    session = await createStageSession({ root: packageRoot, store: new ProjectStore(f.dir), projectId: f.project.id, stage: "prompts", model: { provider: "ollama", id: "qwen3.8:27b" } });
    const fake = fakeStream(session.model!, [
      ...sample("prompts").items.slice(1).map(({ shot_id, shot_part }) => ({ call: "write_shot_prompt", args: { shot_id, shot_part } })),
      { call: "finalize_draft", args: {} }, { text: "完成" },
    ]);
    session.agent.streamFunction = fake.fn;
    const result = await runStage(session, f.store, f.project.id, "prompts", "", undefined, undefined, { staging: "resume" });
    assert.equal(result.stop_reason, "draft_written");
    const context = JSON.stringify(fake.contexts[0].messages);
    assert.ok(context.includes(first.shot_part)); assert.ok(!context.includes(first.final_prompt));
    assert.deepEqual(f.store.readVersion(f.project.id, "prompts", 1), sample("prompts"));
    assert.equal(f.store.readStaging(f.project.id, "prompts")?.snapshot.finalized_version, 1);
    assert.throws(() => new PromptDraft(f.store, f.project.id).reset(undefined, "resume"), /没有可继续/);
  } finally { session?.dispose(); f.cleanup(); }
});
test("HTTP 返工闭环：确认标记、理由、待更新、重启恢复；重新拼装不创建模型会话", async () => {
  const f = fixture(); complete(f); let calls = 0;
  f.store.saveRunLock(f.project.id, { id: "orphan", stage: "script", started_at: new Date().toISOString(), abort_requested: false });
  const app = createLocalServer({ root: packageRoot, store: f.store, sessionFactory: async () => { calls++; throw new Error("不应创建模型会话"); } });
  try {
    const base = await app.listen(0), path = `${base}/api/projects/${f.project.id}`;
    const post = (stage: string, operation: string, data: unknown) => fetch(`${path}/stages/${stage}/${operation}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    let detail = await (await fetch(path)).json() as { last_run: { stop_reason: string } };
    assert.equal(detail.last_run.stop_reason, "interrupted");
    assert.equal((await post("bible", "run", {})).status, 422);
    changeBible(f);
    assert.equal((await post("storyboard", "confirm-valid", { confirmed: true, reason: " " })).status, 422);
    assert.equal((await post("storyboard", "confirm-valid", { reason: "外观变化不改镜头" })).status, 422);
    assert.equal((await post("prompts", "reassemble", { confirmed: true })).status, 422);
    assert.equal((await post("storyboard", "confirm-valid", { confirmed: true, reason: "外观变化不改镜头" })).status, 200);
    assert.equal((await post("prompts", "reassemble", {})).status, 422);
    assert.equal((await post("prompts", "reassemble", { confirmed: true })).status, 200);
    assert.equal(calls, 0);
    assert.equal((await post("prompts", "adopt", { version: 2 })).status, 422);
    assert.equal((await post("prompts", "adopt", { version: 2, confirmed: true })).status, 200);
    assert.ok(STAGES.every(s => f.store.load(f.project.id).stages[s].status === "adopted"));
  } finally { await app.close(); f.cleanup(); }
});
