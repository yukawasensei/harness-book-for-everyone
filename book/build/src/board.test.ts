import { readFileSync } from "node:fs";
import { join } from "node:path";
import { packageRoot } from "./testing/fixtures.js";
import { boardInput } from "./contracts/board.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Value } from "typebox/value";
import {
  STAGES, StorySchema, BoardShotInputSchema, BoardSceneInputSchema, BoardShotSchema, BoardSchema,
  assembleBoard, validateBoard, validateBoardSceneInput, validateStory, type BoardShotInput,
} from "./contracts/index.js";
import { sample } from "./testing/fixtures.js";

function inputs(): BoardShotInput[] {
  return boardInput(sample("board")).shots;
}
function story() { return sample("story"); }
function assemble(shots: unknown = inputs()) { return assembleBoard({ shots }, sample("script"), sample("bible")); }

test("四工序最终契约，Story 合并概念且只存一份标题与冲突", () => {
  assert.deepEqual(STAGES, ["story", "script", "bible", "board"]);
  assert.ok(Value.Check(StorySchema, story()));
  validateStory(story());
  assert.deepEqual(Object.keys(StorySchema.properties).sort(), ["title", "logline", "genre", "audience", "target_minutes", "beats", "tone"].sort());
});

test("Story 严格四拍、正数时长、非空文本，不转换类型或接受额外字段", () => {
  for (const patch of [
    { beats: [] }, { beats: ["起", "承", "转"] }, { beats: ["起", "承", "转", "合", "尾"] },
    { beats: ["起", "承", "转", 4] }, { beats: ["起", "承", "转", "  "] },
    { target_minutes: 0 }, { target_minutes: -1 }, { target_minutes: "3" },
    { title: "  " }, { tone: null }, { synopsis: {} },
  ]) {
    const value = { ...story(), ...patch };
    assert.equal(Value.Check(StorySchema, value), false);
    assert.throws(() => validateStory(value), /story schema/);
  }
  for (const key of Object.keys(story())) {
    const value = { ...story() }; Reflect.deleteProperty(value, key);
    assert.throws(() => validateStory(value), /story schema/);
  }
});

test("Board 输入、单场、持久化 schema 直接通过真实 TypeBox 校验", () => {
  const shots = inputs(), board = assemble();
  assert.ok(Value.Check(BoardShotInputSchema, shots[0]));
  assert.ok(Value.Check(BoardSceneInputSchema, { scene_id: "S01", shots: shots.slice(0, 2) }));
  assert.ok(Value.Check(BoardShotSchema, board.shots[0]));
  assert.ok(Value.Check(BoardSchema, board));
  validateBoardSceneInput({ scene_id: "S01", shots: shots.slice(0, 2) }, sample("script"), sample("bible"));
  validateBoard(board, sample("script"), sample("bible"));
});

for (const patch of [{ final_prompt: "伪造" }, { injected_ids: ["L01"] }, { assembly_template: "shot-v1" }]) {
  test(`Board 模型输入拒绝派生字段 ${Object.keys(patch)[0]}，不静默剥离`, () => {
    const shots = inputs(); Object.assign(shots[0], patch);
    assert.equal(Value.Check(BoardShotInputSchema, shots[0]), false);
    assert.throws(() => validateBoardSceneInput({ scene_id: "S01", shots: shots.slice(0, 2) }, sample("script"), sample("bible")), /schema/);
    assert.throws(() => assemble(shots), /schema/);
  });
}

test("Board 输入拒绝缺字段、空镜列表、错误 ID、重复引用和类型强转", () => {
  for (const patch of [
    { shot_part: undefined }, { shot_part: 12 }, { shot_part: "  " }, { shot_id: "S1-01" },
    { scene_id: "S1" }, { location_id: "C01" }, { character_ids: ["C01", "C01"] },
    { prop_ids: ["L01"] }, { duration_s: "30" }, { duration_s: 0 }, { camera: "  " },
    { dialogue: 12 }, { shot_size: "未知景别" },
  ]) {
    const shots = inputs(); Object.assign(shots[0], patch);
    assert.equal(Value.Check(BoardShotInputSchema, shots[0]), false);
    assert.throws(() => assemble(shots), /schema/);
  }
  for (const value of [null, {}, { shots: [] }, { shots: inputs(), extra: true }])
    assert.throws(() => assembleBoard(value, sample("script"), sample("bible")), /schema/);
  for (const value of [{ scene_id: "S01", shots: [] }, { scene_id: "S01", shots: inputs().slice(0, 2), extra: true }])
    assert.throws(() => validateBoardSceneInput(value, sample("script"), sample("bible")), /schema/);
});

