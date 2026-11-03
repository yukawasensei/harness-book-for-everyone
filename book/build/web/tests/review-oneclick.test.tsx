import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ADOPTED_REVISE_HINT,
} from "../src/features/artifacts/components/ReviewDialog.js";
import {
  ReviewPanel,
  submitRequestChangesAndRevise,
} from "../src/features/artifacts/components/ReviewPanel.js";
import {
  REQUEST_CHANGES_HINT,
  reviewDisableReasons,
} from "../src/features/artifacts/lib/review-copy.js";
import { initialWorkflow } from "../../src/workflow/index.js";

const here = dirname(fileURLToPath(import.meta.url));

test("按意见修改一键：先提交意见再启动生成；空意见不触发", async () => {
  const emptyCalls: string[] = [];
  assert.equal(await submitRequestChangesAndRevise("  ", async () => {
    emptyCalls.push("review");
    return true;
  }, () => { emptyCalls.push("revise"); }), false);
  assert.equal(emptyCalls.length, 0);

  const calls: string[] = [];
  assert.equal(await submitRequestChangesAndRevise("加一场夜戏", async (op, note) => {
    calls.push(`${op}:${note}`);
    return true;
  }, () => { calls.push("revise"); }), true);
  assert.deepEqual(calls, ["request-changes:加一场夜戏", "revise"]);
});

test("按意见修改一键：意见接口失败则不启动生成", async () => {
  const calls: string[] = [];
  assert.equal(await submitRequestChangesAndRevise("改结局", async () => {
    calls.push("review");
    return false;
  }, () => { calls.push("revise"); }), false);
  assert.deepEqual(calls, ["review"]);
});

test("要求修改文案：下方输入框、空意见与配额提示", () => {
  assert.ok(REQUEST_CHANGES_HINT.includes("下方输入框"));
  assert.ok(!REQUEST_CHANGES_HINT.includes("左侧对话框"));
  assert.equal(reviewDisableReasons.emptyNote, "请先填写具体的修改意见。");
  assert.equal(reviewDisableReasons.quota, "今日生成次数已用完，暂时无法发起按意见修改。");
  const dialog = readFileSync(join(here, "../src/features/artifacts/components/ReviewDialog.tsx"), "utf8");
  assert.ok(dialog.includes("reviewDisableReasons.emptyNote"));
  assert.ok(dialog.includes("!note.trim()"));
  assert.ok(dialog.includes("Boolean(reason)"));
});

test("已采用按意见修改：弹窗带下游待更新提醒，且一键提交即开跑", async () => {
  assert.ok(ADOPTED_REVISE_HINT.includes("待更新"));
  const dialog = readFileSync(join(here, "../src/features/artifacts/components/ReviewDialog.tsx"), "utf8");
  assert.ok(dialog.includes("showDownstreamHint"));
  assert.ok(dialog.includes("ADOPTED_REVISE_HINT"));
  const panel = readFileSync(join(here, "../src/features/artifacts/components/ReviewPanel.tsx"), "utf8");
  assert.ok(panel.includes("showDownstreamHint={current}"));
  const artifact = readFileSync(join(here, "../src/features/artifacts/components/ArtifactPanel.tsx"), "utf8");
  assert.ok(artifact.includes("onExecuteRun(version, undefined, true)"));
  assert.ok(!artifact.includes("onRevise={() => { if (version !== null) requestRun(version); }}"));

  const calls: string[] = [];
  assert.equal(await submitRequestChangesAndRevise("角色再年轻一点", async (op, note) => {
    calls.push(`${op}:${note}`);
    return true;
  }, () => { calls.push("revise"); }), true);
  assert.deepEqual(calls, ["request-changes:角色再年轻一点", "revise"]);
});

test("已要求修改时不再出现二次「按意见修改」入口，仍可点要求修改", () => {
  const state = initialWorkflow().story;
  state.versions = [1];
  state.reviews = { 1: { status: "changes_requested", at: new Date(2026, 10, 3, 0, 47).toISOString(), note: "加夜戏" } };
  state.status = "pending_review";
  const html = renderToStaticMarkup(
    <ReviewPanel
      stage="story" state={state} version={1} loaded busy={false} demo={false}
      runReason={null} error="" onReview={async () => true} onRevise={() => {}}
    />,
  );
  assert.ok(html.includes("要求修改"));
  assert.ok(html.includes("审阅意见"));
  assert.ok(html.includes("加夜戏"));
  assert.equal((html.match(/按意见修改/g) ?? []).length, 0);
});

test("配额用完时签字区提示第 80 行文案并禁用要求修改", () => {
  const state = initialWorkflow().story;
  state.versions = [1];
  state.status = "pending_review";
  const html = renderToStaticMarkup(
    <ReviewPanel
      stage="story" state={state} version={1} loaded busy={false} demo={false}
      runReason="今日配额已用完（429）" error="" onReview={async () => true} onRevise={() => {}}
    />,
  );
  assert.ok(html.includes(reviewDisableReasons.quota));
  assert.ok(html.includes("要求修改"));
});
