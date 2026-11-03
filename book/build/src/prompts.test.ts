import assert from "node:assert/strict";
import { test } from "node:test";
import { assembleShotPrompt } from "./contracts/prompts.js";
import { sample } from "./testing/fixtures.js";

test("固定模板按镜头、场景、角色、道具、规格拼装，逐字保留固定描述", () => {
  const bible = sample("bible"), shot = sample("board").shots[0];
  const part = "程禾排齐留言，麦冬将磁片贴在中央，构图留出河面，情绪克制。";
  const item = assembleShotPrompt(shot, bible, part);
  assert.deepEqual(item.injected_ids, ["L01", "C01", "C02", "P01", "P02"]);
  assert.equal(item.final_prompt, `[镜头] ${part}\n[场景] 旧候船亭：${bible.locations[0].description}\n[角色] 程禾：${bible.characters[0].appearance}\n[角色] 麦冬：${bible.characters[1].appearance}\n[道具] 蓝色机械计时器：${bible.props[0].description}\n[道具] 橙色空白磁片：${bible.props[1].description}\n[规格] 景别 全景，机位 ${shot.camera}，时长 ${shot.duration_s} 秒`);
  const other = assembleShotPrompt(sample("board").shots[1], bible, part);
  assert.equal(item.final_prompt.split("\n").find(s => s.startsWith("[角色] 程禾")), other.final_prompt.split("\n").find(s => s.startsWith("[角色] 程禾")));
  bible.characters[0].appearance = `  ${bible.characters[0].appearance}\n保留原文空白。 `;
  assert.ok(assembleShotPrompt(shot, bible, part).final_prompt.includes(bible.characters[0].appearance));
});

const validPart = "程禾排齐留言，麦冬将磁片贴在中央，构图留出河面，情绪克制。";
test("镜头部分粗筛拒绝长度、设定编号、保留标记与镜头外角色及其别名", async () => {
  const { validateShotPart } = await import("./contracts/prompts.js");
  const board = sample("board"), bible = sample("bible");
  bible.characters[2].aliases = ["修表师"];
  for (const [part, error] of [
    ["短", /12.*500/], ["镜".repeat(501), /12.*500/],
    [validPart + "C01", /设定编号/], [validPart + "p99", /设定编号/],
    ...["镜头", "场景", "角色", "道具", "规格"].map(marker => [validPart + `[${marker}]`, /保留标记/] as const),
    [validPart + "陆岑在旁鼓掌", /S01-01.*陆岑.*不在.*角色/], [validPart + "修表师入画", /修表师/],
  ] as const) assert.throws(() => validateShotPart(board.shots[0], bible, part), error);
  for (const part of [validPart, "镜".repeat(12), "镜".repeat(500), "🙂".repeat(12)]) validateShotPart(board.shots[0], bible, part);
  const empty = { ...board.shots[0], character_ids: [] };
  assert.throws(() => validateShotPart(empty, bible, validPart), /程禾.*不在/);
  validateShotPart(empty, bible, "河面留在画面左侧，镜头缓慢推近空白格。");
});

// 独立提示词阶段的安全意图迁入逐场分镜板。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { STAGES, assembleBoard, validateBoard } from "./contracts/index.js";
import { boardInput } from "./contracts/board.js";
import { BoardDraft } from "./agent/board-draft.js";
import { fixture, packageRoot } from "./testing/fixtures.js";
import { createStageSession } from "./agent/session.js";
import { runStage, STAGE_TURN_LIMITS } from "./agent/run.js";
import { fakeStream } from "./testing/fake-model.js";
import { getCurrentTools, getCurrentSystemPrompt } from "@earendil-works/pi-ai";
import { BOARD_PROMPT } from "./agent/prompts.js";

const groups = () => ["S01", "S02", "S03"].map(scene_id => ({ scene_id, shots: boardInput(sample("board")).shots.filter(s => s.scene_id === scene_id) }));
function upstream(f: ReturnType<typeof fixture>) {
  for (const stage of STAGES.slice(0, -1)) { f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1); }
}

