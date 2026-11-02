import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Type, validateToolArguments } from "@earendil-works/pi-ai";
import { validateArtifact, validateScene } from "./contracts/index.js";
import { ProjectStore } from "./project/store.js";
import { runStage } from "./agent/run.js";
import { createStageSession } from "./agent/session.js";
import { fakeStream } from "./testing/fake-model.js";
import { fixture, packageRoot, sample } from "./testing/fixtures.js";
import { toolErrorText, toolResultText, revisionDescription, currentRunDisplay, scriptProgress } from "../web/src/presentation.js";
import { appendEvent, type TimelineRow } from "../web/src/timeline.js";

function errorOf(fn: () => void) { try { fn(); } catch (error) { return (error as Error).message; } throw new Error("应当校验失败"); }

test("真实单场错误显示场、行和中文原因；原始工具结果不被改写", () => {
  const scene = { ...sample("script").scenes[0], lines: [
    { kind: "action", text: "等待" }, { kind: "action", text: "坐下" }, { kind: "dialogue", text: "等等" },
  ] };
  const raw = errorOf(() => validateScene(scene));
  const result = { content: [{ type: "text", text: raw }] };
  assert.equal(toolErrorText(result, { toolName: "write_scene", args: { scene } }), "第 1 场第 3 行是台词，但缺少角色");
  assert.equal(result.content[0].text, raw);
  const action = { ...scene, lines: [{ kind: "action", text: "等待", character: "程禾" }] };
  assert.match(toolErrorText({ content: [{ type: "text", text: errorOf(() => validateScene(action)) }] }, { toolName: "write_scene", args: { scene: action } }), /第 1 场第 1 行是动作，不能填写角色/);
  const wrongType = { ...scene, lines: [{ kind: "dialogue", text: "等待", character: 123 }] };
  assert.match(toolErrorText({ content: [{ type: "text", text: errorOf(() => validateScene(wrongType)) }] }, { toolName: "write_scene", args: { scene: wrongType } }), /角色必须是文字/);
});

test("通用翻译覆盖真实 schema 的缺字段、类型、数量、格式、范围和业务规则", () => {
  const translated = (raw: string) => toolErrorText({ content: [{ type: "text", text: raw }] });
  assert.match(translated(errorOf(() => validateArtifact("topic", {}))), /缺少.*片名/);
  assert.match(translated(errorOf(() => validateArtifact("topic", { ...sample("topic"), title: 123 }))), /片名.*文字/);
  assert.match(translated(errorOf(() => validateArtifact("topic", { ...sample("topic"), title: " " }))), /片名.*空白/);
  assert.match(translated(errorOf(() => validateArtifact("topic", { ...sample("topic"), target_minutes: 0 }))), /目标时长.*大于 0/);
  assert.match(translated(errorOf(() => validateArtifact("synopsis", { ...sample("synopsis"), beats: [] }))), /叙事拍.*至少.*4/);
  assert.match(translated(errorOf(() => validateArtifact("synopsis", { ...sample("synopsis"), beats: Array(5).fill("事件") }))), /叙事拍.*最多.*4/);
  assert.match(translated(errorOf(() => validateScene({ ...sample("script").scenes[0], scene_id: "S1" }))), /场次编号.*S01/);
  assert.match(translated(errorOf(() => validateArtifact("topic", { ...sample("topic"), extra: true }))), /不允许.*extra/);
  const board = sample("storyboard");
  board.shots[0].character_ids = ["C01", "C01"];
  assert.match(translated(errorOf(() => validateArtifact("storyboard", board))), /角色编号.*重复/);
  assert.match(translated(errorOf(() => validateArtifact("script", { scenes: [{ ...sample("script").scenes[0], scene_id: "S02" }] }))), /场次编号需从 S01 连续/);
  assert.match(translated("进行中草稿不存在 S02，不能删除"), /S02.*不存在|不存在.*S02/);
  assert.match(translated("本次剧本已生成 v2，不能重复 finalize 或继续写场"), /已经汇总.*v2/);
});

test("剧本按场可读，角色和动作逐行，原始 JSON 默认折叠；其他阶段仍显示 JSON", async () => {
  const { ArtifactPreview } = await import(new URL("../web/src/ArtifactPreview.tsx", import.meta.url).href);
  const html = renderToStaticMarkup(createElement(ArtifactPreview, { stage: "script", value: sample("script") }));
  assert.equal((html.match(/class="scene-card"/g) ?? []).length, 3);
  assert.match(html, /S01/);
  assert.match(html, /外景·旧候船亭·傍晚/);
  assert.match(html, /程禾[：:]/);
  assert.match(html, /动作/);
  assert.match(html, /<details><summary>查看原始 JSON<\/summary><pre>/);
  assert.ok(!html.includes("<details open"));
  const topic = renderToStaticMarkup(createElement(ArtifactPreview, { stage: "topic", value: sample("topic") }));
  assert.match(topic, /^<pre>/);
  assert.ok(!topic.includes("scene-card"));
});

