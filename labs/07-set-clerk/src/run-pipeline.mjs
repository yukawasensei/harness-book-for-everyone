#!/usr/bin/env node
/**
 * Whole-chain production pipeline: pick_topic → draft_script → draft_board → shot_prompts.
 * Fail-stop on first non-success; writes traces/case-pipeline.jsonl covering the chain.
 *
 * Whole-chain budgets (lesson 23; not the same as lesson-17 single-skill caps):
 *   PIPELINE_MAX_MS      — wall-clock; stop BEFORE next step when elapsed >= max
 *                          (maxMs=0 is deterministic: stop before first skill)
 *                          stop_reason=pipeline_latency_budget
 *   PIPELINE_COST_UNITS  — teaching proxy: each started skill costs 1 unit;
 *                          stop BEFORE next step when remaining < 1
 *                          stop_reason=pipeline_cost_budget
 * Budget stops are NOT collapsed into generic pipeline_fail.
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

/** null = unlimited; 0 allowed (deterministic latency brake). */
function readMaxMs() {
  const raw = process.env.PIPELINE_MAX_MS;
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** null = unlimited; each skill costs 1 unit. */
function readCostUnits() {
  const raw = process.env.PIPELINE_COST_UNITS;
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

assertEscapeDenied();
resetOutArtifacts();
console.log(`backend=${backend}  (MODEL / SET_CLERK_BACKEND; default stub)`);
console.log("pipeline order: pick_topic → draft_script → draft_board → shot_prompts");

const maxMs = readMaxMs();
const costBudget = readCostUnits();
if (maxMs !== null) console.log(`PIPELINE_MAX_MS=${maxMs} (whole-chain latency budget)`);
if (costBudget !== null) console.log(`PIPELINE_COST_UNITS=${costBudget} (whole-chain cost proxy; 1 unit/skill)`);

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
  budget_cost_units: costBudget,
});

let stopReason = null; // pipeline_fail | pipeline_latency_budget | pipeline_cost_budget
let failedSkill = null;
let failDetail = null;
let costUsed = 0;
let completedSteps = 0;

for (const step of ORDER) {
  const elapsedBefore = Date.now() - startedAt;

  if (maxMs !== null && elapsedBefore >= maxMs) {
    stopReason = "pipeline_latency_budget";
    failedSkill = step.skill;
    failDetail = `PIPELINE_MAX_MS=${maxMs} exceeded before ${step.skill}`;
    pipe.emit({
      eventType: "pipeline_budget",
      stop_reason: "pipeline_latency_budget",
      budget_type: "latency",
      skill_would_run: step.skill,
      elapsed_ms: elapsedBefore,
      budget_ms: maxMs,
      cost_units_used: costUsed,
      budget_cost_units: costBudget,
    });
    break;
  }

  if (costBudget !== null && costBudget - costUsed < 1) {
    stopReason = "pipeline_cost_budget";
    failedSkill = step.skill;
    failDetail = `PIPELINE_COST_UNITS=${costBudget} exhausted before ${step.skill} (used=${costUsed})`;
    pipe.emit({
      eventType: "pipeline_budget",
      stop_reason: "pipeline_cost_budget",
      budget_type: "cost",
      skill_would_run: step.skill,
      elapsed_ms: elapsedBefore,
      cost_units_used: costUsed,
      budget_cost_units: costBudget,
      budget_ms: maxMs,
    });
    break;
  }

  // Charge 1 unit when a skill is started (teaching proxy).
  if (costBudget !== null) costUsed += 1;

  pipe.emit({ eventType: "step_start", skill: step.skill, caseId: step.caseId });
  try {
    const r = await step.run({ caseId: step.caseId, backend });
    const stop = r?.stop_reason ?? "unknown";
    const rel = r?.relativePath;
    if (stop !== "success" || !rel) {
      stopReason = "pipeline_fail";
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
    completedSteps += 1;
    console.log(`ok  pipeline step ${step.skill} → ${rel} stop_reason=success`);
  } catch (e) {
    stopReason = "pipeline_fail";
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

if (stopReason) {
  pipe.end({
    stop_reason: stopReason,
    failed_skill: failedSkill,
    skill_would_run: failedSkill,
    detail: failDetail,
    elapsed_ms: elapsed,
    cost_units_used: costUsed,
    budget_ms: maxMs,
    budget_cost_units: costBudget,
    completed: completedSteps,
  });
  const label =
    stopReason === "pipeline_fail"
      ? "pipeline stopped"
      : "pipeline budget stop";
  console.error(
    `\nFAIL  ${label} at ${failedSkill}: ${failDetail}  (stop_reason=${stopReason}; remaining steps skipped)`,
  );
  console.error(`trace=${pipelineTracePath}`);
  process.exit(1);
}

pipe.end({
  stop_reason: "success",
  elapsed_ms: elapsed,
  cost_units_used: costUsed,
  order: ORDER.map((s) => s.skill),
  out_paths: OUT_FILES.map((n) => `workspace/out/${n}`),
});

console.log(
  "\nPASS  pipeline wrote workspace/out/{topic.json,script.md,board.json,prompts.json}",
);
console.log(`trace=${pipelineTracePath}  elapsed_ms=${elapsed}  cost_units_used=${costUsed}`);