test("Board 单场拒绝混场，完整汇总拒绝漏场、重复镜头和镜号缺口", () => {
  assert.throws(() => validateBoardSceneInput({ scene_id: "S01", shots: inputs().slice(2, 4) }, sample("script"), sample("bible")), /混入其他场/);
  assert.throws(() => assemble(inputs().slice(0, 4)), /S03.*没有镜头/);
  assert.throws(() => assemble([inputs()[0], ...inputs()]), /编号应为/);
  const shots = inputs(); shots[0].shot_id = "S01-02";
  assert.throws(() => assemble(shots), /编号应为/);
});

for (const [patch, pattern] of [
  [{ scene_id: "S99", shot_id: "S99-01" }, /场次不存在/],
  [{ location_id: "L99" }, /不存在的地点/],
  [{ character_ids: ["C99"] }, /不存在的角色/],
  [{ prop_ids: ["P99"] }, /不存在的道具/],
  [{ location_id: "L02" }, /出场场次不包含/],
  [{ character_ids: ["C03"] }, /出场场次不包含/],
  [{ dialogue: "陆岑：还没有说完。" }, /台词说话人.*不在/],
  [{ dialogue: "没有标注说话人的台词" }, /未标注/],
] as const) {
  test(`Board 逐场与汇总复用引用闸门：${JSON.stringify(patch)}`, () => {
    const shots = inputs(); Object.assign(shots[0], patch);
    const group = { scene_id: shots[0].scene_id, shots: [shots[0]] };
    assert.throws(() => validateBoardSceneInput(group, sample("script"), sample("bible")), pattern);
    assert.throws(() => assemble(shots), pattern);
  });
}

test("Board 保持道具仅要求存在的规则，不新增出场硬闸门", () => {
  const bible = sample("bible"); bible.props[0].appears_in = ["S03"];
  const board = assembleBoard({ shots: inputs() }, sample("script"), bible);
  validateBoard(board, sample("script"), bible);
});

test("Board 镜头部分粗筛在单场、汇总和持久化复核均生效", () => {
  const bible = sample("bible"); bible.characters[2].aliases = ["修表师"];
  for (const part of ["短", "镜".repeat(501), "镜".repeat(12) + "c01", "镜".repeat(12) + "修表师", ...["镜头", "场景", "角色", "道具", "规格"].map(marker => "镜".repeat(12) + `[${marker}]`)]) {
    const shots = inputs(); shots[0].shot_part = part;
    assert.throws(() => validateBoardSceneInput({ scene_id: "S01", shots: shots.slice(0, 2) }, sample("script"), bible), /镜头部分|不在本镜/);
    assert.throws(() => assembleBoard({ shots }, sample("script"), bible), /镜头部分|不在本镜/);
    const board = assemble(); board.shots[0].shot_part = part;
    assert.throws(() => validateBoard(board, sample("script"), bible), /镜头部分|不在本镜/);
  }
});

test("Board 长度按去首尾空白后的 Unicode 码点计数，原文不裁剪", () => {
  for (const part of ["🙂".repeat(12), "🙂".repeat(500), `  ${"🙂".repeat(12)}\n `]) {
    const shots = inputs(); shots[0].shot_part = part;
    const board = assemble(shots);
    assert.equal(board.shots[0].shot_part, part);
    assert.ok(board.shots[0].final_prompt.startsWith(`[镜头] ${part}\n`));
    validateBoard(board, sample("script"), sample("bible"));
  }
  for (const part of ["🙂".repeat(11), "🙂".repeat(501), `  ${"🙂".repeat(11)}  `]) {
    const shots = inputs(); shots[0].shot_part = part;
    assert.throws(() => assemble(shots), /12.*500/);
  }
});

