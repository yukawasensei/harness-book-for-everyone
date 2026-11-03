import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readableError } from "../src/features/artifacts/lib/presentation.js";
import { ErrorDetails } from "../src/features/artifacts/components/ErrorDetails.js";
import { ArtifactPreview, formatSynopsisBeat } from "../src/features/artifacts/components/ArtifactPreview.js";
import { sample } from "../../src/testing/fixtures.js";

test("梗概拍已有起承转合前缀时不再重复添加", () => {
  assert.equal(formatSynopsisBeat("起：傍晚…", 0), "起：傍晚…");
  assert.equal(formatSynopsisBeat("承：争执…", 1), "承：争执…");
  assert.equal(formatSynopsisBeat("傍晚，空白格", 0), "起：傍晚，空白格");
  assert.equal(formatSynopsisBeat("转:旧写法", 2), "转:旧写法");
});

const raw = JSON.stringify({ content: [{ type: "text", text: "prompts schema 不合规：/shot_part must be string" }], details: {} });
test("运行错误从序列化工具结果中提取中文原因，兼容嵌套文字与旧版重复称呼", () => {
  assert.equal(readableError(raw), "镜头描述必须是文字");
  assert.equal(readableError(JSON.stringify({ message: raw })), "镜头描述必须是文字");
  assert.equal(readableError("S01-01 提到“陆岑”，该角色 陆岑 不在本镜角色引用中；请移除镜头外角色，或回到分镜修正引用"), "S01-01 “陆岑”不在本镜角色引用中；请移除该角色，或回到分镜修正引用");
  assert.ok(!readableError('{"unexpected":true}').includes("unexpected"));
});

test("过程错误逐条展示原因，原始结构只在每条技术详情中", () => {
  const html = renderToStaticMarkup(<ErrorDetails errors={[raw, "模型请求失败，请重试"]} />);
  assert.match(html, /查看过程错误（2）/);
  assert.match(html, /镜头描述必须是文字/);
  assert.match(html, /技术详情/);
  assert.equal((html.match(/<li[\s>]/g) ?? []).length, 2);
  assert.ok(html.includes("模型请求失败，请重试"));
});

test("六阶段产物均有技术详情，选题和梗概默认提供可读内容", () => {
  for (const stage of ["topic", "synopsis", "script", "bible", "storyboard", "prompts"] as const) {
    const html = renderToStaticMarkup(<ArtifactPreview stage={stage} value={sample(stage)} />);
    assert.ok(html.includes("技术详情"), stage);
    const rawData = html.indexOf("&quot;title&quot;");
    if (rawData >= 0) assert.ok(html.indexOf("技术详情") < rawData, stage);
    assert.ok(!html.startsWith("<pre>{"));
    if (stage === "topic" || stage === "synopsis") assert.ok(html.includes(sample(stage).title));
  }
});
