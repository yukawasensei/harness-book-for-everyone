import assert from "node:assert/strict";
import { test } from "node:test";
import { assembleShotPrompt } from "./contracts/prompts.js";
import { sample } from "./testing/fixtures.js";

test("固定模板按镜头、场景、角色、道具、规格拼装，逐字保留固定描述", () => {
  const bible = sample("bible"), shot = sample("storyboard").shots[0];
  const part = "程禾排齐留言，麦冬将磁片贴在中央，构图留出河面，情绪克制。";
  const item = assembleShotPrompt(shot, bible, part);
  assert.deepEqual(item.injected_ids, ["L01", "C01", "C02", "P01", "P02"]);
  assert.equal(item.final_prompt, `[镜头] ${part}\n[场景] 旧候船亭：${bible.locations[0].description}\n[角色] 程禾：${bible.characters[0].appearance}\n[角色] 麦冬：${bible.characters[1].appearance}\n[道具] 蓝色机械计时器：${bible.props[0].description}\n[道具] 橙色空白磁片：${bible.props[1].description}\n[规格] 景别 全景，机位 ${shot.camera}，时长 ${shot.duration_s} 秒`);
  const other = assembleShotPrompt(sample("storyboard").shots[1], bible, part);
  assert.equal(item.final_prompt.split("\n").find(s => s.startsWith("[角色] 程禾")), other.final_prompt.split("\n").find(s => s.startsWith("[角色] 程禾")));
  bible.characters[0].appearance = `  ${bible.characters[0].appearance}\n保留原文空白。 `;
  assert.ok(assembleShotPrompt(shot, bible, part).final_prompt.includes(bible.characters[0].appearance));
});

