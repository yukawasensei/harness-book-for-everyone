import assert from "node:assert/strict";
import { test } from "node:test";
import { STAGES, parseStage, validateArtifact } from "./contracts/index.js";
import { sample } from "./testing/fixtures.js";

for (const stage of STAGES) {
  test(`${stage}：原创示例通过契约`, () => validateArtifact(stage, sample(stage)));
  test(`${stage}：缺字段、多字段、空值拒绝`, () => {
    assert.throws(() => validateArtifact(stage, {}), /schema 不合规/);
    assert.throws(() => validateArtifact(stage, { ...sample(stage), surprise: true }), /schema 不合规/);
    assert.throws(() => validateArtifact(stage, null), /schema 不合规/);
  });
}

test("故事时长为正数，不接受数字字符串和纯空白", () => {
  for (const target_minutes of [0, -1, "3"]) {
    assert.throws(() => validateArtifact("story", { ...sample("story"), target_minutes }), /schema 不合规/);
  }
  assert.throws(() => validateArtifact("story", { ...sample("story"), title: "  " }), /schema 不合规/);
});

test("故事严格包含起承转合四拍", () => {
  assert.throws(() => validateArtifact("story", { ...sample("story"), beats: ["只有开头"] }), /schema 不合规/);
});

test("台词必须给角色；action 不能伪装成未知类型", () => {
  const script = sample("script");
  const line = script.scenes[0].lines[1];
  Reflect.deleteProperty(line, "character");
  assert.throws(() => validateArtifact("script", script), /schema 不合规/);
  const other = sample("script");
  Reflect.set(other.scenes[0].lines[0], "kind", "monologue");
  assert.throws(() => validateArtifact("script", other), /schema 不合规/);
});

test("场、角色、道具、地点与镜头 ID 都有格式约束", () => {
  const script = sample("script"); script.scenes[0].scene_id = "S1";
  assert.throws(() => validateArtifact("script", script), /schema 不合规/);
  for (const group of ["characters", "props", "locations"] as const) {
    const bible = sample("bible"); bible[group][0].id = "../outside";
    assert.throws(() => validateArtifact("bible", bible), /schema 不合规/);
  }
  const board = sample("board"); board.shots[0].shot_id = "S01_01";
  assert.throws(() => validateArtifact("board", board), /schema 不合规/);
  const prompts = sample("board"); prompts.shots[0].injected_ids = ["S01"];
  assert.throws(() => validateArtifact("board", prompts), /schema 不合规/);
});

test("分镜拒绝错误类型引用、重复引用和非正时长", () => {
  for (const change of [
    { location_id: "C01" }, { character_ids: ["C01", "C01"] },
    { prop_ids: ["L01"] }, { duration_s: 0 }, { duration_s: "30" },
  ]) {
    const board = sample("board"); Object.assign(board.shots[0], change);
    assert.throws(() => validateArtifact("board", board), /schema 不合规/);
  }
});

test("原创样例三场三角色、两道具两地点，引用与原文拼装互相对齐", () => {
  const script = sample("script"), bible = sample("bible"), board = sample("board"), prompts = sample("board");
  assert.equal(script.scenes.length, 3);
  assert.equal(bible.characters.length, 3);
  assert.ok(bible.props.length >= 2 && bible.locations.length >= 2);
  const descriptions = new Map([
    ...bible.characters.map(c => [c.id, c.appearance] as const),
    ...bible.props.map(p => [p.id, p.description] as const),
    ...bible.locations.map(l => [l.id, l.description] as const),
  ]);
  assert.equal(descriptions.size, bible.characters.length + bible.props.length + bible.locations.length);
  assert.equal(new Set(board.shots.map(s => s.shot_id)).size, board.shots.length);
  assert.equal(prompts.shots.length, board.shots.length);
  for (const shot of board.shots) {
    assert.ok(script.scenes.some(s => s.scene_id === shot.scene_id));
    assert.ok(shot.shot_id.startsWith(`${shot.scene_id}-`));
    const ids = [shot.location_id, ...shot.character_ids, ...shot.prop_ids];
    const item = prompts.shots.find(p => p.shot_id === shot.shot_id)!;
    assert.deepEqual(item.injected_ids, ids);
    for (const id of ids) assert.ok(descriptions.has(id), id);
    for (const id of ids) assert.ok(item.final_prompt.includes(descriptions.get(id)!));
    assert.ok(item.final_prompt.startsWith(`[镜头] ${item.shot_part}\n[场景] `));
    assert.ok(item.final_prompt.endsWith(`[规格] 景别 ${shot.shot_size}，机位 ${shot.camera}，时长 ${shot.duration_s} 秒`));
  }
  assert.equal(board.shots.reduce((n, shot) => n + shot.duration_s, 0), sample("story").target_minutes * 60);
});

test("未知阶段拒绝", () => assert.throws(() => parseStage("../story"), /未知阶段/));