test("Board 拼装与旧模板逐字一致，按引用顺序原样注入空白和换行", () => {
  const board = assemble(), old = JSON.parse(readFileSync(join(packageRoot, "examples/sample-project/prompts.json"), "utf8")) as { items: { shot_id: string; final_prompt: string; injected_ids: string[] }[] };
  assert.equal(board.assembly_template, "shot-v1");
  for (const shot of board.shots) {
    const item = old.items.find(item => item.shot_id === shot.shot_id)!;
    assert.equal(shot.final_prompt, item.final_prompt);
    assert.deepEqual(shot.injected_ids, item.injected_ids);
  }
  const shots = inputs(), bible = sample("bible");
  shots[0].character_ids.reverse(); shots[0].prop_ids.reverse();
  bible.locations[0].description = `  ${bible.locations[0].description}\n原文保留。 `;
  bible.characters[1].appearance = ` ${bible.characters[1].appearance}\n `;
  const result = assembleBoard({ shots }, sample("script"), bible).shots[0];
  assert.deepEqual(result.injected_ids, ["L01", "C02", "C01", "P02", "P01"]);
  assert.equal(result.final_prompt, [
    `[镜头] ${shots[0].shot_part}`,
    `[场景] ${bible.locations[0].name}：${bible.locations[0].description}`,
    `[角色] ${bible.characters[1].name}：${bible.characters[1].appearance}`,
    `[角色] ${bible.characters[0].name}：${bible.characters[0].appearance}`,
    `[道具] ${bible.props[1].name}：${bible.props[1].description}`,
    `[道具] ${bible.props[0].name}：${bible.props[0].description}`,
    `[规格] 景别 ${shots[0].shot_size}，机位 ${shots[0].camera}，时长 ${shots[0].duration_s} 秒`,
  ].join("\n"));
});

test("Board 输入乱序仍按场镜排序，纯拼装不修改或共享可变输入", () => {
  const shots = inputs().reverse(), script = sample("script"), bible = sample("bible");
  const before = JSON.stringify({ shots, script, bible });
  const board = assembleBoard({ shots }, script, bible);
  assert.deepEqual(board.shots.map(shot => shot.shot_id), sample("board").shots.map(shot => shot.shot_id));
  assert.equal(JSON.stringify({ shots, script, bible }), before);
  board.shots[0].character_ids.push("C99");
  assert.equal(JSON.stringify({ shots, script, bible }), before);
});

test("Board 空镜只注入地点和规格，仍禁止镜头部分提及角色", () => {
  const shots = inputs(); Object.assign(shots[0], { character_ids: [], prop_ids: [], shot_part: "河面留在画面左侧，镜头缓慢推近空白格。" });
  const board = assemble(shots);
  assert.deepEqual(board.shots[0].injected_ids, ["L01"]);
  assert.ok(!board.shots[0].final_prompt.includes("[角色]"));
  assert.ok(!board.shots[0].final_prompt.includes("[道具]"));
  shots[0].shot_part += "程禾入画";
  assert.throws(() => assemble(shots), /不在本镜/);
});

test("Board 持久化校验拒绝派生篡改、模板伪造、漏场与额外字段", () => {
  for (const mutate of [
    (board: ReturnType<typeof assemble>) => { board.shots[0].final_prompt += " "; },
    (board: ReturnType<typeof assemble>) => { board.shots[0].injected_ids.reverse(); },
    (board: ReturnType<typeof assemble>) => { board.shots[0].camera += "改变"; },
    (board: ReturnType<typeof assemble>) => { board.shots = board.shots.slice(0, 4); },
    (board: ReturnType<typeof assemble>) => { Reflect.set(board, "assembly_template", "shot-v2"); },
    (board: ReturnType<typeof assemble>) => { Reflect.deleteProperty(board, "assembly_template"); },
    (board: ReturnType<typeof assemble>) => { Reflect.set(board.shots[0], "prompt", "另一份"); },
    (board: ReturnType<typeof assemble>) => { Reflect.deleteProperty(board.shots[0], "injected_ids"); },
  ]) {
    const board = assemble(); mutate(board);
    const before = JSON.stringify(board);
    assert.throws(() => validateBoard(board, sample("script"), sample("bible")), /schema|编号|拼装原文|没有镜头/);
    assert.equal(JSON.stringify(board), before);
  }
  const bible = sample("bible"); bible.characters[0].appearance += "新外观";
  assert.throws(() => validateBoard(assemble(), sample("script"), bible), /拼装原文/);
});