const validPart = "程禾排齐留言，麦冬将磁片贴在中央，构图留出河面，情绪克制。";
test("镜头部分粗筛拒绝长度、设定编号、保留标记与镜头外角色及其别名", async () => {
  const { validateShotPart } = await import("./contracts/prompts.js");
  const board = sample("storyboard"), bible = sample("bible");
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

test("按镜暂存拒绝未知镜号与额外字段、覆盖全镜才汇总、坏重交不覆盖且汇总后封口", async () => {
  const { PromptDraft } = await import("./agent/prompt-draft.js");
  const { fixture } = await import("./testing/fixtures.js");
  const f = fixture();
  try {
    for (const stage of ["topic", "synopsis", "script", "bible", "storyboard"] as const) {
      f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
    }
    const d = new PromptDraft(f.store, f.project.id);
    const items = sample("prompts").items.map(({ shot_id, shot_part }) => ({ shot_id, shot_part }));
    assert.throws(() => d.write({ ...items[0], shot_id: "S99-01" }), /不存在/);
    for (const extra of [{ shot_id: null }, { shot_id: 12 }, { shot_part: 12 }, { shot_part: [] }, { final_prompt: "伪造" }, { injected_ids: ["C99"] }]) assert.throws(() => d.write({ ...items[0], ...extra }), /schema/);
    d.write(items[0]);
    assert.deepEqual(f.store.load(f.project.id).stages.prompts.versions, []);
    assert.throws(() => d.finalize(), /S01-02.*S03-02/);
    assert.throws(() => d.write({ ...items[0], shot_part: validPart + "陆岑在旁鼓掌" }), /陆岑/);
    for (const item of items.slice(1).reverse()) d.write(item);
    assert.equal(d.finalize().version, 1);
    const saved = f.store.readVersion(f.project.id, "prompts", 1);
    assert.deepEqual(saved.items.map(p => p.shot_id), sample("storyboard").shots.map(s => s.shot_id));
    assert.equal(saved.items[0].shot_part, items[0].shot_part);
    assert.match(saved.items[0].final_prompt, /^\[镜头\]/);
    assert.throws(() => d.write(items[0]), /已生成/);
    assert.throws(() => d.finalize(), /已生成/);
  } finally { f.cleanup(); }
});

test("存储边界复核一镜一条、全覆盖、原文拼装与程序引用，失败不消耗版本号", async () => {
  const { fixture } = await import("./testing/fixtures.js");
  const { readFileSync, writeFileSync, existsSync } = await import("node:fs");
  const f = fixture();
  try {
    for (const stage of ["topic", "synopsis", "script", "bible", "storyboard"] as const) {
      f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
    }
    const items = sample("storyboard").shots.map((shot, index) => assembleShotPrompt(shot, sample("bible"), sample("prompts").items[index].shot_part));
    const before = readFileSync(f.store.projectDir(f.project.id) + "/project.json", "utf8");
    for (const [bad, error] of [
      [{ items: items.slice(1) }, /缺少.*S01-01/],
      [{ items: [items[0], ...items] }, /重复.*S01-01/],
      [{ items: [{ ...items[0], shot_id: "S99-01" }, ...items.slice(1)] }, /不存在/],
      [{ items: [{ ...items[0], injected_ids: ["L01"] }, ...items.slice(1)] }, /注入编号/],
      [{ items: [{ ...items[0], final_prompt: "改写全部外观" }, ...items.slice(1)] }, /拼装原文/],
      [{ items: [{ ...items[0], shot_part: validPart + "陆岑入画" }, ...items.slice(1)] }, /陆岑/],
    ] as const) assert.throws(() => f.store.writeDraft(f.project.id, "prompts", bad), error);
    assert.equal(existsSync(f.store.artifactPath(f.project.id, "prompts", 1)), false);
    assert.equal(readFileSync(f.store.projectDir(f.project.id) + "/project.json", "utf8"), before);
    assert.equal(f.store.writeDraft(f.project.id, "prompts", { items }), 1);
    writeFileSync(f.store.artifactPath(f.project.id, "prompts", 1), JSON.stringify({ items: [{ ...items[0], final_prompt: "篡改" }, ...items.slice(1)] }));
    assert.throws(() => f.store.readVersion(f.project.id, "prompts", 1), /拼装原文/);
    assert.throws(() => f.store.adopt(f.project.id, "prompts", 1), /拼装原文/);
    assert.equal(f.store.load(f.project.id).stages.prompts.adopted_version, null);
    f.store.requestChanges(f.project.id, "prompts", 1, "修正");
    assert.throws(() => f.store.revisionContext(f.project.id, "prompts", 1), /拼装原文/);
  } finally { f.cleanup(); }
});

test("提示词受限会话只四工具，按镜读取不暴露外观；一次拒绝修正后汇总待审阅", async () => {
  const { fixture, packageRoot } = await import("./testing/fixtures.js");
  const { createStageSession } = await import("./agent/session.js");
  const { runStage } = await import("./agent/run.js");
  const { fakeStream } = await import("./testing/fake-model.js");
  const { getCurrentTools, getCurrentSystemPrompt } = await import("@earendil-works/pi-ai");
  const f = fixture();
  try {
    for (const stage of ["topic", "synopsis", "script", "bible", "storyboard"] as const) {
      f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
    }
    const session = await createStageSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "prompts", model: { provider: "ollama", id: "qwen3.8:27b" } });
    try {
      const fake = fakeStream(session.model!, [
        { call: "list_shots", args: {} }, { call: "read_shot", args: { shot_id: "S01-01" } },
        { call: "read_shot", args: { shot_id: "S99-01" } },
        { call: "write_shot_prompt", args: { shot_id: "S01-01", shot_part: validPart + "陆岑在旁鼓掌" } },
        ...sample("prompts").items.map(({ shot_id, shot_part }) => ({ call: "write_shot_prompt", args: { shot_id, shot_part } })),
        { call: "finalize_draft", args: {} }, { text: "请审阅" },
      ]);
      session.agent.streamFunction = fake.fn;
      const result = await runStage(session, f.store, f.project.id, "prompts");
      assert.equal(result.stop_reason, "draft_written"); assert.equal(result.errors.length, 2);
      assert.equal(f.store.load(f.project.id).stages.prompts.status, "pending_review");
      for (const context of fake.contexts) {
        assert.deepEqual(getCurrentTools(context.messages).map(t => t.name).sort(), ["finalize_draft", "list_shots", "read_shot", "write_shot_prompt"]);
        assert.equal(getCurrentSystemPrompt(context.messages), (await import("./agent/prompts.js")).PROMPTS_PROMPT);
      }
      const messagesBeforeFinalize = JSON.stringify(fake.contexts.slice(0, -1));
      for (const c of sample("bible").characters) assert.ok(!messagesBeforeFinalize.includes(c.appearance));
      for (const e of [...sample("bible").locations, ...sample("bible").props]) assert.ok(!messagesBeforeFinalize.includes(e.description));
      const entries = JSON.stringify(session.sessionManager.getEntries());
      for (const text of ["stage_run_start", "stage_run_end", "shot_changes", "duration_ms", "stop_reason", "context_notes"]) assert.ok(entries.includes(text));
    } finally { session.dispose(); }
  } finally { f.cleanup(); }
});

