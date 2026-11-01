/**
 * shot_prompts — stub by default; MODEL=ollama optional.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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

export const SKILL = "shot_prompts";
export const OUT_REL = "prompts.json";
const REQUIRED = ["skill", "schema_version", "items"];

function loadBoard() {
  const p = resolve(labRoot, "workspace/out/board.json");
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  return {
    shots: [
      { id: "S1", beat: "痛点展示", duration_sec: 8 },
      { id: "S2", beat: "三步法讲解", duration_sec: 20 },
    ],
    scenes: [{ id: "desk_top", name: "桌面俯拍区" }],
    cast: [{ id: "host", role: "出镜主持人" }],
  };
}

export function buildStubPrompts(board) {
  return {
    skill: SKILL,
    schema_version: 1,
    items: (board.shots || []).map((shot) => ({
      shot_id: shot.id,
      duration_sec: shot.duration_sec,
      prompt: `短视频镜头 ${shot.id}：${shot.beat}；场景桌面俯拍；角色主持人出镜；画质清晰、无品牌水印、无真实平台 UI。时长约 ${shot.duration_sec}s。`,
    })),
  };
}

function normalizePrompts(raw, board) {
  let items = Array.isArray(raw.items) ? raw.items : Array.isArray(raw) ? raw : null;
  if (!items) throw new Error("prompts missing items[]");
  items = items.map((it, i) => ({
    shot_id: String(it.shot_id || board.shots?.[i]?.id || `S${i + 1}`),
    duration_sec: Number(it.duration_sec || board.shots?.[i]?.duration_sec || 8),
    prompt: String(it.prompt || ""),
  }));
  for (const it of items) {
    if (!it.prompt) throw new Error(`prompt empty for ${it.shot_id}`);
    if (!("shot_id" in it) || !("duration_sec" in it) || !("prompt" in it)) {
      throw new Error("prompt item missing fields");
    }
  }
  if (items.length < 2) throw new Error("need at least 2 prompt items");
  const out = { skill: SKILL, schema_version: 1, items };
  if (!hasRequiredFields(out, REQUIRED)) throw new Error("prompts missing required fields");
  return out;
}

async function promptsFromModel(board, trace) {
  const system =
    "You write per-shot video generation prompts. Reply with ONE JSON object: " +
    '{ "items": [ { "shot_id", "duration_sec", "prompt" } ] }. No brand UI, no real platform chrome.';
  const prompt = `Board:\n${JSON.stringify(board, null, 2)}\n\nReturn prompts JSON with one item per shot.`;
  return generateWithParse({
    prompt,
    system,
    trace,
    parse: (text) => normalizePrompts(parseJsonFromModelText(text), board),
  });
}

export async function runShotPrompts({ caseId = "stub-shot_prompts", backend = getBackend() } = {}) {
  const tracePath = resolve(labRoot, "traces", `${caseId}.jsonl`);
  const trace = createTraceSession({ skill: SKILL, caseId, tracePath });
  const board = loadBoard();

  let prompts = buildStubPrompts(board);
  let source = "stub";

  if (backend === "ollama") {
    const result = await promptsFromModel(board, trace);
    if (result.ok) {
      prompts = result.value;
      source = "ollama";
    } else {
      trace.emit({
        eventType: "degrade",
        reason: "model_parse_exhausted",
        fallback: "stub",
        error: result.error,
      });
      prompts = buildStubPrompts(board);
      source = "stub_fallback";
    }
  }

  const { absolutePath, relativeFromOut } = assertUnderOutDir(labRoot, OUT_REL);
  ensureParentDir(absolutePath);
  const body = JSON.stringify(prompts, null, 2) + "\n";
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
    prompts,
    tracePath,
    stop_reason: "success",
    backend: source,
  };
}

if (process.argv[1]?.endsWith("shot_prompts.mjs")) {
  const r = await runShotPrompts();
  console.log(`ok  ${SKILL} -> ${r.relativePath} backend=${r.backend}`);
}