test("逐场暂存拒绝未知场镜与派生字段、全场才汇总、坏重交不覆盖、汇总封口", () => {
  const f = fixture(); try {
    upstream(f); const d = new BoardDraft(f.store, f.project.id), scenes = groups(); d.reset();
    assert.throws(() => d.write({ scene_id: "S99", shots: [{ ...scenes[0].shots[0], scene_id: "S99", shot_id: "S99-01" }] }), /不存在/);
    for (const extra of [{ shot_id: null }, { shot_id: 12 }, { shot_part: 12 }, { shot_part: [] }, { final_prompt: "伪造" }, { injected_ids: ["C99"] }])
      assert.throws(() => d.write({ scene_id: "S01", shots: [{ ...scenes[0].shots[0], ...extra }] }), /schema/);
    d.write(scenes[0]); assert.deepEqual(f.store.load(f.project.id).stages.board.versions, []);
    assert.throws(() => d.finalize(), /S02.*S03/);
    assert.throws(() => d.write({ scene_id: "S01", shots: [{ ...scenes[0].shots[0], shot_part: validPart + "陆岑在旁鼓掌" }] }), /陆岑/);
    for (const group of scenes.slice(1).reverse()) d.write(group);
    assert.equal(d.finalize().version, 1);
    assert.deepEqual(f.store.readVersion(f.project.id, "board", 1), sample("board"));
    assert.throws(() => d.write(scenes[0]), /已生成/); assert.throws(() => d.finalize(), /已生成/);
  } finally { f.cleanup(); }
});

test("存储写入/读取/采用/修改复核原文、模板、编号和覆盖，失败不消耗版本号", () => {
  const f = fixture(); try {
    upstream(f); const before = readFileSync(f.store.projectDir(f.project.id) + "/project.json", "utf8");
    const bads = [
      (b: ReturnType<typeof sample<"board">>) => { b.shots = b.shots.filter(s => s.scene_id !== "S01"); },
      (b: ReturnType<typeof sample<"board">>) => { b.shots.unshift(b.shots[0]); },
      (b: ReturnType<typeof sample<"board">>) => { b.shots[0].shot_id = "S99-01"; },
      (b: ReturnType<typeof sample<"board">>) => { b.shots[0].injected_ids = ["L01"]; },
      (b: ReturnType<typeof sample<"board">>) => { b.shots[0].final_prompt = "改写全部外观"; },
      (b: ReturnType<typeof sample<"board">>) => { b.shots[0].shot_part += "陆岑入画"; },
      (b: ReturnType<typeof sample<"board">>) => { Reflect.set(b, "assembly_template", "unknown"); },
    ];
    for (const mutate of bads) { const bad = sample("board"); mutate(bad); assert.throws(() => f.store.writeDraft(f.project.id, "board", bad), /没有镜头|编号|注入编号|拼装原文|陆岑|schema/); }
    assert.equal(existsSync(f.store.artifactPath(f.project.id, "board", 1)), false);
    assert.equal(readFileSync(f.store.projectDir(f.project.id) + "/project.json", "utf8"), before);
    assert.equal(f.store.writeDraft(f.project.id, "board", sample("board")), 1);
    const bad = sample("board"); bad.shots[0].final_prompt = "篡改";
    writeFileSync(f.store.artifactPath(f.project.id, "board", 1), JSON.stringify(bad));
    assert.throws(() => f.store.readVersion(f.project.id, "board", 1), /拼装原文/);
    assert.throws(() => f.store.adopt(f.project.id, "board", 1), /拼装原文/);
    assert.equal(f.store.load(f.project.id).stages.board.adopted_version, null);
    f.store.requestChanges(f.project.id, "board", 1, "修正");
    assert.throws(() => f.store.revisionContext(f.project.id, "board", 1), /拼装原文/);
  } finally { f.cleanup(); }
});

