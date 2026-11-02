import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getCurrentTools, getCurrentSystemPrompt } from "@earendil-works/pi-ai";
import { validateArtifact, validateSceneShots, validateStoryboardReferences, storyboardWarnings, type Artifacts } from "./contracts/index.js";
import { StoryboardDraft } from "./agent/storyboard-draft.js";
import { createStageSession } from "./agent/session.js";
import { STORYBOARD_PROMPT } from "./agent/prompts.js";
import { runStage, STAGE_TURN_LIMITS } from "./agent/run.js";
import { createDemoSession } from "./server/demo.js";
import { fakeStream, type Turn } from "./testing/fake-model.js";
import { fixture, packageRoot, sample } from "./testing/fixtures.js";
import { translateValidationError } from "../web/src/validation-errors.js";

function ready() {
  const f = fixture();
  for (const stage of ["topic", "synopsis", "script", "bible"] as const) {
    f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
  }
  return f;
}
const group = (id = "S01", board = sample("storyboard")) => ({ scene_id: id, shots: board.shots.filter(shot => shot.scene_id === id) });
const check = (board: Artifacts["storyboard"]) => { validateArtifact("storyboard", board); validateStoryboardReferences(board, sample("script"), sample("bible")); };

test("原创分镜六镜覆盖三场，允许空角色与道具、无台词，时长吻合无警告", () => {
  check(sample("storyboard"));
  const board = sample("storyboard"); board.shots[0].character_ids = []; board.shots[0].prop_ids = [];
  check(board);
  assert.deepEqual(storyboardWarnings(board, sample("topic")), []);
});

for (const [name, change, expected] of [
  ["场号不存在", { scene_id: "S99" }, /S01-01.*场次不存在/],
  ["前缀不匹配", { shot_id: "S02-01" }, /编号应为 S01-01/],
  ["镜号从 01 开始", { shot_id: "S01-00" }, /编号应为 S01-01/],
  ["地点不存在", { location_id: "L99" }, /S01-01.*不存在的地点.*L99/],
  ["角色不存在", { character_ids: ["C99"] }, /S01-01.*不存在的角色.*C99/],
  ["道具不存在", { prop_ids: ["P99"] }, /S01-01.*不存在的道具.*P99/],
  ["地点不属于该场", { location_id: "L02" }, /S01-01.*地点 社区修表间（L02）.*出场场次.*S01/],
  ["角色不属于该场", { character_ids: ["C03"] }, /S01-01.*角色 陆岑（C03）.*改镜头或回到设定集修正出场场次/],
  ["台词角色未引用", { dialogue: "陆岑：等等。" }, /S01-01.*台词说话人陆岑（C03）/],
  ["台词未标注归属", { dialogue: "等等。" }, /未标注.*角色名：台词/],
  ["多行台词逐行检查", { dialogue: "程禾：等等。\n陆岑：好。" }, /台词说话人陆岑（C03）/],
] as const) test(`引用闸门拒绝${name}，定位镜号与改法`, () => {
  const board = sample("storyboard"); Object.assign(board.shots[0], change);
  assert.throws(() => check(board), expected);
});

test("同场缺镜号、重复镜号、漏场、跨场提交与坏 schema 均拒绝", () => {
  for (const id of ["S01-01", "S01-03"]) {
    const board = sample("storyboard"); board.shots[1].shot_id = id;
    assert.throws(() => check(board), /编号应为 S01-02/);
  }
  assert.throws(() => check({ shots: sample("storyboard").shots.filter(s => s.scene_id !== "S02") }), /S02 没有镜头/);
  assert.throws(() => validateSceneShots({ scene_id: "S02", shots: group().shots }, sample("script"), sample("bible")), /混入其他场/);
  for (const change of [{ shots: [] }, { shots: [{ ...group().shots[0], duration_s: "30" }] }]) {
    assert.throws(() => validateSceneShots({ ...group(), ...change }, sample("script"), sample("bible")), /schema/);
  }
});

