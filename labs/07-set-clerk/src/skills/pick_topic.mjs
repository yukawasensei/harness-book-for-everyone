/**
 * Stub: pick_topic — deterministic topic.json from brief fixture.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertUnderOutDir, ensureParentDir } from "../path-sandbox.mjs";
import { createTraceSession } from "../trace.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(__dirname, "../..");

export const SKILL = "pick_topic";
export const OUT_REL = "topic.json";

export function runPickTopic({
  fixturePath = resolve(labRoot, "fixtures/brief.json"),
  caseId = "stub-pick_topic",
} = {}) {
  const tracePath = resolve(labRoot, "traces", `${caseId}.jsonl`);
  const trace = createTraceSession({ skill: SKILL, caseId, tracePath });

  const brief = JSON.parse(readFileSync(fixturePath, "utf8"));
  const topic = {
    skill: SKILL,
    title: `选题：${brief.theme}`,
    hook: `用${brief.duration_sec}秒讲清「${brief.theme}」`,
    audience: brief.audience,
    duration_sec: brief.duration_sec,
    platforms: brief.platforms,
    angle: "可立刻动手的小习惯，不做鸡汤",
    cta: "评论区写下你的桌面现状",
    schema_version: 1,
  };

  const { absolutePath, relativeFromOut } = assertUnderOutDir(labRoot, OUT_REL);
  ensureParentDir(absolutePath);
  const body = JSON.stringify(topic, null, 2) + "\n";
  writeFileSync(absolutePath, body, "utf8");
  trace.writeEvent({ path: `workspace/out/${relativeFromOut}`, bytes: Buffer.byteLength(body) });
  trace.end({ stop_reason: "success", out_path: `workspace/out/${relativeFromOut}` });

  return { outPath: absolutePath, relativePath: `workspace/out/${relativeFromOut}`, topic, tracePath, stop_reason: "success" };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("pick_topic.mjs")) {
  const r = runPickTopic();
  console.log(`ok  ${SKILL} -> ${r.relativePath}`);
}
