import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { STAGES } from "./contracts/index.js";
import { ProjectStore } from "./project/store.js";
import { adoptDraft, assertRunnable, initialWorkflow } from "./workflow/index.js";
import { fixture, sample } from "./testing/fixtures.js";

test("建项目：story ready，其余 locked，采用版本为空", () => {
  const f = fixture(); try {
    for (const [i, stage] of STAGES.entries()) {
      assert.deepEqual(f.project.stages[stage], { status: i === 0 ? "ready" : "locked", versions: [], adopted_version: null });
    }
    assert.deepEqual(new ProjectStore(f.dir).load(f.project.id), f.project);
  } finally { f.cleanup(); }
});

test("未采用上游时不能运行、写草稿或采用下游，拒绝不落盘", () => {
  const f = fixture(); try {
    f.store.writeDraft(f.project.id, "story", sample("story"));
    assert.throws(() => assertRunnable(f.store.load(f.project.id).stages, "script"), /story 尚未采用/);
    assert.throws(() => f.store.writeDraft(f.project.id, "script", sample("script")), /story 尚未采用/);
    assert.throws(() => f.store.adopt(f.project.id, "script", 1), /story 尚未采用/);
    assert.equal(existsSync(f.store.artifactPath(f.project.id, "script", 1)), false);
    assert.throws(() => f.store.readAdopted(f.project.id, "story"), /尚未采用/);
  } finally { f.cleanup(); }
});

test("不合规草稿不创建 artifacts，不修改 project.json", () => {
  const f = fixture(); try {
    const file = join(f.store.projectDir(f.project.id), "project.json");
    const before = readFileSync(file, "utf8");
    assert.throws(() => f.store.writeDraft(f.project.id, "story", {}), /schema 不合规/);
    assert.equal(readFileSync(file, "utf8"), before);
    assert.equal(existsSync(join(f.store.projectDir(f.project.id), "artifacts")), false);
  } finally { f.cleanup(); }
});

test("草稿生成 v1/v2 且旧文件不变；可以采用 v1，下游只读 v1", () => {
  const f = fixture(); try {
    const v1 = sample("story"), v2 = { ...v1, title: "另一个标题" };
    assert.equal(f.store.writeDraft(f.project.id, "story", v1), 1);
    const original = readFileSync(f.store.artifactPath(f.project.id, "story", 1), "utf8");
    assert.equal(f.store.writeDraft(f.project.id, "story", v2), 2);
    assert.equal(readFileSync(f.store.artifactPath(f.project.id, "story", 1), "utf8"), original);
    assert.equal(f.store.load(f.project.id).stages.story.status, "pending_review");
    const project = f.store.adopt(f.project.id, "story", 1);
    const { reviews, ...stageState } = project.stages.story;
    assert.deepEqual(stageState, { status: "adopted", versions: [1, 2], adopted_version: 1 });
    assert.equal(reviews?.[1].status, "adopted");
    assert.ok(Number.isFinite(Date.parse(reviews![1].at!)));
    assert.deepEqual(reviews?.[2], { status: "pending" });
    assert.equal(project.stages.script.status, "ready");
    assert.equal(project.stages.bible.status, "locked");
    assert.deepEqual(f.store.readAdopted(f.project.id, "story"), v1);
    assertRunnable(project.stages, "script");
  } finally { f.cleanup(); }
});

test("四阶段逐个写入、采用、重载，最后阶段不越界解锁", () => {
  const f = fixture(); try {
    for (const stage of STAGES) {
      assertRunnable(f.store.load(f.project.id).stages, stage);
      f.store.writeDraft(f.project.id, stage, sample(stage));
      f.store.adopt(f.project.id, stage, 1);
      assert.deepEqual(new ProjectStore(f.dir).readAdopted(f.project.id, stage), sample(stage));
    }
    assert.ok(STAGES.every(s => f.store.load(f.project.id).stages[s].status === "adopted"));
  } finally { f.cleanup(); }
});

test("不存在的版本不能采用，状态保持 pending_review", () => {
  const f = fixture(); try {
    f.store.writeDraft(f.project.id, "story", sample("story"));
    assert.throws(() => f.store.adopt(f.project.id, "story", 2), /草稿版本不存在/);
    assert.equal(f.store.load(f.project.id).stages.story.status, "pending_review");
    assert.equal(f.store.load(f.project.id).stages.script.status, "locked");
  } finally { f.cleanup(); }
});

