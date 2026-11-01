/**
 * draft_script — stub by default; MODEL=ollama optional.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertUnderOutDir, ensureParentDir } from "../path-sandbox.mjs";
import { createTraceSession } from "../trace.mjs";
import { getBackend, ollamaConfig, ollamaGenerate } from "../model-adapter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(__dirname, "../..");

export const SKILL = "draft_script";
export const OUT_REL = "script.md";

const REQUIRED_MARKERS = ["# 脚本", "## 标题", "## 开场钩子", "## 正文结构", "skill: draft_script"];

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

export function buildStubScript(topic) {
  return `# 脚本 / Script

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
}

function assertScriptMarkers(md) {
  for (const m of REQUIRED_MARKERS) {
    if (!md.includes(m)) throw new Error(`script missing marker: ${m}`);
  }
  return md;
}

function ensureScriptShape(md, topic) {
  let text = md.trim();
  if (!text.includes("# 脚本")) text = `# 脚本 / Script\n\n${text}`;
  if (!text.includes("## 标题")) text += `\n\n## 标题 / Title\n${topic.title}\n`;
  if (!text.includes("## 开场钩子")) text += `\n## 开场钩子 / Hook\n${topic.hook}\n`;
  if (!text.includes("## 正文结构")) text += `\n## 正文结构 / Body\n1. 要点一\n2. 要点二\n`;
  if (!text.includes("skill: draft_script")) {
    text += `\n\n<!-- schema_version: 1 -->\n<!-- skill: draft_script -->\n`;
  }
  return assertScriptMarkers(text);
}

async function scriptFromModel(topic, trace) {
  const system =
    "You write short-video scripts. Return markdown only. Must include headings: " +
    "# 脚本, ## 标题, ## 开场钩子, ## 正文结构, and HTML comment <!-- skill: draft_script -->.";
  const prompt = `Topic JSON:\n${JSON.stringify(topic, null, 2)}\n\nWrite the script markdown.`;
  const cfg = ollamaConfig();
  let lastError = null;
  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    trace?.emit?.({ eventType: "model_call", backend: "ollama", model: cfg.model, attempt });
    try {
      const { text } = await ollamaGenerate({ prompt, system });
      const value = ensureScriptShape(text, topic);
      trace?.emit?.({
        eventType: "model_parse_ok",
        backend: "ollama",
        model: cfg.model,
        attempt,
        chars: text.length,
      });
      return { ok: true, value, model: cfg.model, attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      trace?.emit?.({
        eventType: "model_parse_fail",
        backend: "ollama",
        model: cfg.model,
        attempt,
        error: lastError,
      });
    }
  }
  return { ok: false, error: lastError, model: cfg.model };
}

export async function runDraftScript({ caseId = "stub-draft_script", backend = getBackend() } = {}) {
  const tracePath = resolve(labRoot, "traces", `${caseId}.jsonl`);
  const trace = createTraceSession({ skill: SKILL, caseId, tracePath });
  const topic = loadTopic();

  let md = buildStubScript(topic);
  let source = "stub";

  if (backend === "ollama") {
    const result = await scriptFromModel(topic, trace);
    if (result.ok) {
      md = result.value;
      source = "ollama";
    } else {
      trace.emit({
        eventType: "degrade",
        reason: "model_parse_exhausted",
        fallback: "stub",
        error: result.error,
      });
      md = buildStubScript(topic);
      source = "stub_fallback";
    }
  }

  const { absolutePath, relativeFromOut } = assertUnderOutDir(labRoot, OUT_REL);
  ensureParentDir(absolutePath);
  writeFileSync(absolutePath, md, "utf8");
  trace.writeEvent({ path: `workspace/out/${relativeFromOut}`, bytes: Buffer.byteLength(md) });
  trace.end({
    stop_reason: "success",
    out_path: `workspace/out/${relativeFromOut}`,
    backend: source,
  });

  return {
    outPath: absolutePath,
    relativePath: `workspace/out/${relativeFromOut}`,
    tracePath,
    stop_reason: "success",
    backend: source,
  };
}

if (process.argv[1]?.endsWith("draft_script.mjs")) {
  const r = await runDraftScript();
  console.log(`ok  ${SKILL} -> ${r.relativePath} backend=${r.backend}`);
}
