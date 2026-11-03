import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { main } from "./cli.js";
import { fixture, sample } from "./testing/fixtures.js";

test("CLI 离线 new/status/adopt，可选较早版本", async () => {
  const f = fixture(); const lines: string[] = [], original = console.log;
  console.log = (...args) => { lines.push(args.join(" ")); };
  try {
    await main(["new", "示例"], f.dir);
    const id = readdirSync(f.store.root).find(id => id !== f.project.id)!;
    assert.ok(id);
    lines.length = 0;
    await main(["status", id], f.dir);
    assert.deepEqual(lines.slice(1).map(line => line.split(':')[0]), ['story', 'script', 'bible', 'board']);
    assert.match(lines.join("\n"), /story: ready/);
    assert.match(lines.join("\n"), /script: locked/);
    f.store.writeDraft(id, "story", sample("story"));
    await main(["adopt", id, "story", "1"], f.dir);
    f.store.writeDraft(id, "story", sample("story"));
    await assert.rejects(() => main(["adopt", id, "story", "2"], f.dir), /二次确认/);
    await main(["adopt", id, "story", "2", "--confirm"], f.dir);
    assert.equal(f.store.load(id).stages.story.adopted_version, 2);
    lines.length = 0;
    await main(["status", id], f.dir);
    assert.match(lines.join("\n"), /story: adopted/);
    assert.match(lines.join("\n"), /script: ready/);
  } finally { console.log = original; f.cleanup(); }
});

test("CLI 错误参数不被静默忽略，版本参数必须完整合法", async () => {
  const f = fixture(); try {
    for (const args of [[], ["new"], ["status"], ["run", f.project.id], ["new", "x", "extra"]]) {
      await assert.rejects(() => main(args, f.dir), /用法/);
    }
    for (const version of ["1oops", "1.5", "0", "-1"]) {
      await assert.rejects(() => main(["adopt", f.project.id, "story", version], f.dir), /正整数/);
    }
    await assert.rejects(() => main(["run", f.project.id, "unexpected"], f.dir), /未知阶段/);
    for (const legacy of ['topic', 'synopsis', 'storyboard', 'prompts']) {
      await assert.rejects(() => main(["run", f.project.id, legacy], f.dir), /未知阶段/);
      await assert.rejects(() => main(["adopt", f.project.id, legacy, "1"], f.dir), /未知阶段/);
    }
    await assert.rejects(() => main(["run", f.project.id, "script"], f.dir), /story 尚未采用/);
    await assert.rejects(() => main(["run", f.project.id, "story", "--resume", "--restart"], f.dir), /其中一种/);
    await assert.rejects(() => main(["adopt", f.project.id, "story", "1", "--resume"], f.dir), /用法/);
  } finally { f.cleanup(); }
});
