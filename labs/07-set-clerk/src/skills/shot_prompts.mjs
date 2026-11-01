/**
 * Stub: shot_prompts — one prompt per shot from board.json.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertUnderOutDir, ensureParentDir } from "../path-sandbox.mjs";
import { createTraceSession } from "../trace.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(__dirname, "../..");

export const SKILL = "shot_prompts";
export const OUT_REL = "prompts.json";

function loadBoard() {
  const p = resolve(labRoot, "workspace/out/board.json");
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  // Fallback minimal board if run alone
  return {
    shots: [
      { id: "S1", beat: "痛点展示", duration_sec: 8 },
      { id: "S2", beat: "三步法讲解", duration_sec: 20 },
    ],
    scenes: [{ id: "desk_top", name: "桌面俯拍区" }],
    cast: [{ id: "host", role: "出镜主持人" }],
  };
}

export function runShotPrompts({ caseId = "stub-shot_prompts" } = {}) {
  const tracePath = resolve(labRoot, "traces", `${caseId}.jsonl`);
  const trace = createTraceSession({ skill: SKILL, caseId, tracePath });
  const board = loadBoard();

  const prompts = {
    skill: SKILL,
    schema_version: 1,
    items: (board.shots || []).map((shot) => ({
      shot_id: shot.id,
      duration_sec: shot.duration_sec,
      prompt: `短视频镜头 ${shot.id}：${shot.beat}；场景桌面俯拍；角色主持人出镜；画质清晰、无品牌水印、无真实平台 UI。时长约 ${shot.duration_sec}s。`,
    })),
  };

  const { absolutePath, relativeFromOut } = assertUnderOutDir(labRoot, OUT_REL);
  ensureParentDir(absolutePath);
  const body = JSON.stringify(prompts, null, 2) + "\n";
  writeFileSync(absolutePath, body, "utf8");
  trace.writeEvent({ path: `workspace/out/${relativeFromOut}`, bytes: Buffer.byteLength(body) });
  trace.end({ stop_reason: "success", out_path: `workspace/out/${relativeFromOut}` });

  return { outPath: absolutePath, relativePath: `workspace/out/${relativeFromOut}`, prompts, tracePath, stop_reason: "success" };
}

if (process.argv[1]?.endsWith("shot_prompts.mjs")) {
  const r = runShotPrompts();
  console.log(`ok  ${SKILL} -> ${r.relativePath}`);
}