test("SDK 参数校验也翻译为中文，不把 Received arguments 混入原因", () => {
  const tool = { name: "remove_scene", description: "删场", parameters: Type.Object({ scene_id: Type.String({ pattern: "^S[0-9]{2}$" }) }) };
  const raw = errorOf(() => validateToolArguments(tool, { type: "toolCall", id: "bad", name: "remove_scene", arguments: { scene_id: "S1" } }));
  const result = { content: [{ type: "text", text: raw }] };
  const visible = toolErrorText(result);
  assert.match(visible, /场次编号.*S01/);
  assert.ok(!/Validation failed|Received arguments|must match/.test(visible));
  assert.equal(result.content[0].text, raw);
});

test("剧本修改范围保存到版本元数据，重新创建存储后及审阅后仍可显示", async () => {
  const f = fixture();
  let session: Awaited<ReturnType<typeof createStageSession>> | undefined;
  try {
    for (const stage of ["topic", "synopsis"] as const) {
      f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1);
    }
    const original = sample("script");
    f.store.writeDraft(f.project.id, "script", original);
    f.store.requestChanges(f.project.id, "script", 1, "只改 S02");
    session = await createStageSession({ root: packageRoot, store: f.store, projectId: f.project.id, stage: "script" });
    session.agent.streamFunction = fakeStream(session.model!, [
      { call: "write_scene", args: { scene: { ...original.scenes[1], summary: "先征求讲述意愿" } } },
      { call: "finalize_draft", args: {} }, { text: "等待审阅" },
    ]).fn;
    assert.equal((await runStage(session, f.store, f.project.id, "script", "", undefined, 1)).stop_reason, "draft_written");
    const reload = new ProjectStore(f.dir);
    const metadata = reload.load(f.project.id).version_metadata;
    assert.ok(metadata?.script);
    const revision = metadata.script[2].revision;
    assert.deepEqual(revision, { revise_from: 1, resubmitted: ["S02"], reused: ["S01", "S03"], removed: [] });
    assert.match(revisionDescription(revision) ?? "", /相对 v1：重交 S02；沿用 S01、S03/);
    const { ReviewPanel } = await import(new URL("../web/src/ReviewPanel.tsx", import.meta.url).href);
    const html = renderToStaticMarkup(createElement(ReviewPanel, {
      stage: "script", state: reload.load(f.project.id).stages.script, revision, version: 2, loaded: true,
      busy: false, demo: false, runReason: null, error: "", onReview: async () => true, onRevise: () => {},
    }));
    assert.match(html, /相对 v1：重交 S02；沿用 S01、S03/);
    reload.adopt(f.project.id, "script", 2);
    assert.deepEqual(new ProjectStore(f.dir).load(f.project.id).version_metadata?.script?.[2].revision, revision);
    assert.ok(!revisionDescription(revision)?.includes("新增"));
    assert.equal(toolResultText({ content: [{ type: "text", text: "本版相对 v1：重交/新增 S02；沿用 S01、S03" }] }), "本版相对 v1：重交 S02；沿用 S01、S03");
  } finally { session?.dispose(); f.cleanup(); }
});

test("暂存进度取当前运行成功 write_scene 的 scene_count，覆盖不累加、错误不增加", () => {
  const running = { id: "current", stage: "script" as const, started_at: "today", abort_requested: false };
  let rows: TimelineRow[] = [];
  for (const [runId, count, isError] of [["old", 9, false], ["current", 1, false], ["current", 1, false], ["current", 8, true]] as const) {
    rows = appendEvent(rows, { type: "tool_execution_end", run_id: runId, stage: "script", toolCallId: String(rows.length), toolName: "write_scene", isError, result: { details: { scene_count: count } } });
  }
  assert.equal(scriptProgress(running, rows), "已暂存 1 场");
  assert.equal(scriptProgress({ ...running, id: "new" }, rows), "等待暂存进度");
  assert.equal(scriptProgress(null, rows), null);
  assert.equal(scriptProgress({ ...running, stage: "synopsis" }, rows), null);
  const current = currentRunDisplay(running, { ...running, stage: "synopsis", stop_reason: "draft_written", errors: [] });
  assert.equal(current?.stage, "script");
  assert.equal(current?.text, "运行中");
  assert.equal(current?.stopReason, null);
});

test("设定集按三组显示可读卡片、别名与出场场次，JSON 默认折叠", async () => {
  const { ArtifactPreview } = await import(new URL("../web/src/ArtifactPreview.tsx", import.meta.url).href);
  const bible = sample("bible"); bible.characters[2].aliases = ["修表师"];
  const html = renderToStaticMarkup(createElement(ArtifactPreview, { stage: "bible", value: bible }));
  assert.equal((html.match(/class="setting-card"/g) ?? []).length, 7);
  for (const label of ["角色", "道具", "场景"]) assert.ok(html.includes(`aria-label="${label}"`));
  for (const text of ["C01", "P01", "L01", "固定描述", "出场场次：S01、S02、S03", "别名：修表师", "粗筛", bible.characters[0].appearance]) assert.ok(html.includes(text), text);
  assert.match(html, /<details><summary>查看原始 JSON<\/summary><pre>/);
  assert.ok(!html.includes("<details open"));
  bible.props = [];
  assert.match(renderToStaticMarkup(createElement(ArtifactPreview, { stage: "bible", value: bible })), /无关键道具/);
});