test("采用同版本幂等；换版需确认，返工草稿保留当前采用关系", () => {
  const f = fixture(); try {
    f.store.writeDraft(f.project.id, "story", sample("story"));
    f.store.writeDraft(f.project.id, "story", sample("story"));
    f.store.adopt(f.project.id, "story", 1);
    f.store.adopt(f.project.id, "story", 1);
    assert.throws(() => f.store.adopt(f.project.id, "story", 2), /二次确认/);
    assert.equal(f.store.writeDraft(f.project.id, "story", sample("story")), 3);
    assert.equal(f.store.load(f.project.id).stages.story.adopted_version, 1);
    assert.equal(f.store.adopt(f.project.id, "story", 2, true).stages.story.adopted_version, 2);
  } finally { f.cleanup(); }
});

test("版本文件损坏时采用失败，不解锁下游", () => {
  const f = fixture(); try {
    f.store.writeDraft(f.project.id, "story", sample("story"));
    writeFileSync(f.store.artifactPath(f.project.id, "story", 1), "{}");
    assert.throws(() => f.store.adopt(f.project.id, "story", 1), /schema 不合规/);
    assert.equal(f.store.load(f.project.id).stages.script.status, "locked");
  } finally { f.cleanup(); }
});

test("项目 ID 不接受路径；版本不接受负数或小数", () => {
  const f = fixture(); try {
    for (const id of ["../escape", "/tmp/escape", "a/b", ""]) assert.throws(() => f.store.load(id), /ID 不合规/);
    for (const version of [0, -1, 1.5, NaN]) assert.throws(() => f.store.artifactPath(f.project.id, "story", version), /正整数/);
    assert.throws(() => f.store.load("missing"), /项目不存在/);
    assert.throws(() => f.store.create("  "), /标题不能为空/);
  } finally { f.cleanup(); }
});

test("多依赖阶段缺任一采用版本都拒绝，即使当前阶段已标 ready", () => {
  for (const [stage, dependencies] of [
    ["board", ["story", "script", "bible"]],
  ] as const) {
    for (const missing of dependencies) {
      const states = initialWorkflow();
      for (const dependency of dependencies) {
        states[dependency] = { status: "adopted", versions: [1], adopted_version: 1 };
      }
      states[stage].status = "ready";
      states[missing] = { status: "pending_review", versions: [1], adopted_version: null };
      assert.throws(() => assertRunnable(states, stage), new RegExp(`${missing} 尚未采用`));
      states[missing].status = "adopted";
      assert.throws(() => assertRunnable(states, stage), new RegExp(`${missing} 尚未采用`));
      states[missing].adopted_version = 1;
      assert.doesNotThrow(() => assertRunnable(states, stage));
    }
  }
});

test("采用后扫描所有 locked 阶段，全部依赖已采用才解锁", () => {
  // 单独构造依赖快照，验证解锁不依赖 STAGES 中相邻下标。
  const states = initialWorkflow();
  states.story = { status: "adopted", versions: [1], adopted_version: 1 };
  states.script = { status: "adopted", versions: [1], adopted_version: 1 };
  states.bible = { status: "pending_review", versions: [1], adopted_version: null };
  states.board = { status: "locked", versions: [], adopted_version: null };
  adoptDraft(states, "bible", 1);
  assert.equal(states.board.status, "ready");
  states.board.status = "locked";
  adoptDraft(states, "bible", 1);
  assert.equal(states.board.status, "ready", "重复采用也检查全部 locked 阶段");

  const incomplete = initialWorkflow();
  incomplete.story = { status: "pending_review", versions: [1], adopted_version: null };
  incomplete.bible = { status: "adopted", versions: [1], adopted_version: 1 };
  adoptDraft(incomplete, "story", 1);
  assert.equal(incomplete.script.status, "ready");
  assert.equal(incomplete.board.status, "locked");
  assert.equal(incomplete.board.status, "locked");
});

