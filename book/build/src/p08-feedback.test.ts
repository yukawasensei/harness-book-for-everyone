import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { STAGES } from "./contracts/index.js";
import { assertRunnable, DEPENDENCIES, initialWorkflow } from "./workflow/index.js";
import { fixture, sample, packageRoot } from "./testing/fixtures.js";
import { createLocalServer } from "./server/index.js";
import { createDemoSession } from "./server/demo.js";
import { ScriptDraft } from "./agent/script-draft.js";
import { StoryboardDraft } from "./agent/storyboard-draft.js";
import { PromptDraft } from "./agent/prompt-draft.js";
import { readerMessage } from "../web/src/features/artifacts/lib/presentation.js";
import { appendEvent } from "../web/src/features/chat/lib/append-event.js";
import type { ProjectDetail } from "./server/protocol.js";

function complete(f: ReturnType<typeof fixture>) {
  for (const stage of STAGES) { f.store.writeDraft(f.project.id, stage, sample(stage)); f.store.adopt(f.project.id, stage, 1); }
}
function changed(f: ReturnType<typeof fixture>) {
  const bible = sample("bible"); bible.characters[0].appearance = bible.characters[0].appearance.replace("浅灰", "深灰");
  f.store.writeDraft(f.project.id, "bible", bible); f.store.adopt(f.project.id, "bible", 2, true);
}
test("每个依赖的 stale 禁用原因均与尚未采用区分，读取与重新拼装保持一致", () => {
  for (const stage of STAGES) for (const dependency of DEPENDENCIES[stage]) {
    const states = initialWorkflow(); states[stage].status = "ready";
    for (const d of DEPENDENCIES[stage]) states[d] = { status: "adopted", versions: [1], adopted_version: 1 };
    states[dependency].status = "stale";
    assert.throws(() => assertRunnable(states, stage), error => {
      const message = readerMessage((error as Error).message);
      assert.match(message, /上游.*待更新.*请先确认仍然有效或返工/); assert.ok(!message.includes("尚未采用")); return true;
    });
  }
  const f = fixture(); try {
    complete(f); changed(f);
    assert.throws(() => f.store.readAdopted(f.project.id, "storyboard"), /待更新/);
    assert.match(readerMessage(f.store.reassembleReason(f.project.id)!), /上游.*分镜.*待更新/);
  } finally { f.cleanup(); }
});
test("确认理由与程序拼装来源随版本持久化，影响条目返回实际名称和编号", async () => {
  const f = fixture(); try {
    complete(f); changed(f);
    assert.equal(f.store.bibleImpact(f.project.id).changes[0].name, "程禾");
    f.store.confirmValid(f.project.id, "storyboard", "仅衣服颜色变化，镜头不变", true);
    f.store.reassemblePrompts(f.project.id, true);
    const project = f.store.load(f.project.id);
    assert.equal(project.provenance?.storyboard?.[1].validity_confirmation?.reason, "仅衣服颜色变化，镜头不变");
    assert.equal(project.provenance?.prompts?.[2].generated_by, "reassemble");
    const { ProvenancePanel } = await import(new URL("../web/src/features/artifacts/components/ReworkPanel.tsx", import.meta.url).href);
    const html = renderToStaticMarkup(createElement(ProvenancePanel, { project: project as ProjectDetail, stage: "storyboard", version: 1 }));
    assert.match(html, /有效理由：仅衣服颜色变化，镜头不变/);
  } finally { f.cleanup(); }
});
test("程序拼装版本不显示假模型预设修改告知；影响清单显示名称加编号", async () => {
  const { ReviewPanel } = await import(new URL("../web/src/features/artifacts/components/ReviewPanel.tsx", import.meta.url).href);
  const props = { stage: "prompts" as const, state: { status: "stale" as const, versions: [1, 2], adopted_version: 1 }, version: 2,
    loaded: true, busy: false, demo: true, runReason: null, error: "", onReview: async () => true, onRevise: () => {} };
  const html = renderToStaticMarkup(createElement(ReviewPanel, { ...props, programAssembled: true }));
  assert.match(html, /由程序拼装，未调用模型/); assert.ok(!html.includes("离线演示的修改结果为预设内容"));
  assert.match(renderToStaticMarkup(createElement(ReviewPanel, props)), /离线演示的修改结果为预设内容/);
  const f = fixture(); try {
    complete(f); changed(f);
    const { ProvenancePanel } = await import(new URL("../web/src/features/artifacts/components/ReworkPanel.tsx", import.meta.url).href);
    const project = { ...f.store.load(f.project.id), bible_impact: f.store.bibleImpact(f.project.id) } as ProjectDetail;
    assert.match(renderToStaticMarkup(createElement(ProvenancePanel, { project, stage: "storyboard", version: 1 })), /程禾（C01）/);
  } finally { f.cleanup(); }
});
test("重启中断提示独立于当前阶段采用状态，包含阶段和运行时间", async () => {
  const { InterruptedRunNotice } = await import(new URL("../web/src/features/artifacts/components/ReworkPanel.tsx", import.meta.url).href);
  const run = { id: "orphan", stage: "script" as const, started_at: "2026-11-03T01:02:03.000Z", abort_requested: false, stop_reason: "interrupted", errors: [] };
  const html = renderToStaticMarkup(createElement(InterruptedRunNotice, { run }));
  assert.match(html, /上次运行被中断/); assert.match(html, /剧本/); assert.match(html, /dateTime="2026-11-03T01:02:03.000Z"/);
  assert.equal(renderToStaticMarkup(createElement(InterruptedRunNotice, { run: { ...run, stop_reason: "draft_written" } })), "");
});
test("全部采用后的运行提示为完成态；三种处理有各自说明和禁用原因", async () => {
  const { composerGuidance } = await import("../web/src/features/artifacts/lib/presentation.js");
  const { ReworkActions } = await import(new URL("../web/src/features/artifacts/components/ReworkPanel.tsx", import.meta.url).href);
  const f = fixture(); try {
    complete(f);
    for (const stage of STAGES) assert.match(composerGuidance(f.store.load(f.project.id), stage), /全流程已完成/);
    const html = renderToStaticMarkup(createElement(ReworkActions, { busy: false, runReason: "上游待更新", reassembleReason: "仅提示词支持", onRun: () => {}, onConfirmValid: () => {}, onReassemble: () => {} }));
    for (const text of ["返工运行", "确认仍然有效", "重新拼装", "生成新版本", "填写理由", "不调用模型", "上游待更新", "仅提示词支持"]) assert.ok(html.includes(text), text);
  } finally { f.cleanup(); }
});
test("离线续跑从下一场或下一镜开始：恢复提示先于模型事件，已暂存内容不重交", async () => {
  for (const stage of ["script", "storyboard", "prompts"] as const) {
    const f = fixture(); let app; const controller = new AbortController(); let pumping: Promise<void> | undefined;
    try {
      for (const upstream of STAGES.slice(0, STAGES.indexOf(stage))) { f.store.writeDraft(f.project.id, upstream, sample(upstream)); f.store.adopt(f.project.id, upstream, 1); }
      const id = f.project.id;
      if (stage === "script") { const d = new ScriptDraft(f.store, id); d.reset(); d.write({ ...sample("script").scenes[0], summary: "保留暂存场摘要" }); }
      if (stage === "storyboard") { const d = new StoryboardDraft(f.store, id); d.reset(); d.write({ scene_id: "S01", shots: sample("storyboard").shots.filter(s => s.scene_id === "S01") }); }
      if (stage === "prompts") { const d = new PromptDraft(f.store, id); d.reset(); d.write({ shot_id: "S01-01", shot_part: "程禾静静站在画面左侧，构图留白，保留暂存的镜头动作。" }); }
      f.store.saveRunLock(id, { id: "orphan", stage, started_at: "2026-11-03T01:02:03.000Z", abort_requested: false });
      app = createLocalServer({ root: packageRoot, store: f.store, demo: true, sessionFactory: createDemoSession });
      const base = await app.listen(0), path = `${base}/api/projects/${id}`;
      const detail = await (await fetch(path)).json() as ProjectDetail;
      assert.equal(detail.last_run?.stop_reason, "interrupted"); assert.equal(detail.last_run?.stage, stage);
      const response = await fetch(`${path}/events`, { signal: controller.signal });
      const reader = response.body!.getReader(), events: { type: string; args?: { scene?: { scene_id: string }; shot_id?: string }; ids?: string[] }[] = [];
      pumping = (async () => { const decoder = new TextDecoder(); let buffer = "";
        try { for (;;) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true });
          let end; while ((end = buffer.indexOf("\n\n")) >= 0) { const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
            const data = frame.split("\n").find(line => line.startsWith("data: ")); if (data) events.push(JSON.parse(data.slice(6)));
          }
        } } catch (error) { if (!controller.signal.aborted) throw error; }
      })();
      const run = await fetch(`${path}/stages/${stage}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staging: "resume" }) });
      assert.equal(run.status, 202);
      const deadline = Date.now() + 20000;
      while (!events.some(e => e.type === "run_ended") && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
      assert.ok(events.some(e => e.type === "run_ended"));
      const restored = events.findIndex(e => e.type === "staging_restored");
      assert.ok(restored >= 0 && restored < events.findIndex(e => e.type === "tool_execution_start"));
      assert.deepEqual(events[restored].ids, [stage === "prompts" ? "S01-01" : "S01"]);
      const rows = appendEvent([], { type: "staging_restored", stage, run_id: "resumed", ids: events[restored].ids!, unit: stage === "prompts" ? "镜" : "场" });
      assert.equal(rows[0].kind, "note");
      assert.ok("text" in rows[0] && rows[0].text === `已从暂存恢复 1 ${stage === "prompts" ? "镜：S01-01" : "场：S01"}`);
      const submitted = events.filter(e => e.type === "tool_execution_start" && (e.args?.scene || e.args?.shot_id)).map(e => e.args?.scene?.scene_id ?? e.args?.shot_id);
      assert.ok(!submitted.includes(stage === "prompts" ? "S01-01" : "S01"), JSON.stringify(submitted));
      assert.equal(f.store.load(id).stages[stage].versions.length, 1);
      if (stage === "script") assert.equal(f.store.readVersion(id, stage, 1).scenes[0].summary, "保留暂存场摘要");
      if (stage === "prompts") assert.match(f.store.readVersion(id, stage, 1).items[0].shot_part, /保留暂存/);
    } finally { controller.abort(); await pumping; if (app) await app.close(); f.cleanup(); }
  }
});