test("说话人支持采用设定的名称、别名与 ID；每行分别核对", () => {
  const bible = sample("bible"); bible.characters[0].aliases = ["志愿者"];
  for (const dialogue of ["程禾：等等。", "志愿者: 等等。", "C01：等等。", "程禾：等等。\n麦冬：好。"])
    validateSceneShots({ scene_id: "S01", shots: [{ ...group().shots[0], dialogue }] }, sample("script"), bible);
});

test("时长偏差超过 20% 只警告；边界不警告，写入与采用仍成功", () => {
  const f = ready();
  try {
    for (const ratio of [0.8, 1.2]) {
      const board = sample("storyboard"); board.shots.forEach(s => s.duration_s *= ratio);
      assert.deepEqual(storyboardWarnings(board, sample("topic")), []);
    }
    const draft = new StoryboardDraft(f.store, f.project.id);
    const board = sample("storyboard"); board.shots.forEach(s => s.duration_s = 1);
    for (const id of ["S03", "S01", "S02"]) draft.write(group(id, board));
    const result = draft.finalize();
    assert.match(result.warnings[0], /6 秒.*180 秒.*20%/);
    assert.equal(f.store.adopt(f.project.id, "storyboard", 1).stages.prompts.status, "ready");
  } finally { f.cleanup(); }
});

test("存储层按采用上游复核；坏稿、损坏版本读取/采用/修改不落盘不解锁", () => {
  const f = ready();
  try {
    const board = sample("storyboard"); board.shots[0].prop_ids = ["P99"];
    const before = readFileSync(f.store.projectDir(f.project.id) + "/project.json", "utf8");
    assert.throws(() => f.store.writeDraft(f.project.id, "storyboard", board), /P99/);
    assert.equal(existsSync(f.store.artifactPath(f.project.id, "storyboard", 1)), false);
    assert.equal(readFileSync(f.store.projectDir(f.project.id) + "/project.json", "utf8"), before);
    f.store.writeDraft(f.project.id, "storyboard", sample("storyboard"));
    writeFileSync(f.store.artifactPath(f.project.id, "storyboard", 1), JSON.stringify(board));
    assert.throws(() => f.store.readVersion(f.project.id, "storyboard", 1), /P99/);
    assert.throws(() => f.store.adopt(f.project.id, "storyboard", 1), /P99/);
    assert.equal(f.store.load(f.project.id).stages.prompts.status, "locked");
    f.store.requestChanges(f.project.id, "storyboard", 1, "修正");
    assert.throws(() => f.store.revisionContext(f.project.id, "storyboard", 1), /P99/);
  } finally { f.cleanup(); }
});

test("按场暂存乱序拼装、坏重交不覆盖、删除可补齐，未汇总无版本、成功封口", () => {
  const f = ready();
  try {
    const d = new StoryboardDraft(f.store, f.project.id);
    d.write(group("S03")); d.write(group());
    assert.throws(() => d.write({ ...group(), shots: [{ ...group().shots[0], prop_ids: ["P99"] }] }), /P99/);
    assert.deepEqual(f.store.load(f.project.id).stages.storyboard.versions, []);
    assert.throws(() => d.finalize(), /S02 没有镜头/);
    d.write(group("S02")); d.remove("S01");
    assert.throws(() => d.remove("S01"), /不存在/);
    assert.throws(() => d.finalize(), /S01 没有镜头/);
    d.write(group()); d.finalize();
    assert.deepEqual(f.store.readVersion(f.project.id, "storyboard", 1), sample("storyboard"));
    assert.throws(() => d.write(group()), /已生成/);
    assert.throws(() => d.finalize(), /已生成/);
    d.reset(); assert.deepEqual(d.snapshot().scenes, []);
  } finally { f.cleanup(); }
});

async function sessionFixture(turns: Turn[]) {
  const f = ready();
  const session = await createStageSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "storyboard", model: { provider: "ollama", id: "qwen3.8:27b" } });
  const fake = fakeStream(session.model!, turns); session.agent.streamFunction = fake.fn;
  return { ...f, session, fake, cleanup: () => { session.dispose(); f.cleanup(); } };
}

