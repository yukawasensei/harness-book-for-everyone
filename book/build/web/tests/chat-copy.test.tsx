import assert from "node:assert/strict";
import { test } from "node:test";
import { cloneElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  countSubmissionItems,
  SELF_CORRECTION_TITLE,
  selfCorrectionDetail,
  submissionSummary,
} from "../src/features/artifacts/lib/presentation.js";
import { RunStatusBar } from "../src/features/chat/components/RunStatusBar.js";
import { SelfCorrectionCard } from "../src/features/chat/components/SelfCorrectionCard.js";
import { foldSelfCorrectionTranscript } from "../src/features/chat/lib/self-correction.js";
import { sample } from "../../src/testing/fixtures.js";

test("交稿摘要：剧本数场、分镜板数镜头", () => {
  const script = sample("script");
  const board = sample("board");
  assert.equal(countSubmissionItems("script", script), script.scenes.length);
  assert.equal(countSubmissionItems("board", board), board.shots.length);
  assert.equal(countSubmissionItems("story", sample("story")), undefined);
  assert.match(submissionSummary("script", 1, script.scenes.length), /共 3 场/);
  assert.match(submissionSummary("board", 2, board.shots.length), /共 6 个镜头/);
});

test("运行中状态文案为正在编写{工序名}", () => {
  const html = renderToStaticMarkup(<RunStatusBar stage="story" onAbort={() => {}} />);
  assert.match(html, /正在编写故事…/);
  assert.ok(!html.includes("正在写故事"));
  assert.match(html, /中断/);
});

test("自我修正折叠卡外露标题与展开详情句式", () => {
  const collapsed = renderToStaticMarkup(
    <SelfCorrectionCard reason="缺少第 4 幕结局走向">
      <span>工具卡占位</span>
    </SelfCorrectionCard>,
  );
  assert.ok(collapsed.includes(SELF_CORRECTION_TITLE));
  assert.match(collapsed, /aria-expanded="false"/);
  assert.ok(!collapsed.includes("缺少第 4 幕结局走向"));

  function Expanded() {
    const element = SelfCorrectionCard({ reason: "缺少第 4 幕结局走向", children: <span>工具卡占位</span> });
    assert.ok(element);
    return cloneElement(element, { open: true });
  }
  const html = renderToStaticMarkup(<Expanded />);
  assert.match(html, /aria-expanded="true"/);
  assert.equal(
    selfCorrectionDetail("缺少第 4 幕结局走向"),
    "第 1 次提交因「缺少第 4 幕结局走向」被系统拦下；助手已按规则修正并完成第 2 次提交。",
  );
  assert.ok(html.includes(selfCorrectionDetail("缺少第 4 幕结局走向")));
  assert.ok(html.includes("工具卡占位"));
});

test("transcript 首次草稿失败后成功时收进自我修正段", () => {
  const segments = foldSelfCorrectionTranscript([
    { type: "text", text: "开场" },
    { type: "tool", name: "write_draft", ok: false, error: "缺少第 4 幕结局走向" },
    { type: "text", text: "我补齐后再交" },
    { type: "tool", name: "write_draft", ok: true },
    { type: "text", text: "请审阅" },
  ]);
  assert.equal(segments.length, 3);
  assert.equal(segments[0].kind, "plain");
  assert.equal(segments[1].kind, "self_correction");
  if (segments[1].kind === "self_correction") {
    assert.match(segments[1].reason, /缺少第 4 幕结局走向/);
    assert.equal(segments[1].items.length, 3);
  }
  assert.equal(segments[2].kind, "plain");
});

test("transcript 分镜板同场多次失败后成功时按场收进自我修正段", () => {
  const s01 = JSON.stringify({ scene: { scene_id: "S01", shots: [] } });
  const s02 = JSON.stringify({ scene: { scene_id: "S02", shots: [] } });
  const segments = foldSelfCorrectionTranscript([
    { type: "tool", name: "write_scene_shots", args_summary: s01, ok: false, error: "引用了未出场角色" },
    { type: "text", text: "我改掉错误引用" },
    { type: "tool", name: "write_scene_shots", args_summary: s01, ok: false, error: "引用了未出场角色" },
    { type: "tool", name: "write_scene_shots", args_summary: s01, ok: true },
    { type: "tool", name: "write_scene_shots", args_summary: s02, ok: false, error: "道具编号不存在" },
    { type: "tool", name: "write_scene_shots", args_summary: s02, ok: true },
  ]);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].kind, "self_correction");
  assert.equal(segments[1].kind, "self_correction");
  if (segments[0].kind === "self_correction") {
    assert.match(segments[0].reason, /引用了未出场角色/);
    assert.equal(segments[0].items.length, 4);
  }
  if (segments[1].kind === "self_correction") {
    assert.match(segments[1].reason, /道具编号不存在/);
    assert.equal(segments[1].items.length, 2);
  }
});