test("设定集真实错误显示覆盖缺漏、来源、固定描述与中文字段；原始结果不变", () => {
  const show = (message: string) => toolErrorText({ content: [{ type: "text", text: message }] });
  const bible = sample("bible");
  bible.characters[0].appears_in = [];
  assert.match(show(errorOf(() => validateArtifact("bible", bible))), /角色列表第 1 项的出场场次.*至少/);
  bible.characters[0].appears_in = ["S1"];
  assert.match(show(errorOf(() => validateArtifact("bible", bible))), /出场场次.*S01/);
  bible.characters[0].appears_in = ["S01"];
  bible.characters[0].id = "C1";
  assert.match(show(errorOf(() => validateArtifact("bible", bible))), /C01 至 C99/);
  const old = sample("bible"); Reflect.deleteProperty(old.characters[0], "appears_in");
  assert.match(show(errorOf(() => validateArtifact("bible", old))), /缺少出场场次.*重新抽取/);
  assert.ok(!show(errorOf(() => validateArtifact("bible", old))).includes("appears_in"));
  for (const raw of ["设定集覆盖检查未通过：缺少台词角色“陆岑”（S02），请补充角色或别名", "C01 固定描述含剧情词：拿起；请移入剧本或镜头动作（粗筛仍需人工审阅）"]) {
    const result = { content: [{ type: "text", text: raw }] };
    assert.equal(toolErrorText(result), raw); assert.equal(result.content[0].text, raw);
  }
});

test("未开放与已采用阶段的页面引导不再要求运行或审阅", async () => {
  const { artifactGuidance } = await import("../web/src/presentation.js");
  const { ReviewPanel } = await import(new URL("../web/src/ReviewPanel.tsx", import.meta.url).href);
  const guidance = artifactGuidance("prompts", false);
  assert.match(guidance.empty, /分镜提示词暂未开放/);
  assert.ok(!/运行后|请先运行|先查看草稿/.test(Object.values(guidance).join("")));
  const html = renderToStaticMarkup(createElement(ReviewPanel, {
    stage: "prompts", implemented: false, version: null, loaded: false, busy: false,
    demo: true, runReason: "暂未开放", error: "", onReview: async () => true, onRevise: () => {},
  }));
  assert.match(html, /分镜提示词暂未开放/);
  assert.ok(!html.includes("请先运行阶段"));
  const adopted = artifactGuidance("storyboard", true, 2);
  assert.match(adopted.footer, /已采用 v2/);
  assert.ok(!/待审阅|先查看草稿|运行后/.test(Object.values(adopted).join("")));
});

test("剧本和分镜场次标题含地点时间，仅重交场高亮且有文字图例", async () => {
  const { ArtifactPreview } = await import(new URL("../web/src/ArtifactPreview.tsx", import.meta.url).href);
  const revision = { revise_from: 1, resubmitted: ["S02"], reused: ["S01", "S03"], removed: [] };
  for (const stage of ["script", "storyboard"] as const) {
    const props = { stage, value: sample(stage), script: sample("script"), bible: sample("bible"), revision };
    const html = renderToStaticMarkup(createElement(ArtifactPreview, props));
    for (const scene of sample("script").scenes) assert.ok(html.includes(`${scene.scene_id} · ${scene.heading}`));
    assert.equal((html.match(/class="[^"]*scene-revised[^"]*"/g) ?? []).length, 1);
    assert.match(html, /高亮：本版重交的场次；其余场沿用原稿/);
    if (stage === "storyboard") assert.match(html, /aria-label="S02 分镜" class="scene-revised"/);
    else assert.match(html, /class="scene-card scene-revised"><header><h3>S02/);
    const original = renderToStaticMarkup(createElement(ArtifactPreview, { ...props, revision: undefined }));
    assert.ok(!original.includes("scene-revised"));
    assert.ok(!original.includes("revision-legend"));
  }
});

test("旧错误术语也翻译为出场场次；采用设定引用错误显示名称和编号", async () => {
  const { validateStoryboardReferences } = await import("./contracts/index.js");
  const board = sample("storyboard"); board.shots[0].character_ids = ["C03"];
  const raw = errorOf(() => validateStoryboardReferences(board, sample("script"), sample("bible")));
  const result = { content: [{ type: "text", text: raw }] };
  assert.match(toolErrorText(result), /陆岑（C03）.*出场场次/);
  assert.equal(result.content[0].text, raw);
  assert.match(toolErrorText({ content: [{ type: "text", text: "C03 来源场不包含 S01" }] }), /出场场次/);
});