test("分镜会话仅四工具与原创模板；两个引用拒绝后修正，待审阅且未自动采用", async () => {
  const f = await sessionFixture([
    { call: "read_upstream", args: { stage: "script" } }, { call: "read_upstream", args: { stage: "bible" } },
    { call: "write_scene_shots", args: { scene: { ...group(), shots: [{ ...group().shots[0], prop_ids: ["P99"] }] } } },
    { call: "write_scene_shots", args: { scene: { ...group(), shots: [{ ...group().shots[0], character_ids: ["C03"] }] } } },
    ...["S03", "S02", "S01"].map(id => ({ call: "write_scene_shots", args: { scene: group(id) } })),
    { call: "finalize_draft", args: {} }, { text: "请审阅" },
  ]);
  try {
    const result = await runStage(f.session, f.store, f.project.id, "storyboard");
    assert.equal(result.stop_reason, "draft_written"); assert.equal(result.errors.length, 2);
    assert.deepEqual(f.store.readVersion(f.project.id, "storyboard", 1), sample("storyboard"));
    assert.equal(f.store.load(f.project.id).stages.prompts.status, "locked");
    for (const context of f.fake.contexts) {
      assert.equal(getCurrentSystemPrompt(context.messages), STORYBOARD_PROMPT);
      assert.deepEqual(getCurrentTools(context.messages).map(t => t.name).sort(), ["finalize_draft", "read_upstream", "remove_scene_shots", "write_scene_shots"]);
    }
  } finally { f.cleanup(); }
});

test("分镜修改预装指定旧版，只交 S02，其余镜头逐字沿用并保存修改记录", async () => {
  const revised = group("S02"); revised.shots[0].camera = "轻轻推近";
  const f = await sessionFixture([{ call: "write_scene_shots", args: { scene: revised } }, { call: "finalize_draft", args: {} }, { text: "请审阅" }]);
  try {
    f.store.writeDraft(f.project.id, "storyboard", sample("storyboard"));
    const other = sample("storyboard"); other.shots[0].camera = "其他候选";
    f.store.writeDraft(f.project.id, "storyboard", other);
    f.store.requestChanges(f.project.id, "storyboard", 1, "只改 S02");
    const result = await runStage(f.session, f.store, f.project.id, "storyboard", "", undefined, 1);
    assert.equal(result.stop_reason, "draft_written"); assert.deepEqual(result.errors, []);
    const board = f.store.readVersion(f.project.id, "storyboard", 3);
    for (const id of ["S01", "S03"]) assert.deepEqual(group(id, board), group(id));
    assert.deepEqual(group("S02", board), revised);
    assert.deepEqual(f.store.readVersion(f.project.id, "storyboard", 1), sample("storyboard"));
    const changes = { revise_from: 1, resubmitted: ["S02"], reused: ["S01", "S03"], removed: [] };
    assert.deepEqual(result.scene_changes, changes);
    assert.deepEqual(f.store.load(f.project.id).version_metadata?.storyboard?.[3].revision, changes);
    assert.match(JSON.stringify(f.session.sessionManager.getEntries()), /stage_run_end.*scene_changes/);
  } finally { f.cleanup(); }
});

test("分镜未汇总及中断不出版本，达到阶段预算记录 max_turns", async () => {
  for (const mode of ["no_finalize", "abort", "budget"] as const) {
    const f = await sessionFixture(mode === "budget" ? Array.from({ length: 26 }, () => ({ call: "write_scene_shots", args: { scene: group() } })) : [{ call: "write_scene_shots", args: { scene: group() } }, { text: "停止" }]);
    const abort = new AbortController();
    try {
      if (mode === "abort") f.session.subscribe(e => { if (e.type === "tool_execution_end") abort.abort(); });
      const result = await runStage(f.session, f.store, f.project.id, "storyboard", "", abort.signal);
      assert.equal(result.stop_reason, { no_finalize: "no_draft", abort: "aborted", budget: "max_turns" }[mode]);
      assert.deepEqual(f.store.load(f.project.id).stages.storyboard.versions, []);
      if (mode === "budget") assert.equal(f.fake.contexts.length, STAGE_TURN_LIMITS.storyboard);
      assert.match(JSON.stringify(f.session.sessionManager.getEntries()), /in_progress/);
    } finally { f.cleanup(); }
  }
});

