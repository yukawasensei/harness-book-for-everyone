/**
 * Stub: draft_board — board.json with shots + cast/props/scenes.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertUnderOutDir, ensureParentDir } from "../path-sandbox.mjs";
import { createTraceSession } from "../trace.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(__dirname, "../..");

export const SKILL = "draft_board";
export const OUT_REL = "board.json";

export function runDraftBoard({ caseId = "stub-draft_board" } = {}) {
  const tracePath = resolve(labRoot, "traces", `${caseId}.jsonl`);
  const trace = createTraceSession({ skill: SKILL, caseId, tracePath });

  const board = {
    skill: SKILL,
    schema_version: 1,
    cast: [
      { id: "host", role: "出镜主持人", note: "职场穿搭，语速平稳" },
    ],
    props: [
      { id: "desk", name: "凌乱桌面道具", note: "文件/线材可见" },
      { id: "box", name: "收纳盒", note: "可入镜" },
    ],
    scenes: [
      { id: "desk_top", name: "桌面俯拍区", lighting: "自然光+台灯" },
    ],
    shots: [
      { id: "S1", scene: "desk_top", cast: ["host"], props: ["desk"], beat: "痛点展示", duration_sec: 8 },
      { id: "S2", scene: "desk_top", cast: ["host"], props: ["desk", "box"], beat: "三步法讲解", duration_sec: 20 },
      { id: "S3", scene: "desk_top", cast: ["host"], props: ["box"], beat: "示范整理", duration_sec: 12 },
      { id: "S4", scene: "desk_top", cast: ["host"], props: [], beat: "CTA", duration_sec: 5 },
    ],
  };

  const { absolutePath, relativeFromOut } = assertUnderOutDir(labRoot, OUT_REL);
  ensureParentDir(absolutePath);
  const body = JSON.stringify(board, null, 2) + "\n";
  writeFileSync(absolutePath, body, "utf8");
  trace.writeEvent({ path: `workspace/out/${relativeFromOut}`, bytes: Buffer.byteLength(body) });
  trace.end({ stop_reason: "success", out_path: `workspace/out/${relativeFromOut}` });

  return { outPath: absolutePath, relativePath: `workspace/out/${relativeFromOut}`, board, tracePath, stop_reason: "success" };
}

if (process.argv[1]?.endsWith("draft_board.mjs")) {
  const r = runDraftBoard();
  console.log(`ok  ${SKILL} -> ${r.relativePath}`);
}
