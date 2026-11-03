import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { STAGES } from "./contracts/index.js";
import { ScriptDraft } from "./agent/script-draft.js";
import { BoardDraft } from "./agent/board-draft.js";
import { boardInput } from "./contracts/board.js";
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
    assert.deepEqual(f.store.load(f.project.id).provenance?.board?.[1].based_on, { story: 1, script: 1, bible: 1 });
    const original = f.store.readVersion(f.project.id, "board", 1);
    const bible = changeBible(f);
    assert.equal(f.store.load(f.project.id).stages.board.status, "stale");
    assert.equal(f.store.load(f.project.id).stages.board.status, "stale");
    assert.deepEqual(f.store.readVersion(f.project.id, "board", 1), original);
    assert.throws(() => f.store.confirmValid(f.project.id, "board", " ", true), /理由/);
    assert.throws(() => f.store.confirmValid(f.project.id, "board", "只改外观，引用和动作仍有效", true), /拼装原文/);
    const version = f.store.reassembleBoard(f.project.id, true);
    assert.equal(version, 2);
    const next = f.store.readVersion(f.project.id, "board", version);
    assert.deepEqual(next.shots.map(i => i.shot_part), original.shots.map(i => i.shot_part));
    for (const item of next.shots.filter(i => i.injected_ids.includes("C01"))) assert.ok(item.final_prompt.includes(bible.characters[0].appearance));
    f.store.adopt(f.project.id, "board", version, true);
    assert.ok(STAGES.every(s => f.store.load(f.project.id).stages[s].status === "adopted"));
    const audit = readFileSync(join(f.store.projectDir(f.project.id), "audit.jsonl"), "utf8");
    assert.match(audit, /reassemble/); assert.match(audit, /"model_calls":0/);
  } finally { f.cleanup(); }
});
test("间接失效沿依赖传递；二次确认防止绕过切换，丢弃不可选，回切可恢复", () => {
  const f = fixture(); try {
    complete(f); f.store.writeDraft(f.project.id, "story", sample("story"));
    assert.throws(() => f.store.adopt(f.project.id, "story", 2), /确认/);
    f.store.adopt(f.project.id, "story", 2, true);
    for (const stage of STAGES.slice(1)) assert.equal(f.store.load(f.project.id).stages[stage].status, "stale", stage);
    f.store.adopt(f.project.id, "story", 1, true);
    assert.ok(STAGES.every(s => f.store.load(f.project.id).stages[s].status === "adopted"));
    f.store.writeDraft(f.project.id, "story", sample("story")); f.store.discard(f.project.id, "story", 3);
    assert.throws(() => f.store.adopt(f.project.id, "story", 3, true), /discarded/);
  } finally { f.cleanup(); }
});
test("影响按 ID 与字段比较，准确映射镜头及提示词；非描述变化不允许重新拼装", () => {
  const f = fixture(); try {
    complete(f); changeBible(f);
    const impact = f.store.bibleImpact(f.project.id);
    assert.deepEqual(impact.changes.map(c => [c.id, c.fields]), [["C01", ["appearance"]]]);
    const expected = sample("board").shots.filter(s => s.character_ids.includes("C01")).map(s => s.shot_id);
    assert.deepEqual(impact.shots, expected);
    assert.throws(() => f.store.confirmValid(f.project.id, "board", "外观不改变分镜", true), /拼装原文/);
    const changed = f.store.readAdopted(f.project.id, "bible"); changed.characters[0].personality += "安静。";
    f.store.writeDraft(f.project.id, "bible", changed); f.store.adopt(f.project.id, "bible", 3, true);
    assert.throws(() => f.store.confirmValid(f.project.id, "board", "人物动作无需修改", true), /拼装原文/);
    assert.throws(() => f.store.reassembleBoard(f.project.id, true), /固定描述/);
  } finally { f.cleanup(); }
});
test("按场暂存落盘与新实例恢复；重新开始清空，来源变化拒绝续跑", () => {
  const f = fixture(); try {
    for (const stage of ["story"] as const) { f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1); }
    const draft = new ScriptDraft(f.store, f.project.id); draft.reset(); draft.write(sample("script").scenes[0]);
    const store = new ProjectStore(f.dir), resumed = new ScriptDraft(store, f.project.id);
    resumed.reset(undefined, "resume"); assert.equal(resumed.snapshot().scenes.length, 1);
    resumed.write(sample("script").scenes[1]); assert.equal(store.readStaging(f.project.id, "script")?.snapshot.scenes?.length, 2);
    f.store.writeDraft(f.project.id, "story", sample("story")); f.store.adopt(f.project.id, "story", 2, true);
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
    assert.equal(f.store.load(f.project.id).stages.board.status, "stale");
    assert.equal(f.store.load(f.project.id).stages.board.status, "stale");
    assert.equal(f.store.load(f.project.id).provenance?.board, undefined);
    assert.throws(() => f.store.readVersion(f.project.id, "board", 1), /来源记录/);
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
    const first = boardInput(sample("board")).shots.filter(s => s.scene_id === "S01");
    const draft = new BoardDraft(f.store, f.project.id); draft.reset(); draft.write({ scene_id: "S01", shots: first });
    session = await createStageSession({ root: packageRoot, store: new ProjectStore(f.dir), projectId: f.project.id, stage: "board", model: { provider: "ollama", id: "qwen3.8:27b" } });
    const fake = fakeStream(session.model!, [
      ...["S02", "S03"].map(scene_id => ({ call: "write_scene_shots", args: { scene: { scene_id, shots: boardInput(sample("board")).shots.filter(s => s.scene_id === scene_id) } } })),
      { call: "finalize_draft", args: {} }, { text: "完成" },
    ]);
    session.agent.streamFunction = fake.fn;
    const result = await runStage(session, f.store, f.project.id, "board", "", undefined, undefined, { staging: "resume" });
    assert.equal(result.stop_reason, "draft_written");
    const context = JSON.stringify(fake.contexts[0].messages);
    assert.ok(context.includes(first[0].shot_part)); assert.ok(!context.includes(sample("board").shots[0].final_prompt));
    assert.deepEqual(f.store.readVersion(f.project.id, "board", 1), sample("board"));
    assert.equal(f.store.readStaging(f.project.id, "board")?.snapshot.finalized_version, 1);
    assert.throws(() => new BoardDraft(f.store, f.project.id).reset(undefined, "resume"), /没有可继续/);
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
    assert.equal((await post("board", "confirm-valid", { confirmed: true, reason: " " })).status, 422);
    assert.equal((await post("board", "confirm-valid", { reason: "外观变化不改镜头" })).status, 422);
    assert.equal((await post("board", "reassemble", { confirmed: true })).status, 200);
    assert.equal((await post("board", "confirm-valid", { confirmed: true, reason: "外观变化不改镜头" })).status, 422);
    assert.equal((await post("board", "reassemble", {})).status, 422);
    assert.equal(calls, 0);
    assert.equal((await post("board", "adopt", { version: 2 })).status, 422);
    assert.equal((await post("board", "adopt", { version: 2, confirmed: true })).status, 200);
    assert.ok(STAGES.every(s => f.store.load(f.project.id).stages[s].status === "adopted"));
  } finally { await app.close(); f.cleanup(); }
});