test("分镜可读预览按场分组、名称及 ID、景别机位动作时长，拒绝消息为中文", async () => {
  const { ArtifactPreview } = await import(new URL("../web/src/ArtifactPreview.tsx", import.meta.url).href);
  const html = renderToStaticMarkup(createElement(ArtifactPreview, { stage: "storyboard", value: sample("storyboard"), bible: sample("bible") }));
  for (const text of ["S01 分镜", "S02 分镜", "S03 分镜", "程禾（C01）", "旧候船亭（L01）", "橙色空白磁片（P02）", "机位", "动作", "全景", "180", "原始 JSON"]) assert.ok(html.includes(text), text);
  for (const change of [{ prop_ids: ["P99"] }, { character_ids: ["C03"] }]) {
    try { check({ shots: [{ ...sample("storyboard").shots[0], ...change }] }); assert.fail(); }
    catch (error) { assert.match(translateValidationError((error as Error).message), /S01-01.*请/); }
  }
});

test("离线演示兼容老站长，分镜两次拒绝后可采用；修改只交 S02", async () => {
  const f = fixture();
  try {
    for (const stage of ["topic", "synopsis", "script", "bible", "storyboard"] as const) {
      const session = await createDemoSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage });
      try {
        // 同一静态演示序列去掉等待；业务工具保持真实执行。
        const topic = sample("topic"); topic.logline += "老站长";
        if (stage === "topic") session.agent.streamFunction = fakeStream(session.model!, [{ call: "write_draft", args: { artifact: topic } }, { text: "请审阅" }]).fn;
        const result = await runStage(session, f.store, f.project.id, stage);
        assert.equal(result.stop_reason, "draft_written");
        if (stage === "storyboard") assert.equal(result.errors.length, 2);
      } finally { session.dispose(); }
      if (stage !== "storyboard") f.store.adopt(f.project.id, stage, 1);
    }
    assert.ok(JSON.stringify(f.store.readVersion(f.project.id, "storyboard", 1)).includes("何望"));
    f.store.requestChanges(f.project.id, "storyboard", 1, "只改 S02");
    const session = await createDemoSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "storyboard", reviseFrom: 1 });
    try {
      const result = await runStage(session, f.store, f.project.id, "storyboard", "", undefined, 1);
      assert.deepEqual(result.errors, []);
      assert.deepEqual(result.scene_changes?.resubmitted, ["S02"]);
    } finally { session.dispose(); }
    assert.equal(f.store.adopt(f.project.id, "storyboard", 2).stages.prompts.status, "ready");
  } finally { f.cleanup(); }
});

test("分镜引用以采用版本为准，不读取更晚未采用的剧本或设定集候选", () => {
  const f = fixture();
  try {
    for (const stage of ["topic", "synopsis"] as const) {
      f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
    }
    f.store.writeDraft(f.project.id, "script", sample("script"));
    const laterScript = sample("script"); laterScript.scenes.pop();
    f.store.writeDraft(f.project.id, "script", laterScript);
    f.store.adopt(f.project.id, "script", 1);
    f.store.writeDraft(f.project.id, "bible", sample("bible"));
    const laterBible = sample("bible"); laterBible.props[0].id = "P99";
    f.store.writeDraft(f.project.id, "bible", laterBible);
    f.store.adopt(f.project.id, "bible", 1);
    f.store.writeDraft(f.project.id, "storyboard", sample("storyboard"));
    const board = sample("storyboard"); board.shots[0].prop_ids = ["P99"];
    assert.throws(() => f.store.writeDraft(f.project.id, "storyboard", board), /P99/);
    assert.deepEqual(f.store.load(f.project.id).stages.storyboard.versions, [1]);
  } finally { f.cleanup(); }
});
