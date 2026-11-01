/**
 * pick_topic — stub by default; MODEL=ollama uses local qwen via model-adapter.
 * Eval stubs (schema/path/Trace) stay the contract either way.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertUnderOutDir, ensureParentDir } from "../path-sandbox.mjs";
import { createTraceSession } from "../trace.mjs";
import {
  generateWithParse,
  getBackend,
  hasRequiredFields,
  parseJsonFromModelText,
} from "../model-adapter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(__dirname, "../..");

export const SKILL = "pick_topic";
export const OUT_REL = "topic.json";
const REQUIRED = ["skill", "title", "hook", "audience", "duration_sec", "platforms", "schema_version"];

function loadBrief(fixturePath) {
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}

export function buildStubTopic(brief) {
  return {
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
}

function normalizeTopic(raw, brief) {
  const topic = {
    skill: SKILL,
    title: String(raw.title || `选题：${brief.theme}`),
    hook: String(raw.hook || brief.theme),
    audience: raw.audience || brief.audience,
    duration_sec: Number(raw.duration_sec || brief.duration_sec),
    platforms: Array.isArray(raw.platforms) ? raw.platforms : brief.platforms,
    angle: raw.angle || "可立刻动手的小习惯，不做鸡汤",
    cta: raw.cta || "评论区写下你的桌面现状",
    schema_version: 1,
  };
  if (!hasRequiredFields(topic, REQUIRED)) {
    throw new Error("topic missing required fields after normalize");
  }
  return topic;
}

async function topicFromModel(brief, trace) {
  const system =
    "You are a short-video topic planner. Reply with ONE JSON object only, no prose. " +
    "Keys: title, hook, audience, duration_sec, platforms (array), angle, cta. Chinese OK.";
  const prompt = `Brief:\n${JSON.stringify(brief, null, 2)}\n\nReturn JSON for a Douyin/Xiaohongshu/Channels topic.`;
  return generateWithParse({
    prompt,
    system,
    trace,
    parse: (text) => normalizeTopic(parseJsonFromModelText(text), brief),
  });
}

export async function runPickTopic({
  fixturePath = resolve(labRoot, "fixtures/brief.json"),
  caseId = "stub-pick_topic",
  backend = getBackend(),
} = {}) {
  const tracePath = resolve(labRoot, "traces", `${caseId}.jsonl`);
  const trace = createTraceSession({ skill: SKILL, caseId, tracePath });
  const brief = loadBrief(fixturePath);

  let topic = buildStubTopic(brief);
  let source = "stub";

  if (backend === "ollama") {
    const result = await topicFromModel(brief, trace);
    if (result.ok) {
      topic = result.value;
      source = "ollama";
    } else {
      trace.emit({
        eventType: "degrade",
        reason: "model_parse_exhausted",
        fallback: "stub",
        error: result.error,
      });
      topic = buildStubTopic(brief);
      source = "stub_fallback";
    }
  }

  const { absolutePath, relativeFromOut } = assertUnderOutDir(labRoot, OUT_REL);
  ensureParentDir(absolutePath);
  const body = JSON.stringify(topic, null, 2) + "\n";
  writeFileSync(absolutePath, body, "utf8");
  trace.writeEvent({ path: `workspace/out/${relativeFromOut}`, bytes: Buffer.byteLength(body) });
  trace.end({
    stop_reason: "success",
    out_path: `workspace/out/${relativeFromOut}`,
    backend: source,
  });

  return {
    outPath: absolutePath,
    relativePath: `workspace/out/${relativeFromOut}`,
    topic,
    tracePath,
    stop_reason: "success",
    backend: source,
  };
}

if (process.argv[1]?.endsWith("pick_topic.mjs")) {
  const r = await runPickTopic();
  console.log(`ok  ${SKILL} -> ${r.relativePath} backend=${r.backend}`);
}
