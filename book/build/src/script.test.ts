import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { getCurrentSystemPrompt, getCurrentTools } from "@earendil-works/pi-ai";
import { validateScene } from "./contracts/index.js";
import { createStageSession } from "./agent/session.js";
import { SCRIPT_PROMPT } from "./agent/prompts.js";
import { runStage, STAGE_TURN_LIMITS } from "./agent/run.js";
import { fakeStream, type Turn } from "./testing/fake-model.js";
import { fixture, packageRoot, sample } from "./testing/fixtures.js";

const scene = (id = "S01") => ({ ...sample("script").scenes[0], scene_id: id });
async function setup(turns: Turn[]) {
  const f = fixture();
  for (const stage of ["story"] as const) {
    f.store.writeDraft(f.project.id, stage, sample(stage));
    f.store.adopt(f.project.id, stage, 1);
  }
  try {
    const session = await createStageSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "script", model: { provider: "ollama", id: "qwen3.8:27b" } });
    const fake = fakeStream(session.model!, turns);
    session.agent.streamFunction = fake.fn;
    return { ...f, session, fake, cleanup: () => { session.dispose(); f.cleanup(); } };
  } catch (error) { f.cleanup(); throw error; }
}

test("单场拒绝空行、坏编号、dialogue 缺角色、action 带角色，不转换类型", () => {
  validateScene(scene());
  for (const bad of [
    { ...scene(), scene_id: "S1" }, { ...scene(), lines: [] },
    { ...scene(), heading: 123 },
    { ...scene(), lines: [{ kind: "dialogue", text: "等等" }] },
    { ...scene(), lines: [{ kind: "action", character: "程禾", text: "停下" }] },
  ]) assert.throws(() => validateScene(bad), /不合规|character/);
});

test("script 只见四工具；坏场修正、同编号覆盖、乱序拼装，finalize 才出待审版本及警告", async () => {
  const corrected = { ...scene(), summary: "修正后的摘要" };
  const f = await setup([
    { call: "read_upstream", args: { stage: "story" } },
    { call: "write_scene", args: { scene: { ...scene(), lines: [{ kind: "dialogue", text: "漏了角色" }] } } },
    { call: "write_scene", args: { scene: scene("S02") } },
    { call: "write_scene", args: { scene: scene() } },
    { call: "write_scene", args: { scene: corrected } },
    { call: "finalize_draft", args: {} },
    { call: "finalize_draft", args: {} }, { text: "等待审阅" },
  ]);
  try {
    f.session.subscribe(event => {
      if (event.type === "tool_execution_end" && event.toolName === "write_scene") {
        assert.deepEqual(f.store.load(f.project.id).stages.script.versions, []);
      }
    });
    const result = await runStage(f.session, f.store, f.project.id, "script");
    assert.equal(result.stop_reason, "draft_written");
    assert.equal(result.errors.length, 2); // 坏场与重复 finalize 均拒绝。
    assert.deepEqual(f.store.readVersion(f.project.id, "script", 1), { scenes: [corrected, scene("S02")] });
    const state = f.store.load(f.project.id).stages;
    assert.deepEqual(state.script.versions, [1]);
    assert.equal(state.script.reviews?.[1].status, "pending");
    assert.equal(state.bible.status, "locked");
    for (const context of f.fake.contexts) {
      assert.equal(getCurrentSystemPrompt(context.messages), SCRIPT_PROMPT);
      assert.deepEqual(getCurrentTools(context.messages).map(t => t.name).sort(), ["finalize_draft", "read_upstream", "remove_scene", "write_scene"]);
    }
    assert.match(JSON.stringify(f.fake.contexts[6].messages), /警告.*2.*4/);
    const end = f.session.sessionManager.getEntries().find(e => e.type === "custom" && e.customType === "stage_run_end");
    assert.ok(end?.type === "custom");
    assert.deepEqual((end.data as { in_progress: { scenes: unknown } }).in_progress.scenes, [corrected, scene("S02")]);
  } finally { f.cleanup(); }
});

test("缺 S01、编号间断、空 finalize 被拒；补齐后才能形成版本", async () => {
  const f = await setup([
    { call: "finalize_draft", args: {} },
    { call: "write_scene", args: { scene: scene("S03") } },
    { call: "finalize_draft", args: {} },
    { call: "write_scene", args: { scene: scene() } },
    { call: "finalize_draft", args: {} },
    { call: "write_scene", args: { scene: scene("S02") } },
    { call: "finalize_draft", args: {} }, { text: "完成" },
  ]);
  try {
    const result = await runStage(f.session, f.store, f.project.id, "script");
    assert.equal(result.stop_reason, "draft_written");
    assert.equal(result.errors.length, 3);
    assert.match(result.errors[1], /S01/);
    assert.match(result.errors[2], /S02/);
  } finally { f.cleanup(); }
});