test("提示词修改预装指定旧稿，只重交一镜，其他镜头逐字沿用且固定描述不进修改上下文", async () => {
  const { fixture, packageRoot } = await import("./testing/fixtures.js");
  const { createStageSession } = await import("./agent/session.js");
  const { runStage } = await import("./agent/run.js");
  const { fakeStream } = await import("./testing/fake-model.js");
  const f = fixture();
  try {
    for (const stage of ["topic", "synopsis", "script", "bible", "storyboard"] as const) {
      f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
    }
    f.store.writeDraft(f.project.id, "prompts", sample("prompts"));
    const later = sample("prompts"), board = sample("storyboard"), bible = sample("bible");
    later.items[0] = assembleShotPrompt(board.shots[0], bible, "程禾排齐留言，麦冬注视河面，镜头留白，另一个候选版本。");
    f.store.writeDraft(f.project.id, "prompts", later);
    const note = "  只改 S02-01，动作之后停顿。\n其他镜保持原样。  ";
    f.store.requestChanges(f.project.id, "prompts", 1, note);
    const source = sample("prompts").items[2], revised = source.shot_part + "动作之后停顿，构图留白。";
    const session = await createStageSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "prompts", model: { provider: "ollama", id: "qwen3.8:27b" } });
    try {
      const fake = fakeStream(session.model!, [
        { call: "write_shot_prompt", args: { shot_id: source.shot_id, shot_part: revised } },
        { call: "finalize_draft", args: {} }, { text: "请审阅" },
      ]); session.agent.streamFunction = fake.fn;
      const result = await runStage(session, f.store, f.project.id, "prompts", "", undefined, 1);
      assert.equal(result.stop_reason, "draft_written"); assert.deepEqual(result.errors, []);
      const saved = f.store.readVersion(f.project.id, "prompts", 3);
      for (const item of sample("prompts").items.filter(i => i.shot_id !== source.shot_id)) assert.deepEqual(saved.items.find(i => i.shot_id === item.shot_id), item);
      assert.equal(saved.items[2].shot_part, revised);
      const changes = { revise_from: 1, resubmitted: ["S02-01"], reused: ["S01-01", "S01-02", "S02-02", "S03-01", "S03-02"], removed: [] };
      assert.deepEqual(result.shot_changes, changes);
      assert.deepEqual(f.store.load(f.project.id).version_metadata?.prompts?.[3].revision, changes);
      assert.deepEqual(f.store.readVersion(f.project.id, "prompts", 1), sample("prompts"));
      for (const context of fake.contexts) {
        const text = JSON.stringify(context.messages);
        for (const c of bible.characters) assert.ok(!text.includes(c.appearance));
        assert.ok(!text.includes('"final_prompt"')); assert.ok(!text.includes('"injected_ids"'));
      }
      const user = fake.contexts[0].messages.find(m => m.role === "user");
      assert.ok(JSON.stringify(user).includes(JSON.stringify(note).slice(1, -1)));
    } finally { session.dispose(); }
  } finally { f.cleanup(); }
});

test("提示词未汇总、中断、轮数耗尽均不出版本，暂存镜头可审计", async () => {
  const { fixture, packageRoot } = await import("./testing/fixtures.js");
  const { createStageSession } = await import("./agent/session.js");
  const { runStage, STAGE_TURN_LIMITS } = await import("./agent/run.js");
  const { fakeStream } = await import("./testing/fake-model.js");
  for (const mode of ["no_finalize", "abort", "budget"] as const) {
    const f = fixture();
    try {
      for (const stage of ["topic", "synopsis", "script", "bible", "storyboard"] as const) {
        f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
      }
      const session = await createStageSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "prompts", model: { provider: "ollama", id: "qwen3.8:27b" } });
      try {
        const turn = { call: "write_shot_prompt", args: { shot_id: "S01-01", shot_part: validPart } };
        const fake = fakeStream(session.model!, mode === "budget" ? Array.from({ length: 35 }, () => turn) : [turn, { text: "停止" }]);
        session.agent.streamFunction = fake.fn;
        const abort = new AbortController();
        if (mode === "abort") session.subscribe(e => { if (e.type === "tool_execution_end") abort.abort(); });
        const result = await runStage(session, f.store, f.project.id, "prompts", "", abort.signal);
        assert.equal(result.stop_reason, { no_finalize: "no_draft", abort: "aborted", budget: "max_turns" }[mode]);
        assert.deepEqual(f.store.load(f.project.id).stages.prompts.versions, []);
        if (mode === "budget") assert.equal(fake.contexts.length, STAGE_TURN_LIMITS.prompts);
        assert.match(JSON.stringify(session.sessionManager.getEntries()), /in_progress.*S01-01/);
      } finally { session.dispose(); }
    } finally { f.cleanup(); }
  }
});

