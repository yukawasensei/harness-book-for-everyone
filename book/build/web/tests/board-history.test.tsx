import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { STAGES } from "../../src/contracts/index.js";
import { assembleBoard, boardInput } from "../../src/contracts/board.js";
import { fixture, sample } from "../../src/testing/fixtures.js";
import { createLocalServer } from "../../src/server/index.js";
import type { ProjectDetail } from "../../src/server/protocol.js";
import { api } from "../src/lib/api/index.js";
import { boardReferenceVersions, loadBoardReferences } from "../src/features/artifacts/lib/board-references.js";
import { BoardPreview } from "../src/features/artifacts/components/board/BoardPreview.js";

test("上游改名并采用后，旧分镜卡片保留原名，新分镜卡片显示新名", async t => {
  const f = fixture();
  t.after(() => f.cleanup());
  for (const stage of STAGES) { f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1); }
  const script = sample("script");
  script.scenes[0].heading = "外景·新渡口·清晨";
  for (const scene of script.scenes) for (const line of scene.lines) {
    if (line.kind === "dialogue" && line.character === "程禾") line.character = "程晓";
  }
  f.store.writeDraft(f.project.id, "script", script); f.store.adopt(f.project.id, "script", 2, true);
  const bible = sample("bible");
  bible.characters[0].name = "程晓";
  bible.locations[0].name = "新渡口";
  f.store.writeDraft(f.project.id, "bible", bible); f.store.adopt(f.project.id, "bible", 2, true);
  const input = boardInput(sample("board"));
  for (const shot of input.shots) if (shot.dialogue) shot.dialogue = shot.dialogue.replaceAll("程禾", "程晓");
  f.store.writeDraft(f.project.id, "board", assembleBoard(input, script, bible));
  const app = createLocalServer({ root: f.dir, store: f.store, sessionFactory: async () => { throw new Error("不可调用模型"); } });
  const base = await app.listen(0);
  t.after(() => app.close());
  const path = `${base}/api/projects/${f.project.id}`;
  const project = await api<ProjectDetail>(path);
  for (const [version, character, location, heading] of [
    [1, "程禾", sample("bible").locations[0].name, "外景·旧候船亭·傍晚"],
    [2, "程晓", "新渡口", "外景·新渡口·清晨"],
  ] as const) {
    const references = await loadBoardReferences(path, boardReferenceVersions(project, version));
    const html = renderToStaticMarkup(<BoardPreview board={f.store.readVersion(f.project.id, "board", version)} {...references} />);
    // 仅断言引用区与场次标题；镜头原文里可能仍出现角色旧名。
    assert.ok(html.includes(`font-medium text-foreground">${character}</span>`), `v${version} 角色名`);
    assert.ok(html.includes(`font-medium text-foreground">${location}</span>`), `v${version} 场景名`);
    assert.ok(html.includes(heading), `v${version} 场次标题`);
  }
});

test("人工确认有效后仍引用原始来源，缺少来源时不回退到当前采用版本", async () => {
  const f = fixture();
  try {
    for (const stage of STAGES) { f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1); }
    const script = sample("script"); script.scenes[0].heading = "外景·旧候船亭·夜晚";
    f.store.writeDraft(f.project.id, "script", script); f.store.adopt(f.project.id, "script", 2, true);
    f.store.writeDraft(f.project.id, "bible", sample("bible")); f.store.adopt(f.project.id, "bible", 2, true);
    f.store.confirmValid(f.project.id, "board", "镜头与提示词仍适用", true);
    const app = createLocalServer({ root: f.dir, store: f.store });
    const base = await app.listen(0);
    try {
      const path = `${base}/api/projects/${f.project.id}`;
      const project = await api<ProjectDetail>(path);
      const references = await loadBoardReferences(path, boardReferenceVersions(project, 1));
      assert.equal(references.script?.scenes[0].heading, "外景·旧候船亭·傍晚");
      assert.equal(project.provenance?.board?.[1].based_on.script, 2);
      delete project.provenance;
      assert.deepEqual(await loadBoardReferences(path, boardReferenceVersions(project, 1)), { bible: null, script: null });
    } finally { await app.close(); }
  } finally { f.cleanup(); }
});