test("分镜板受限会话只有四工具；引用与镜头部分拒绝后修正，一次汇总完整待审版本", async () => {
  const f = fixture(); try {
    upstream(f);
    const session = await createStageSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "board", model: { provider: "ollama", id: "qwen3.8:27b" } });
    try {
      const first = groups()[0];
      const fake = fakeStream(session.model!, [
        { call: "read_upstream", args: { stage: "bible" } },
        { call: "write_scene_shots", args: { scene: { ...first, shots: [{ ...first.shots[0], prop_ids: ["P99"] }] } } },
        { call: "write_scene_shots", args: { scene: { ...first, shots: [{ ...first.shots[0], shot_part: validPart + "陆岑在旁鼓掌" }] } } },
        ...groups().map(scene => ({ call: "write_scene_shots", args: { scene } })),
        { call: "finalize_draft", args: {} }, { text: "请审阅" },
      ]); session.agent.streamFunction = fake.fn;
      const result = await runStage(session, f.store, f.project.id, "board");
      assert.equal(result.stop_reason, "draft_written"); assert.equal(result.errors.length, 2);
      assert.equal(f.store.load(f.project.id).stages.board.status, "pending_review");
      assert.deepEqual(f.store.readVersion(f.project.id, "board", 1), sample("board"));
      for (const context of fake.contexts) {
        assert.deepEqual(getCurrentTools(context.messages).map(t => t.name).sort(), ["finalize_draft", "read_upstream", "remove_scene_shots", "write_scene_shots"]);
        assert.equal(getCurrentSystemPrompt(context.messages), BOARD_PROMPT);
      }
      assert.ok(JSON.stringify(fake.contexts).includes(sample("bible").characters[0].appearance));
      const entries = JSON.stringify(session.sessionManager.getEntries());
      for (const field of ["stage_run_start", "stage_run_end", "scene_changes", "duration_ms", "stop_reason", "context_notes"]) assert.ok(entries.includes(field));
    } finally { session.dispose(); }
  } finally { f.cleanup(); }
});

test("分镜板修改指定旧稿，只重交 S02，其他场逐字沿用，修改上下文仅含可写字段", async () => {
  const f = fixture(); try {
    upstream(f); f.store.writeDraft(f.project.id, "board", sample("board"));
    const input = boardInput(sample("board")); input.shots[0].shot_part += "另一个候选版本。";
    f.store.writeDraft(f.project.id, "board", assembleBoard(input, sample("script"), sample("bible")));
    const note = "  只改 S02，动作之后停顿。\n其他场保持原样。  "; f.store.requestChanges(f.project.id, "board", 1, note);
    const scene = groups()[1]; scene.shots[0].shot_part += "动作之后停顿，构图留白。";
    const session = await createStageSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "board", model: { provider: "ollama", id: "qwen3.8:27b" } });
    try {
      const fake = fakeStream(session.model!, [{ call: "write_scene_shots", args: { scene } }, { call: "finalize_draft", args: {} }, { text: "请审阅" }]); session.agent.streamFunction = fake.fn;
      const result = await runStage(session, f.store, f.project.id, "board", "", undefined, 1);
      assert.equal(result.stop_reason, "draft_written"); assert.deepEqual(result.errors, []);
      const saved = f.store.readVersion(f.project.id, "board", 3);
      for (const shot of sample("board").shots.filter(s => s.scene_id !== "S02")) assert.deepEqual(saved.shots.find(s => s.shot_id === shot.shot_id), shot);
      assert.equal(saved.shots[2].shot_part, scene.shots[0].shot_part);
      const changes = { revise_from: 1, resubmitted: ["S02"], reused: ["S01", "S03"], removed: [] };
      assert.deepEqual(result.scene_changes, changes); assert.deepEqual(f.store.load(f.project.id).version_metadata?.board?.[3].revision, changes);
      assert.deepEqual(f.store.readVersion(f.project.id, "board", 1), sample("board"));
      const user = JSON.stringify(fake.contexts[0].messages.find(m => m.role === "user"));
      assert.ok(user.includes(JSON.stringify(note).slice(1, -1)));
      assert.ok(!user.includes("final_prompt")); assert.ok(!user.includes("injected_ids"));
      assert.ok(!user.includes(sample("bible").characters[0].appearance));
    } finally { session.dispose(); }
  } finally { f.cleanup(); }
});

