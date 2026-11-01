/**
 * draft_board — stub by default; MODEL=ollama optional.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
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

export const SKILL = "draft_board";
export const OUT_REL = "board.json";
const REQUIRED = ["skill", "schema_version", "cast", "props", "scenes", "shots"];

export function buildStubBoard() {
  return {
    skill: SKILL,
    schema_version: 1,
    cast: [{ id: "host", role: "出镜主持人", note: "职场穿搭，语速平稳" }],
    props: [
      { id: "desk", name: "凌乱桌面道具", note: "文件/线材可见" },
      { id: "box", name: "收纳盒", note: "可入镜" },
    ],
    scenes: [{ id: "desk_top", name: "桌面俯拍区", lighting: "自然光+台灯" }],
    shots: [
      { id: "S1", scene: "desk_top", cast: ["host"], props: ["desk"], beat: "痛点展示", duration_sec: 8 },
      { id: "S2", scene: "desk_top", cast: ["host"], props: ["desk", "box"], beat: "三步法讲解", duration_sec: 20 },
      { id: "S3", scene: "desk_top", cast: ["host"], props: ["box"], beat: "示范整理", duration_sec: 12 },
      { id: "S4", scene: "desk_top", cast: ["host"], props: [], beat: "CTA", duration_sec: 5 },
    ],
  };
}

function loadScriptHint() {
  const p = resolve(labRoot, "workspace/out/script.md");
  if (existsSync(p)) return readFileSync(p, "utf8").slice(0, 1200);
  return "";
}

function normalizeBoard(raw) {
  const board = {
    skill: SKILL,
    schema_version: 1,
    cast: Array.isArray(raw.cast) ? raw.cast : [],
    props: Array.isArray(raw.props) ? raw.props : [],
    scenes: Array.isArray(raw.scenes) ? raw.scenes : [],
    shots: Array.isArray(raw.shots) ? raw.shots : [],
  };
  if (!hasRequiredFields(board, REQUIRED)) throw new Error("board missing required fields");
  if (board.shots.length < 3) throw new Error("board needs at least 3 shots");
  return board;
}

async function boardFromModel(trace) {
  const system =
    "You are a short-video storyboard planner. Reply with ONE JSON object only. " +
    "Keys: cast[], props[], scenes[], shots[] (each shot: id, scene, cast, props, beat, duration_sec). Min 3 shots.";
  const prompt = `Script excerpt:\n${loadScriptHint()}\n\nReturn board JSON for desk-cleanup short video. No brand names.`;
  return generateWithParse({
    prompt,
    system,
    trace,
    parse: (text) => normalizeBoard(parseJsonFromModelText(text)),
  });
}

export async function runDraftBoard({ caseId = "stub-draft_board", backend = getBackend() } = {}) {
  const tracePath = resolve(labRoot, "traces", `${caseId}.jsonl`);
  const trace = createTraceSession({ skill: SKILL, caseId, tracePath });

  let board = buildStubBoard();
  let source = "stub";

  if (backend === "ollama") {
    const result = await boardFromModel(trace);
    if (result.ok) {
      board = result.value;
      source = "ollama";
    } else {
      trace.emit({
        eventType: "degrade",
        reason: "model_parse_exhausted",
        fallback: "stub",
        error: result.error,
      });
      board = buildStubBoard();
      source = "stub_fallback";
    }
  }

  const { absolutePath, relativeFromOut } = assertUnderOutDir(labRoot, OUT_REL);
  ensureParentDir(absolutePath);
  const body = JSON.stringify(board, null, 2) + "\n";
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
    board,
    tracePath,
    stop_reason: "success",
    backend: source,
  };
}

if (process.argv[1]?.endsWith("draft_board.mjs")) {
  const r = await runDraftBoard();
  console.log(`ok  ${SKILL} -> ${r.relativePath} backend=${r.backend}`);
}