test("提示词示例通过完整引用检查；空镜只注入场景与规格，未知引用拒绝", async () => {
  const { validatePromptReferences } = await import("./contracts/prompts.js");
  validatePromptReferences(sample("prompts"), sample("storyboard"), sample("bible"));
  const shot = { ...sample("storyboard").shots[0], character_ids: [], prop_ids: [] };
  const item = assembleShotPrompt(shot, sample("bible"), "河面留在画面左侧，镜头缓慢推近空白格。");
  assert.deepEqual(item.injected_ids, ["L01"]);
  assert.ok(!item.final_prompt.includes("[角色]")); assert.ok(!item.final_prompt.includes("[道具]"));
  for (const change of [{ location_id: "L99" }, { character_ids: ["C99"] }, { prop_ids: ["P99"] }])
    assert.throws(() => assembleShotPrompt({ ...shot, ...change }, sample("bible"), validPart), /不存在/);
});

test("提示词预览标明两种职责与复制按钮，修改高亮以镜号为单位", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ArtifactPreview } = await import(new URL("../web/src/ArtifactPreview.tsx", import.meta.url).href);
  const html = renderToStaticMarkup(createElement(ArtifactPreview, { stage: "prompts", value: sample("prompts"), revision: { revise_from: 1, resubmitted: ["S02-01"], reused: [], removed: [] } }));
  for (const text of ["模型写的部分", "程序注入的部分", "prompt-model", "prompt-injected", "复制 S01-01 完整提示词", "本版重交的镜头", "原始 JSON"]) assert.ok(html.includes(text), text);
  assert.equal((html.match(/class="prompt-card scene-revised"/g) ?? []).length, 1);
});

test("按镜读取与注入仅使用采用版本，忽略更晚候选；老站长演示不重新引入麦冬", async () => {
  const { fixture, packageRoot } = await import("./testing/fixtures.js");
  const { createDemoSession } = await import("./server/demo.js");
  const { runStage } = await import("./agent/run.js");
  const f = fixture();
  try {
    for (const stage of ["topic", "synopsis", "script"] as const) {
      f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
    }
    const bible = sample("bible"); bible.characters[1].name = "何望"; bible.characters[1].aliases = ["麦冬", "老站长"];
    f.store.writeDraft(f.project.id, "bible", bible);
    const laterBible = structuredClone(bible); laterBible.characters[0].appearance = "成年女性，黑色长发，穿深红色衬衫和黑色长裤。";
    f.store.writeDraft(f.project.id, "bible", laterBible); f.store.adopt(f.project.id, "bible", 1);
    const board = sample("storyboard"); board.shots.forEach(s => { s.action = s.action.replaceAll("麦冬", "何望"); if (s.dialogue) s.dialogue = s.dialogue.replaceAll("麦冬", "何望"); });
    f.store.writeDraft(f.project.id, "storyboard", board);
    const laterBoard = structuredClone(board); laterBoard.shots[0].camera = "另一个候选的机位";
    f.store.writeDraft(f.project.id, "storyboard", laterBoard); f.store.adopt(f.project.id, "storyboard", 1);
    const session = await createDemoSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "prompts" });
    try {
      const result = await runStage(session, f.store, f.project.id, "prompts");
      assert.equal(result.stop_reason, "draft_written"); assert.equal(result.errors.length, 1);
      const saved = f.store.readVersion(f.project.id, "prompts", 1);
      const text = JSON.stringify(saved);
      assert.ok(text.includes("何望")); assert.ok(!text.includes("麦冬"));
      assert.ok(!text.includes(laterBible.characters[0].appearance)); assert.ok(!text.includes(laterBoard.shots[0].camera));
      for (const item of saved.items) assert.ok(item.final_prompt.includes(bible.characters[0].appearance));
    } finally { session.dispose(); }
  } finally { f.cleanup(); }
});