test("分镜板未汇总、中断、轮数耗尽不出版本，逐场暂存可审计", async () => {
  for (const mode of ["no_finalize", "abort", "budget"] as const) {
    const f = fixture(); try {
      upstream(f); const session = await createStageSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "board", model: { provider: "ollama", id: "qwen3.8:27b" } });
      try {
        const turn = { call: "write_scene_shots", args: { scene: groups()[0] } };
        const fake = fakeStream(session.model!, mode === "budget" ? Array.from({ length: 35 }, () => turn) : [turn, { text: "停止" }]); session.agent.streamFunction = fake.fn;
        const abort = new AbortController(); if (mode === "abort") session.subscribe(e => { if (e.type === "tool_execution_end") abort.abort(); });
        const result = await runStage(session, f.store, f.project.id, "board", "", abort.signal);
        assert.equal(result.stop_reason, { no_finalize: "no_draft", abort: "aborted", budget: "max_turns" }[mode]);
        assert.deepEqual(f.store.load(f.project.id).stages.board.versions, []);
        if (mode === "budget") assert.equal(fake.contexts.length, STAGE_TURN_LIMITS.board);
        assert.match(JSON.stringify(session.sessionManager.getEntries()), /in_progress.*S01-01/);
      } finally { session.dispose(); }
    } finally { f.cleanup(); }
  }
});

test("完整分镜板空镜只注入场景与规格，未知引用拒绝", () => {
  validateBoard(sample("board"), sample("script"), sample("bible"));
  const shot = { ...sample("board").shots[0], character_ids: [], prop_ids: [] };
  const item = assembleShotPrompt(shot, sample("bible"), "河面留在画面左侧，镜头缓慢推近空白格。");
  assert.deepEqual(item.injected_ids, ["L01"]);
  assert.ok(!item.final_prompt.includes("[角色]")); assert.ok(!item.final_prompt.includes("[道具]"));
  for (const change of [{ location_id: "L99" }, { character_ids: ["C99"] }, { prop_ids: ["P99"] }])
    assert.throws(() => assembleShotPrompt({ ...shot, ...change }, sample("bible"), validPart), /不存在/);
});

test("分镜板预览保留双色职责与复制，修改以场为单位高亮", async () => {
  const { createElement } = await import("react"); const { renderToStaticMarkup } = await import("react-dom/server");
  const { ArtifactPreview } = await import(new URL("../web/src/features/artifacts/components/ArtifactPreview.tsx", import.meta.url).href);
  const html = renderToStaticMarkup(createElement(ArtifactPreview, { stage: "board", value: sample("board"), revision: { revise_from: 1, resubmitted: ["S02"], reused: [], removed: [] } }));
  for (const text of ["蓝色：镜头描写（AI 编写）", "绿色：角色与场景外观（设定集原样带入）", "prompt-model", "prompt-injected", "复制 S01-01 提示词", "本版重交的场次", "原始 JSON"]) assert.ok(html.includes(text), text);
  assert.equal((html.match(/class="[^"]*prompt-card[^"]*scene-revised[^"]*"/g) ?? []).length, 2);
});

test("分镜板演示仅取采用设定，老站长名称与原文正确注入，候选外观不泄漏", async () => {
  const { createDemoSession } = await import("./server/demo.js"); const f = fixture(); try {
    for (const stage of ["story", "script"] as const) { f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1); }
    const bible = sample("bible"); bible.characters[1].name = "何望"; bible.characters[1].aliases = ["麦冬", "老站长"];
    f.store.writeDraft(f.project.id, "bible", bible);
    const later = structuredClone(bible); later.characters[0].appearance = "成年女性，黑色长发，穿深红色衬衫和黑色长裤。";
    f.store.writeDraft(f.project.id, "bible", later); f.store.adopt(f.project.id, "bible", 1);
    const session = await createDemoSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "board" });
    try {
      const result = await runStage(session, f.store, f.project.id, "board"); assert.equal(result.stop_reason, "draft_written"); assert.equal(result.errors.length, 3);
      const saved = f.store.readVersion(f.project.id, "board", 1), text = JSON.stringify(saved);
      assert.ok(text.includes("何望")); assert.ok(!text.includes("麦冬")); assert.ok(!text.includes(later.characters[0].appearance));
      for (const shot of saved.shots.filter(s => s.character_ids.includes("C01"))) assert.ok(shot.final_prompt.includes(bible.characters[0].appearance));
    } finally { session.dispose(); }
  } finally { f.cleanup(); }
});