test("改名、别名及换剧本拒绝快速拼装，拒绝不消耗分镜板版本", () => {
  for (const mode of ["rename", "alias", "script"] as const) {
    const f = fixture(); try {
      complete(f);
      if (mode === "script") {
        const script = sample("script"); script.scenes[0].summary += "增加等待的停顿。";
        f.store.writeDraft(f.project.id, "script", script); f.store.adopt(f.project.id, "script", 2, true);
        f.store.confirmValid(f.project.id, "bible", "人物与场次仍覆盖新剧本", true);
      } else {
        const bible = sample("bible");
        if (mode === "rename") { bible.characters[0].name = "程禾新名"; bible.characters[0].aliases = ["程禾"]; }
        else bible.characters[0].aliases = ["志愿者"];
        bible.characters[0].appearance += "衣领有一道细纹。";
        f.store.writeDraft(f.project.id, "bible", bible); f.store.adopt(f.project.id, "bible", 2, true);
      }
      const path = join(f.store.projectDir(f.project.id), "project.json"), before = readFileSync(path, "utf8");
      assert.throws(() => f.store.reassembleBoard(f.project.id, true), mode === "script" ? /剧本版本变化/ : /仅固定描述/);
      assert.deepEqual(f.store.load(f.project.id).stages.board.versions, [1]);
      assert.equal(readFileSync(path, "utf8"), before);
    } finally { f.cleanup(); }
  }
});