test("未 finalize 暂存落盘不出版本；显式重新开始不继承，禁用 write_draft", async () => {
  const f = await setup([{ call: "write_scene", args: { scene: scene() } }, { text: "先停下" }]);
  try {
    assert.equal((await runStage(f.session, f.store, f.project.id, "script")).stop_reason, "no_draft");
    assert.equal(existsSync(f.store.artifactPath(f.project.id, "script", 1)), false);
    assert.match(JSON.stringify(f.session.sessionManager.getEntries()), /in_progress/);
    const second = await createStageSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "script", model: { provider: "ollama", id: "qwen3.8:27b" } });
    try {
      second.agent.streamFunction = fakeStream(second.model!, [
        { call: "finalize_draft", args: {} },
        { call: "write_draft", args: { artifact: sample("script") } }, { text: "停止" },
      ]).fn;
      await assert.rejects(() => runStage(second, f.store, f.project.id, "script"), /选择从暂存继续或重新开始/);
      const result = await runStage(second, f.store, f.project.id, "script", "", undefined, undefined, { staging: "restart" });
      assert.equal(result.errors.length, 2);
      assert.equal(result.stop_reason, "no_draft");
    } finally { second.dispose(); }
  } finally { f.cleanup(); }
});

test("script 轮数预算为 20，超过八轮仍可分场，达到预算不出版本", async () => {
  const f = await setup(Array.from({ length: 22 }, () => ({ call: "write_scene", args: { scene: scene() } })));
  try {
    const result = await runStage(f.session, f.store, f.project.id, "script");
    assert.equal(STAGE_TURN_LIMITS.script, 20);
    assert.equal(STAGE_TURN_LIMITS.story, 8);
    assert.equal(result.stop_reason, "max_turns");
    assert.equal(f.fake.contexts.length, 20);
    assert.deepEqual(f.store.load(f.project.id).stages.script.versions, []);
  } finally { f.cleanup(); }
});

test("单场写入后中断，摘要保留进行中场且不生成版本", async () => {
  const f = await setup([{ call: "write_scene", args: { scene: scene() } }, { text: "不应执行" }]);
  const controller = new AbortController();
  try {
    f.session.subscribe(e => { if (e.type === "tool_execution_end") controller.abort(); });
    assert.equal((await runStage(f.session, f.store, f.project.id, "script", "", controller.signal)).stop_reason, "aborted");
    assert.deepEqual(f.store.load(f.project.id).stages.script.versions, []);
    const entries = JSON.stringify(f.session.sessionManager.getEntries());
    assert.match(entries, /in_progress/);
    assert.match(entries, /S01/);
  } finally { f.cleanup(); }
});

test("存储层拒绝缺首场、重复编号与缺场，不写版本", () => {
  const f = fixture();
  try {
    for (const stage of ["story"] as const) {
      f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
    }
    for (const scenes of [[scene("S02")], [scene(), scene()], [scene(), scene("S03")]]) {
      assert.throws(() => f.store.writeDraft(f.project.id, "script", { scenes }), /必须从 S01 连续/);
      assert.equal(existsSync(f.store.artifactPath(f.project.id, "script", 1)), false);
    }
  } finally { f.cleanup(); }
});

test("坏场不覆盖已有场；四场四拍无数量警告；汇总后不能再写场", async () => {
  const f = await setup([
    { call: "write_scene", args: { scene: scene() } },
    { call: "write_scene", args: { scene: { ...scene(), lines: [] } } },
    ...["S02", "S03", "S04"].map(id => ({ call: "write_scene", args: { scene: scene(id) } })),
    { call: "finalize_draft", args: {} },
    { call: "write_scene", args: { scene: scene("S05") } }, { text: "完成" },
  ]);
  try {
    const result = await runStage(f.session, f.store, f.project.id, "script");
    assert.equal(result.errors.length, 2);
    assert.equal(result.stop_reason, "draft_written");
    assert.deepEqual(f.store.readVersion(f.project.id, "script", 1).scenes[0], scene());
    const end = f.session.sessionManager.getEntries().find(e => e.type === "custom" && e.customType === "stage_run_end");
    assert.ok(end?.type === "custom");
    assert.deepEqual((end.data as { in_progress: { warnings: string[] } }).in_progress.warnings, []);
  } finally { f.cleanup(); }
});

