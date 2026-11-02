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
    await main(["status", id], f.dir);
    assert.match(lines.join("\n"), /topic: ready/);
    assert.match(lines.join("\n"), /synopsis: locked/);
    f.store.writeDraft(id, "topic", sample("topic"));
    await main(["adopt", id, "topic", "1"], f.dir);
    lines.length = 0;
    await main(["status", id], f.dir);
    assert.match(lines.join("\n"), /topic: adopted/);
    assert.match(lines.join("\n"), /synopsis: ready/);
  } finally { console.log = original; f.cleanup(); }
});

test("CLI 错误参数不被静默忽略，版本参数必须完整合法", async () => {
  const f = fixture(); try {
    for (const args of [[], ["new"], ["status"], ["run", f.project.id], ["new", "x", "extra"]]) {
      await assert.rejects(() => main(args, f.dir), /用法/);
    }
    for (const version of ["1oops", "1.5", "0", "-1"]) {
      await assert.rejects(() => main(["adopt", f.project.id, "topic", version], f.dir), /正整数/);
    }
    await assert.rejects(() => main(["run", f.project.id, "unexpected"], f.dir), /未知阶段/);
    await assert.rejects(() => main(["run", f.project.id, "synopsis"], f.dir), /topic 尚未采用/);
  } finally { f.cleanup(); }
});