test("确认有效保留原来源与历史字节，重拼装新版本记录模板及原分镜板版本", () => {
  const f = fixture(); try {
    complete(f); const file = f.store.artifactPath(f.project.id, "board", 1), original = readFileSync(file, "utf8");
    const bible = sample("bible"); bible.characters[0].personality += "安静。";
    f.store.writeDraft(f.project.id, "bible", bible); f.store.adopt(f.project.id, "bible", 2, true);
    f.store.confirmValid(f.project.id, "board", "性格补充不改镜头和注入内容", true);
    let p = new ProjectStore(f.dir).load(f.project.id);
    assert.deepEqual(p.provenance?.board?.[1].original_based_on, { story: 1, script: 1, bible: 1 });
    assert.deepEqual(p.provenance?.board?.[1].based_on, { story: 1, script: 1, bible: 2 });
    assert.equal(readFileSync(file, "utf8"), original);
    assert.deepEqual(f.store.readVersion(f.project.id, "board", 1), sample("board"));
    f.store.adopt(f.project.id, "bible", 1, true);
    const appearance = sample("bible"); appearance.characters[0].appearance = appearance.characters[0].appearance.replace("浅灰", "深灰");
    const bibleVersion = f.store.writeDraft(f.project.id, "bible", appearance); f.store.adopt(f.project.id, "bible", bibleVersion, true);
    const version = f.store.reassembleBoard(f.project.id, true);
    p = new ProjectStore(f.dir).load(f.project.id);
    assert.equal(p.stages.board.adopted_version, 1); assert.equal(p.stages.board.reviews?.[version].status, "pending");
    assert.equal(p.provenance?.board?.[version].reassembled_from, 1);
    assert.equal(p.provenance?.board?.[version].assembly_template, "shot-v1");
    assert.equal(readFileSync(file, "utf8"), original);
  } finally { f.cleanup(); }
});

test("分镜板读取拒绝缺失来源、来源缺故事或模板身份篡改，不改历史文件", () => {
  const f = fixture(); try {
    complete(f); const file = join(f.store.projectDir(f.project.id), "project.json"), initial = readFileSync(file, "utf8");
    const artifact = f.store.artifactPath(f.project.id, "board", 1), before = readFileSync(artifact, "utf8");
    for (const mode of ["missing", "story", "template"] as const) {
      const project = JSON.parse(initial);
      if (mode === "missing") delete project.provenance.board;
      if (mode === "story") delete project.provenance.board[1].based_on.story;
      if (mode === "template") project.provenance.board[1].assembly_template = "unknown";
      const raw = JSON.stringify(project); writeFileSync(file, raw);
      assert.throws(() => f.store.readVersion(f.project.id, "board", 1), /来源|模板/);
      assert.equal(readFileSync(file, "utf8"), raw); assert.equal(readFileSync(artifact, "utf8"), before);
    }
  } finally { f.cleanup(); }
});

test("分镜板暂存只持有可写镜头，设定换版拒绝写入/汇总/续跑，重新开始记录新来源", () => {
  const f = fixture(); try {
    for (const stage of STAGES.slice(0, -1)) { f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1); }
    const draft = new BoardDraft(f.store, f.project.id); draft.reset();
    draft.write({ scene_id: "S01", shots: boardInput(sample("board")).shots.filter(s => s.scene_id === "S01") });
    const snapshot = f.store.readStaging(f.project.id, "board")!;
    assert.deepEqual(snapshot.based_on, { story: 1, script: 1, bible: 1 });
    assert.ok(!JSON.stringify(snapshot).includes("final_prompt")); assert.ok(!JSON.stringify(snapshot).includes("injected_ids"));
    changeBible(f);
    const before = JSON.stringify(f.store.readStaging(f.project.id, "board"));
    assert.throws(() => draft.write({ scene_id: "S02", shots: boardInput(sample("board")).shots.filter(s => s.scene_id === "S02") }), /来源已变化/);
    assert.throws(() => draft.finalize(), /来源已变化/);
    const resumed = new BoardDraft(new ProjectStore(f.dir), f.project.id);
    assert.throws(() => resumed.reset(undefined, "resume"), /来源已变化/);
    assert.equal(JSON.stringify(f.store.readStaging(f.project.id, "board")), before);
    assert.deepEqual(f.store.load(f.project.id).stages.board.versions, []);
    resumed.reset(undefined, "restart");
    assert.deepEqual(f.store.readStaging(f.project.id, "board")?.based_on, { story: 1, script: 1, bible: 2 });
    assert.deepEqual(resumed.snapshot().scenes, []);
  } finally { f.cleanup(); }
});
