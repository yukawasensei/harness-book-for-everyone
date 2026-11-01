#!/usr/bin/env node
/**
 * Schema + path + Trace assertions for lab07 cases (no model).
 * Supports single-skill formats (json/markdown) and whole-chain format "pipeline".
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(__dirname, "..");
const casesPath = resolve(labRoot, "cases.json");

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

function loadTrace(tracePath) {
  if (!existsSync(tracePath)) return null;
  return readFileSync(tracePath, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function summarizeTrace(rows) {
  const writes = rows.filter((r) => r.eventType === "write");
  const end = [...rows].reverse().find((r) => r.eventType === "harness_end");
  const stepEnds = rows.filter((r) => r.eventType === "step_end");
  return {
    writePaths: writes.map((w) => w.path),
    stop_reason: end?.stop_reason ?? null,
    stepOrder: stepEnds.map((s) => s.skill).filter(Boolean),
  };
}

function validateSingleSkill(c, id) {
  const outAbs = resolve(labRoot, c.expect.out_path);
  if (!existsSync(outAbs)) {
    fail(`${id}: missing output file ${c.expect.out_path}`);
    return false;
  }

  const norm = c.expect.out_path.replace(/\\/g, "/");
  if (!norm.startsWith("workspace/out/")) {
    fail(`${id}: out_path must start with workspace/out/`);
    return false;
  }

  if (c.expect.format === "json") {
    let data;
    try {
      data = JSON.parse(readFileSync(outAbs, "utf8"));
    } catch {
      fail(`${id}: invalid JSON at ${c.expect.out_path}`);
      return false;
    }
    for (const field of c.expect.required_fields || []) {
      if (!(field in data)) {
        fail(`${id}: missing schema field ${field}`);
        return false;
      }
    }
    if (c.expect.min_shots && (!Array.isArray(data.shots) || data.shots.length < c.expect.min_shots)) {
      fail(`${id}: shots[] length < ${c.expect.min_shots}`);
      return false;
    }
    if (
      c.expect.min_prompt_items &&
      (!Array.isArray(data.items) || data.items.length < c.expect.min_prompt_items)
    ) {
      fail(`${id}: items[] length < ${c.expect.min_prompt_items}`);
      return false;
    }
    if (c.expect.required_item_fields) {
      for (const item of data.items || []) {
        for (const f of c.expect.required_item_fields) {
          if (!(f in item)) {
            fail(`${id}: prompt item missing ${f}`);
            return false;
          }
        }
      }
    }
  } else if (c.expect.format === "markdown") {
    const text = readFileSync(outAbs, "utf8");
    for (const heading of c.expect.required_headings || []) {
      if (!text.includes(heading)) {
        fail(`${id}: missing heading/marker ${heading}`);
        return false;
      }
    }
  }

  const tracePath = resolve(labRoot, c.expect.trace_path);
  const rows = loadTrace(tracePath);
  if (!rows) {
    fail(`${id}: missing trace ${c.expect.trace_path}`);
    return false;
  }
  const summary = summarizeTrace(rows);
  if (c.expect.stop_reason && summary.stop_reason !== c.expect.stop_reason) {
    fail(`${id}: stop_reason want=${c.expect.stop_reason} got=${summary.stop_reason}`);
    return false;
  }
  if (c.expect.trace_write_path) {
    if (!summary.writePaths.includes(c.expect.trace_write_path)) {
      fail(
        `${id}: Trace missing write path ${c.expect.trace_write_path}; saw ${JSON.stringify(summary.writePaths)}`,
      );
      return false;
    }
  }
  return true;
}

function validatePipeline(c, id) {
  const required = c.expect.required_out_paths || [];
  for (const rel of required) {
    const norm = rel.replace(/\\/g, "/");
    if (!norm.startsWith("workspace/out/")) {
      fail(`${id}: required path must start with workspace/out/: ${rel}`);
      return false;
    }
    const abs = resolve(labRoot, rel);
    if (!existsSync(abs)) {
      fail(`${id}: missing pipeline output ${rel}`);
      return false;
    }
  }

  const tracePath = resolve(labRoot, c.expect.trace_path);
  const rows = loadTrace(tracePath);
  if (!rows) {
    fail(`${id}: missing pipeline trace ${c.expect.trace_path}`);
    return false;
  }
  const summary = summarizeTrace(rows);
  if (c.expect.stop_reason && summary.stop_reason !== c.expect.stop_reason) {
    fail(`${id}: stop_reason want=${c.expect.stop_reason} got=${summary.stop_reason}`);
    return false;
  }
  for (const wp of c.expect.trace_write_paths || []) {
    if (!summary.writePaths.includes(wp)) {
      fail(
        `${id}: pipeline Trace missing write path ${wp}; saw ${JSON.stringify(summary.writePaths)}`,
      );
      return false;
    }
  }
  if (Array.isArray(c.expect.order) && c.expect.order.length) {
    if (summary.stepOrder.length < c.expect.order.length) {
      fail(
        `${id}: pipeline Trace step_end order incomplete; want ${JSON.stringify(c.expect.order)} got ${JSON.stringify(summary.stepOrder)}`,
      );
      return false;
    }
    for (let i = 0; i < c.expect.order.length; i++) {
      if (summary.stepOrder[i] !== c.expect.order[i]) {
        fail(
          `${id}: pipeline order mismatch at [${i}]; want ${c.expect.order[i]} got ${summary.stepOrder[i]}`,
        );
        return false;
      }
    }
  }
  return true;
}

const cases = JSON.parse(readFileSync(casesPath, "utf8"));
if (!Array.isArray(cases) || cases.length === 0) {
  fail("cases.json must be non-empty array");
  process.exit(1);
}

let ok = 0;
for (const c of cases) {
  const id = c.id;
  if (!id) {
    fail("case missing id");
    continue;
  }

  let passed = false;
  if (c.expect?.format === "pipeline") {
    passed = validatePipeline(c, id);
  } else {
    passed = validateSingleSkill(c, id);
  }

  if (process.exitCode) continue;
  if (!passed) continue;
  ok += 1;
  console.log(`ok  ${id}  schema+path+trace`);
}

if (process.exitCode) {
  console.error(`\nvalidated=${ok}/${cases.length} — errors above`);
  process.exit(process.exitCode);
}
console.log(`\nPASS  ${ok}/${cases.length} cases schema+path+trace  file=${casesPath}`);
