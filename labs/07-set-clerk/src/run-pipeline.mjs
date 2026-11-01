#!/usr/bin/env node
/**
 * Whole-chain production pipeline: pick_topic → draft_script → draft_board → shot_prompts.
 * Fail-stop on first non-success; writes traces/case-pipeline.jsonl covering the chain.
 * Per-skill cases still get their own traces from skill runners.
 *
 * Optional: PIPELINE_MAX_MS — soft wall-clock budget for the whole chain
 * (product decision: budget covers the line, not only one skill).
 */
import { rmSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runPickTopic } from "./skills/pick_topic.mjs";
import { runDraftScript } from "./skills/draft_script.mjs";
import { runDraftBoard } from "./skills/draft_board.mjs";
import { runShotPrompts } from "./skills/shot_prompts.mjs";
import { assertUnderOutDir } from "./path-sandbox.mjs";
import { getBackend } from "./model-adapter.mjs";
import { createTraceSession } from "./trace.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(__dirname, "..");
const backend = getBackend();
const PIPELINE_CASE_ID = "case-pipeline";
const OUT_FILES = ["topic.json", "script.md", "board.json", "prompts.json"];

const ORDER = [
  { skill: "pick_topic", caseId: "case-pick_topic", run: (opts) => runPickTopic(opts) },
  { skill: "draft_script", caseId: "case-draft_script", run: (opts) => runDraftScript(opts) },
  { skill: "draft_board", caseId: "case-draft_board", run: (opts) => runDraftBoard(opts) },
  { skill: "shot_prompts", caseId: "case-shot_prompts", run: (opts) => runShotPrompts(opts) },
];

function assertEscapeDenied() {
  let denied = false;
  try {
    assertUnderOutDir(labRoot, "../../etc/passwd");
  } catch (e) {
    if (e && e.code === "PATH_DENIED") denied = true;
  }
  if (!denied) {
    console.error("FAIL: path sandbox did not deny escape");
    process.exit(1);
  }
  console.log("ok  path-sandbox escape denied");
}

function resetOutArtifacts() {
  for (const name of OUT_FILES) {
    const p = resolve(labRoot, "workspace", "out", name);
    if (existsSync(p)) rmSync(p);
  }
}

function readMaxMs() {
  const raw = process.env.PIPELINE_MAX_MS;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

assertEscapeDenied();
resetOutArtifacts();
console.log(`backend=${backend}  (MODEL / SET_CLERK_BACKEND; default stub)`);
console.log("pipeline order: pick_topic → draft_script → draft_board → shot_prompts");

const maxMs = readMaxMs();
if (maxMs) console.log(`PIPELINE_MAX_MS=${maxMs} (whole-chain soft budget)`);

const startedAt = Date.now();
const pipelineTracePath = resolve(labRoot, "traces", `${PIPELINE_CASE_ID}.jsonl`);
const pipe = createTraceSession({
  skill: "pipeline",
  caseId: PIPELINE_CASE_ID,
  tracePath: pipelineTracePath,
});
pipe.emit({
  eventType: "pipeline_plan",
  order: ORDER.map((s) => s.skill),
  budget_ms: maxMs,
});

let failedSkill = null;
let failDetail = null;

for (const step of ORDER) {
  if (maxMs && Date.now() - startedAt > maxMs) {
    failedSkill = step.skill;
    failDetail = `PIPELINE_MAX_MS exceeded before ${step.skill}`;
    pipe.emit({
      eventType: "pipeline_budget",
      stop_reason: "pipeline_budget",
      skill: step.skill,
      elapsed_ms: Date.now() - startedAt,
      budget_ms: maxMs,
    });
    break;
  }

  pipe.emit({ eventType: "step_start", skill: step.skill, caseId: step.caseId });
  try {
    const r = await step.run({ caseId: step.caseId, backend });
    const stop = r?.stop_reason ?? "unknown";
    const rel = r?.relativePath;
    if (stop !== "success" || !rel) {
      failedSkill = step.skill;
      failDetail = `step returned stop_reason=${stop}`;
      pipe.emit({
        eventType: "step_fail",
        skill: step.skill,
        stop_reason: stop,
        relativePath: rel ?? null,
      });
      break;
    }
    pipe.writeEvent({ path: rel, bytes: r?.bytes ?? 0 });
    pipe.emit({
      eventType: "step_end",
      skill: step.skill,
      stop_reason: "success",
      out_path: rel,
      backend: r?.backend ?? backend,
    });
    console.log(`ok  pipeline step ${step.skill} → ${rel} stop_reason=success`);
  } catch (e) {
    failedSkill = step.skill;
    failDetail = e?.message || String(e);
    pipe.emit({
      eventType: "step_fail",
      skill: step.skill,
      error: failDetail,
      code: e?.code ?? null,
    });
    console.error(`FAIL  pipeline step ${step.skill}: ${failDetail}`);
    break;
  }
}

const elapsed = Date.now() - startedAt;

if (failedSkill) {
  pipe.end({
    stop_reason: "pipeline_fail",
    failed_skill: failedSkill,
    detail: failDetail,
    elapsed_ms: elapsed,
    completed: ORDER.map((s) => s.skill).indexOf(failedSkill),
  });
  console.error(
    `\nFAIL  pipeline stopped at ${failedSkill}: ${failDetail}  (fail-stop; remaining steps skipped)`,
  );
  console.error(`trace=${pipelineTracePath}`);
  process.exit(1);
}

pipe.end({
  stop_reason: "success",
  elapsed_ms: elapsed,
  order: ORDER.map((s) => s.skill),
  out_paths: OUT_FILES.map((n) => `workspace/out/${n}`),
});

console.log(
  "\nPASS  pipeline wrote workspace/out/{topic.json,script.md,board.json,prompts.json}",
);
console.log(`trace=${pipelineTracePath}  elapsed_ms=${elapsed}`);