test("丢弃保留版本文件、禁止采用；全部审完回到 ready，审计记录本地决定", () => {
  const f = fixture(); try {
    f.store.writeDraft(f.project.id, "story", sample("story"));
    const file = f.store.artifactPath(f.project.id, "story", 1);
    const original = readFileSync(file, "utf8");
    const project = f.store.discard(f.project.id, "story", 1, "换个方向");
    assert.equal(project.stages.story.reviews?.[1].status, "discarded");
    assert.equal(project.stages.story.status, "ready");
    assert.equal(readFileSync(file, "utf8"), original);
    assert.throws(() => f.store.adopt(f.project.id, "story", 1), /discarded/);
    const audit = JSON.parse(readFileSync(join(f.store.projectDir(f.project.id), "audit.jsonl"), "utf8").trim());
    assert.equal(audit.actor, "local");
    assert.equal(audit.action, "discarded");
    assert.equal(audit.stage, "story");
    assert.equal(audit.version, 1);
    assert.equal(audit.note, "换个方向");
    assert.ok(Number.isFinite(Date.parse(audit.at)));
    assert.equal(f.store.writeDraft(f.project.id, "story", sample("story")), 2);
    assert.equal(f.store.load(f.project.id).stages.story.status, "pending_review");
  } finally { f.cleanup(); }
});

test("同 v2 格式 project.json 缺少审阅字段仍可读取、审阅；旧采用关系保持", () => {
  const f = fixture(); try {
    f.store.writeDraft(f.project.id, "story", sample("story"));
    const file = join(f.store.projectDir(f.project.id), "project.json");
    const legacy = f.store.load(f.project.id);
    for (const state of Object.values(legacy.stages)) delete state.reviews;
    writeFileSync(file, JSON.stringify(legacy));
    assert.equal(f.store.load(f.project.id).stages.story.reviews?.[1].status, "pending");
    f.store.adopt(f.project.id, "story", 1);
    const adopted = f.store.load(f.project.id);
    for (const state of Object.values(adopted.stages)) delete state.reviews;
    writeFileSync(file, JSON.stringify(adopted));
    assert.deepEqual(f.store.readAdopted(f.project.id, "story"), sample("story"));
    assert.equal(f.store.load(f.project.id).stages.story.reviews?.[1].status, "adopted");
    assert.throws(() => f.store.discard(f.project.id, "story", 1), /已采用/);
    f.store.requestChanges(f.project.id, "story", 1, "改");
    assert.equal(f.store.revisionContext(f.project.id, "story", 1).note, "改");
  } finally { f.cleanup(); }
});

test("要求修改必须有意见；只允许待审版本决定；无效决定不写审计不改状态", () => {
  const f = fixture(); try {
    for (let i = 0; i < 3; i++) f.store.writeDraft(f.project.id, "story", sample("story"));
    assert.throws(() => f.store.requestChanges(f.project.id, "story", 1, "  "), /不能为空/);
    assert.equal(existsSync(join(f.store.projectDir(f.project.id), "audit.jsonl")), false);
    f.store.requestChanges(f.project.id, "story", 1, "保留核心，改变结尾");
    assert.equal(f.store.load(f.project.id).stages.story.status, "pending_review");
    for (const version of [2, 3, 99]) assert.throws(() => f.store.revisionContext(f.project.id, "story", version), /changes_requested|不存在/);
    f.store.discard(f.project.id, "story", 2);
    assert.throws(() => f.store.revisionContext(f.project.id, "story", 2), /changes_requested/);
    const file = join(f.store.projectDir(f.project.id), "audit.jsonl");
    const before = readFileSync(file, "utf8");
    for (const operation of [() => f.store.discard(f.project.id, "story", 99), () => f.store.requestChanges(f.project.id, "story", 1, "再改"), () => f.store.adopt(f.project.id, "story", 2)]) assert.throws(operation);
    assert.equal(readFileSync(file, "utf8"), before);
    f.store.adopt(f.project.id, "story", 3);
    f.store.adopt(f.project.id, "story", 3);
    assert.equal(readFileSync(file, "utf8").trim().split("\n").length, 3, "重复采用保持幂等，不重复审计");
    assert.equal(f.store.revisionContext(f.project.id, "story", 1).note, "保留核心，改变结尾");
  } finally { f.cleanup(); }
});
