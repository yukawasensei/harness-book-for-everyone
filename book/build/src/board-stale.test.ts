import assert from "node:assert/strict";
import { test } from "node:test";
import { STAGES } from "./contracts/index.js";
import { assembleBoard, boardInput } from "./contracts/board.js";
import { ProjectStore } from "./project/store.js";
import { createLocalServer } from "./server/index.js";
import type { ProjectDetail } from "./server/protocol.js";
import { fixture, packageRoot, sample } from "./testing/fixtures.js";

test("未采用的最新分镜板随设定换版待更新，可零模型重拼装并等待采用", async () => {
  const f = fixture();
  let modelCalls = 0;
  const app = createLocalServer({ root: packageRoot, store: f.store, sessionFactory: async () => {
    modelCalls++;
    throw new Error("重新拼装不应创建模型会话");
  } });
  try {
    const id = f.project.id;
    for (const stage of STAGES.slice(0, -1)) {
      f.store.writeDraft(id, stage, sample(stage));
      f.store.adopt(id, stage, 1);
    }
    f.store.writeDraft(id, "board", sample("board"));
    const input = boardInput(sample("board"));
    input.shots[0].shot_part += "镜头缓慢移向桌角。";
    const latest = assembleBoard(input, sample("script"), sample("bible"));
    f.store.writeDraft(id, "board", latest);
    assert.equal(f.store.load(id).stages.board.status, "pending_review");
    const bible = sample("bible");
    bible.characters[0].appearance = bible.characters[0].appearance.replace("浅灰", "深灰");
    f.store.writeDraft(id, "bible", bible);

    const base = await app.listen(0), path = `${base}/api/projects/${id}`;
    const post = (stage: string, operation: string, body: unknown) => fetch(`${path}/stages/${stage}/${operation}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const detail = async () => {
      const response = await fetch(path);
      assert.equal(response.status, 200);
      return await response.json() as ProjectDetail;
    };
    assert.equal((await post("bible", "adopt", { version: 2, confirmed: true })).status, 200);
    let project = await detail();
    assert.equal(project.stages.board.status, "stale");
    assert.equal(project.stages.board.adopted_version, null);
    assert.equal(project.stages.board.reviews?.[2].status, "pending");
    assert.equal(project.reassemble_reason, null);
    assert.deepEqual(project.bible_impact, {
      unknown: false, from: 1, to: 2, changes: [{ id: "C01", name: "程禾", fields: ["appearance"] }],
      shots: latest.shots.filter(s => s.character_ids.includes("C01")).map(s => s.shot_id),
    });
    assert.equal(new ProjectStore(f.dir).load(id).stages.board.status, "stale");
    assert.equal((await post("board", "reassemble", {})).status, 422);
    assert.deepEqual(f.store.load(id).stages.board.versions, [1, 2]);
    assert.equal((await post("board", "reassemble", { confirmed: true })).status, 200);
    project = await detail();
    assert.equal(project.stages.board.status, "pending_review");
    assert.equal(project.stages.board.adopted_version, null);
    assert.equal(project.stages.board.reviews?.[3].status, "pending");
    assert.deepEqual(project.provenance?.board?.[3].based_on, { story: 1, script: 1, bible: 2 });
    assert.equal(project.provenance?.board?.[3].generated_by, "reassemble");
    assert.equal(project.provenance?.board?.[3].reassembled_from, 2);
    assert.equal(project.bible_impact?.from, 2);
    assert.deepEqual(project.bible_impact?.changes, []);
    const next = f.store.readVersion(id, "board", 3);
    assert.deepEqual(next.shots.map(s => s.shot_part), latest.shots.map(s => s.shot_part));
    for (const shot of next.shots.filter(s => s.character_ids.includes("C01"))) {
      assert.ok(shot.final_prompt.includes(bible.characters[0].appearance));
    }
    assert.deepEqual(f.store.readVersion(id, "board", 2), latest);
    assert.equal(modelCalls, 0);
    assert.equal(project.last_run, null);
    assert.equal((await post("board", "adopt", { version: 3 })).status, 200);
    assert.equal((await detail()).stages.board.status, "adopted");
  } finally { await app.close(); f.cleanup(); }
});

test("待更新旧稿的审阅不清除失效；仍可直接采用，设定回切后恢复", () => {
  for (const requestChanges of [false, true]) {
    const f = fixture();
    try {
      const id = f.project.id;
      for (const stage of STAGES) {
        f.store.writeDraft(id, stage, sample(stage));
        if (stage !== "board") f.store.adopt(id, stage, 1);
      }
      const bible = sample("bible");
      bible.characters[0].appearance = bible.characters[0].appearance.replace("浅灰", "深灰");
      f.store.writeDraft(id, "bible", bible);
      f.store.adopt(id, "bible", 2, true);
      f.store.adopt(id, "bible", 1, true);
      assert.equal(f.store.load(id).stages.board.status, "pending_review");
      f.store.adopt(id, "bible", 2, true);
      if (requestChanges) f.store.requestChanges(id, "board", 1, "请保留原镜头并更新外观");
      assert.equal(f.store.load(id).stages.board.status, "stale");
      assert.equal(f.store.reassembleReason(id), null);
      f.store.adopt(id, "board", 1);
      assert.equal(f.store.load(id).stages.board.adopted_version, 1);
      assert.equal(f.store.load(id).stages.board.status, "stale");
      f.store.adopt(id, "bible", 1, true);
      assert.equal(f.store.load(id).stages.board.status, "adopted");
    } finally { f.cleanup(); }
  }
});

test("已采用稿仍有效时也检查最新稿，重拼装最新稿后清除其失效", () => {
  const f = fixture();
  try {
    const id = f.project.id;
    for (const stage of STAGES) {
      f.store.writeDraft(id, stage, sample(stage));
      f.store.adopt(id, stage, 1);
    }
    const bible = sample("bible");
    bible.characters[0].appearance = bible.characters[0].appearance.replace("浅灰", "深灰");
    f.store.writeDraft(id, "bible", bible);
    f.store.adopt(id, "bible", 2, true);
    const input = boardInput(sample("board"));
    input.shots[0].shot_part += "镜头缓慢移向桌角。";
    const latest = assembleBoard(input, sample("script"), bible);
    f.store.writeDraft(id, "board", latest);
    f.store.adopt(id, "bible", 1, true);
    assert.equal(f.store.load(id).stages.board.status, "stale");
    assert.equal(f.store.bibleImpact(id).from, 2);
    assert.equal(f.store.bibleImpact(id).to, 1);
    assert.equal(f.store.reassembleReason(id), null);
    const version = f.store.reassembleBoard(id, true);
    const project = f.store.load(id);
    assert.equal(project.stages.board.status, "adopted");
    assert.equal(project.stages.board.adopted_version, 1);
    assert.equal(project.stages.board.reviews?.[version].status, "pending");
    assert.equal(project.provenance?.board?.[version].reassembled_from, 2);
    assert.deepEqual(f.store.readVersion(id, "board", version).shots.map(s => s.shot_part), latest.shots.map(s => s.shot_part));
  } finally { f.cleanup(); }
});