test("修改运行预装指定原稿，只重交 S02 即可汇总，其余场逐字一致并记录沿用关系", async () => {
  const original = sample("script");
  const changed = { ...original.scenes[1], summary: "程禾先征求讲述意愿。" };
  const f = await setup([
    { call: "write_scene", args: { scene: changed } },
    { call: "finalize_draft", args: {} }, { text: "仅修改第二场，等待审阅" },
  ]);
  try {
    f.store.writeDraft(f.project.id, "script", original);
    // 另一个候选不是本次修改来源，不能被 seed 误选。
    f.store.writeDraft(f.project.id, "script", { scenes: [scene()] });
    const note = "只修改 S02，其他场保持原样。";
    f.store.requestChanges(f.project.id, "script", 1, note);
    const raw = readFileSync(f.store.artifactPath(f.project.id, "script", 1), "utf8");
    const result = await runStage(f.session, f.store, f.project.id, "script", "", undefined, 1);
    assert.equal(result.stop_reason, "draft_written");
    assert.deepEqual(result.errors, []);
    const revised = f.store.readVersion(f.project.id, "script", 3);
    assert.equal(JSON.stringify(revised.scenes[0]), JSON.stringify(original.scenes[0]));
    assert.equal(JSON.stringify(revised.scenes[2]), JSON.stringify(original.scenes[2]));
    assert.deepEqual(revised.scenes[1], changed);
    assert.equal(readFileSync(f.store.artifactPath(f.project.id, "script", 1), "utf8"), raw);
    const changes = { revise_from: 1, resubmitted: ["S02"], reused: ["S01", "S03"], removed: [] };
    assert.deepEqual(Reflect.get(result, "scene_changes"), changes);
    const end = f.session.sessionManager.getEntries().find(e => e.type === "custom" && e.customType === "stage_run_end");
    assert.ok(end?.type === "custom");
    assert.deepEqual(Reflect.get(end.data as object, "scene_changes"), changes);
    const request = JSON.stringify(f.fake.contexts[0].messages);
    assert.match(request, /只重交需要修改的场/);
    assert.ok(request.includes(note));
    assert.match(JSON.stringify(f.fake.contexts[2].messages), /相对 v1.*S02.*S01.*S03/);
  } finally { f.cleanup(); }
});

test("remove_scene 删除已 seed 的场，缺号拒绝并提示重排，修正后可汇总", async () => {
  const original = sample("script");
  const moved = { ...original.scenes[2], scene_id: "S02" };
  const f = await setup([
    { call: "remove_scene", args: { scene_id: "S02" } },
    { call: "finalize_draft", args: {} },
    { call: "write_scene", args: { scene: moved } },
    { call: "remove_scene", args: { scene_id: "S03" } },
    { call: "finalize_draft", args: {} }, { text: "已删除并重排" },
  ]);
  try {
    f.store.writeDraft(f.project.id, "script", original);
    f.store.requestChanges(f.project.id, "script", 1, "删第二场，后续重排。");
    const result = await runStage(f.session, f.store, f.project.id, "script", "", undefined, 1);
    assert.equal(result.stop_reason, "draft_written");
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /S02.*重排/);
    assert.deepEqual(f.store.readVersion(f.project.id, "script", 2).scenes, [original.scenes[0], moved]);
    assert.deepEqual(Reflect.get(result, "scene_changes"), { revise_from: 1, resubmitted: ["S02"], reused: ["S01"], removed: ["S03"] });
  } finally { f.cleanup(); }
});

test("普通运行即使已有版本仍从空暂存区开始，删不存在或非法场拒绝", async () => {
  const f = await setup([
    { call: "remove_scene", args: { scene_id: "S02" } },
    { call: "remove_scene", args: { scene_id: "../S01" } },
    { call: "finalize_draft", args: {} }, { text: "没有暂存场" },
  ]);
  try {
    f.store.writeDraft(f.project.id, "script", sample("script"));
    const result = await runStage(f.session, f.store, f.project.id, "script");
    assert.equal(result.stop_reason, "no_draft");
    assert.equal(result.errors.length, 3);
    assert.deepEqual(f.store.load(f.project.id).stages.script.versions, [1]);
    assert.deepEqual(Reflect.get(result, "scene_changes"), { revise_from: null, resubmitted: [], reused: [], removed: [] });
  } finally { f.cleanup(); }
});

test("修改运行中断时保留 seed 与改动场记录，不提前生成版本", async () => {
  const f = await setup([{ call: "write_scene", args: { scene: scene("S02") } }]);
  const controller = new AbortController();
  try {
    f.store.writeDraft(f.project.id, "script", sample("script"));
    f.store.requestChanges(f.project.id, "script", 1, "仅改 S02。");
    f.session.subscribe(e => { if (e.type === "tool_execution_end") controller.abort(); });
    const result = await runStage(f.session, f.store, f.project.id, "script", "", controller.signal, 1);
    assert.equal(result.stop_reason, "aborted");
    assert.deepEqual(f.store.load(f.project.id).stages.script.versions, [1]);
    assert.deepEqual(Reflect.get(result, "scene_changes"), { revise_from: 1, resubmitted: ["S02"], reused: ["S01", "S03"], removed: [] });
  } finally { f.cleanup(); }
});
