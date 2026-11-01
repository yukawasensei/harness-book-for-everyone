#!/usr/bin/env node
/**
 * Lesson 23: whole-chain budget brakes (separate from npm test happy path).
 * Spawns run-pipeline.mjs with tight env budgets and asserts Trace + artifacts.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(__dirname, "..");
const pipelineJs = resolve(__dirname, "run-pipeline.mjs");
const outDir = resolve(labRoot, "workspace", "out");
const tracePath = resolve(labRoot, "traces", "case-pipeline.jsonl");

const OUT = {
  topic: resolve(outDir, "topic.json"),
  script: resolve(outDir, "script.md"),
  board: resolve(outDir, "board.json"),
  prompts: resolve(outDir, "prompts.json"),
};

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function loadTrace() {
  if (!existsSync(tracePath)) fail(`missing trace ${tracePath}`);
  return readFileSync(tracePath, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function runPipeline(envExtra) {
  const r = spawnSync(process.execPath, [pipelineJs], {
    cwd: labRoot,
    env: { ...process.env, MODEL: "stub", ...envExtra },
    encoding: "utf8",
  });
  return r;
}

function assertBudgetCase({ name, env, expectStop, expectPresent, expectAbsent, expectWouldRun }) {
  console.log(`\n-- ${name} --`);
  const r = runPipeline(env);
  if (r.status === 0) fail(`${name}: expected non-zero exit, got 0`);
  console.log(`ok  exit=${r.status} (non-zero as expected)`);

  const rows = loadTrace();
  const budgetEv = rows.find(
    (x) => x.eventType === "pipeline_budget" && x.stop_reason === expectStop,
  );
  if (!budgetEv) {
    fail(
      `${name}: missing pipeline_budget event stop_reason=${expectStop}; events=${JSON.stringify(rows.map((x) => x.eventType + ":" + (x.stop_reason || "")))}`,
    );
  }
  if (expectWouldRun && budgetEv.skill_would_run !== expectWouldRun) {
    fail(
      `${name}: skill_would_run want=${expectWouldRun} got=${budgetEv.skill_would_run}`,
    );
  }
  console.log(
    `ok  Trace pipeline_budget stop_reason=${budgetEv.stop_reason} skill_would_run=${budgetEv.skill_would_run}`,
  );

  const end = [...rows].reverse().find((x) => x.eventType === "harness_end");
  if (!end || end.stop_reason !== expectStop) {
    fail(`${name}: harness_end.stop_reason want=${expectStop} got=${end?.stop_reason}`);
  }
  console.log(`ok  harness_end.stop_reason=${end.stop_reason}`);

  for (const key of expectPresent) {
    if (!existsSync(OUT[key])) fail(`${name}: expected present ${key}`);
  }
  for (const key of expectAbsent) {
    if (existsSync(OUT[key])) fail(`${name}: expected absent ${key} (budget should have stopped writing)`);
  }
  console.log(
    `ok  artifacts present=[${expectPresent}] absent=[${expectAbsent}]`,
  );
}

// Clean slate before suite (pipeline also resets, but be explicit)
for (const p of Object.values(OUT)) {
  if (existsSync(p)) rmSync(p);
}

assertBudgetCase({
  name: "cost-brake PIPELINE_COST_UNITS=2",
  env: { PIPELINE_COST_UNITS: "2" },
  expectStop: "pipeline_cost_budget",
  expectWouldRun: "draft_board",
  expectPresent: ["topic", "script"],
  expectAbsent: ["board", "prompts"],
});

assertBudgetCase({
  name: "latency-brake PIPELINE_MAX_MS=0",
  env: { PIPELINE_MAX_MS: "0" },
  expectStop: "pipeline_latency_budget",
  expectWouldRun: "pick_topic",
  expectPresent: [],
  expectAbsent: ["topic", "script", "board", "prompts"],
});

console.log("\nPASS  eval:budget — cost + latency brakes recorded in Trace");
