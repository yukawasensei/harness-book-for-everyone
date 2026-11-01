/**
 * Stub: draft_script — deterministic script.md from topic.json (or fixture topic).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertUnderOutDir, ensureParentDir } from "../path-sandbox.mjs";
import { createTraceSession } from "../trace.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(__dirname, "../..");

export const SKILL = "draft_script";
export const OUT_REL = "script.md";

function loadTopic() {
  const topicPath = resolve(labRoot, "workspace/out/topic.json");
  if (existsSync(topicPath)) {
    return JSON.parse(readFileSync(topicPath, "utf8"));
  }
  const brief = JSON.parse(readFileSync(resolve(labRoot, "fixtures/brief.json"), "utf8"));
  return {
    title: `选题：${brief.theme}`,
    hook: brief.theme,
    audience: brief.audience,
    duration_sec: brief.duration_sec,
  };
}

export function runDraftScript({ caseId = "stub-draft_script" } = {}) {
  const tracePath = resolve(labRoot, "traces", `${caseId}.jsonl`);
  const trace = createTraceSession({ skill: SKILL, caseId, tracePath });
  const topic = loadTopic();

  const md = `# 脚本 / Script

## 标题 / Title
${topic.title}

## 开场钩子 / Hook
${topic.hook}

## 受众 / Audience
${topic.audience}

## 时长 / Duration
${topic.duration_sec}s

## 正文结构 / Body
1. 痛点：桌面乱 → 注意力散
2. 三步整理法（清面 / 分区 / 定时回看）
3. 示范：45 秒内完成一次微整理
4. 收束：可复用 checklist

## 口播要点 / VO beats
- 不贩卖焦虑
- 每步可在镜头内完成
- 结尾 CTA 引导评论

<!-- schema_version: 1 -->
<!-- skill: draft_script -->
`;

  const { absolutePath, relativeFromOut } = assertUnderOutDir(labRoot, OUT_REL);
  ensureParentDir(absolutePath);
  writeFileSync(absolutePath, md, "utf8");
  trace.writeEvent({ path: `workspace/out/${relativeFromOut}`, bytes: Buffer.byteLength(md) });
  trace.end({ stop_reason: "success", out_path: `workspace/out/${relativeFromOut}` });

  return { outPath: absolutePath, relativePath: `workspace/out/${relativeFromOut}`, tracePath, stop_reason: "success" };
}

if (process.argv[1]?.endsWith("draft_script.mjs")) {
  const r = runDraftScript();
  console.log(`ok  ${SKILL} -> ${r.relativePath}`);
}
