import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatLocalDateTime } from "../src/lib/format/date-time.js";
import { ReviewPanel } from "../src/features/artifacts/components/ReviewPanel.js";
import { initialWorkflow } from "../../src/workflow/index.js";

test("中文时间固定为年月日与24小时分钟，午夜不显示AM或24点", () => {
  for (const [date, expected] of [
    [new Date(2026, 10, 3, 0, 47), "2026年11月3日 00:47"],
    [new Date(2026, 0, 2, 0, 0), "2026年1月2日 00:00"],
    [new Date(2024, 1, 29, 13, 5), "2024年2月29日 13:05"],
  ] as const) {
    assert.equal(formatLocalDateTime(date), expected);
    assert.equal(formatLocalDateTime(date.toISOString()), expected);
    assert.equal(formatLocalDateTime(date.getTime()), expected);
  }
  for (const value of [null, undefined, "", "无效日期", new Date(NaN)]) assert.equal(formatLocalDateTime(value), "时间未知");
});

test("审计与运行的ISO时间按使用者本地时区显示，不固定服务器时区", () => {
  const source = "import { formatLocalDateTime } from './web/src/lib/format/date-time.ts'; console.log(formatLocalDateTime('2026-11-02T16:47:00.000Z'));";
  for (const [zone, expected] of [["Asia/Taipei", "2026年11月3日 00:47"], ["UTC", "2026年11月2日 16:47"]]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", source], { env: { TZ: zone }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), expected);
  }
});

test("审阅记录用统一中文时间，保留原始时间戳供机器读取", () => {
  const date = new Date(2026, 10, 3, 0, 47), state = initialWorkflow().topic;
  state.versions = [1]; state.reviews = { 1: { status: "adopted", at: date.toISOString() } }; state.adopted_version = 1; state.status = "adopted";
  const html = renderToStaticMarkup(<ReviewPanel stage="topic" state={state} version={1} loaded busy={false} demo={false} runReason={null} error="" onReview={async () => true} onRevise={() => {}} />);
  assert.ok(html.includes("2026年11月3日 00:47"));
  assert.ok(html.includes(`dateTime="${date.toISOString()}"`));
  assert.ok(!/AM|PM|11\/3\/2026/.test(html));
});

test("运行记录保留服务端真实开始时间，展示时使用同一格式化函数", async () => {
  const { appendEvent } = await import("../src/features/chat/lib/append-event.js");
  const started = new Date(2026, 10, 3, 0, 47).toISOString();
  const rows = appendEvent([], { type: "run_started", run: { id: "time-test", stage: "topic", started_at: started, abort_requested: false } });
  assert.equal(rows[0].kind, "note");
  if (rows[0].kind === "tool") assert.fail("运行开始应为记录");
  assert.equal(rows[0].at, started);
  assert.equal(formatLocalDateTime(rows[0].at), "2026年11月3日 00:47");
});
