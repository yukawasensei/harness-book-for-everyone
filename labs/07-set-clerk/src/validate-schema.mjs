#!/usr/bin/env node
/**
 * Schema + path + Trace assertions for lab07 cases (no model).
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
  return {
    writePaths: writes.map((w) => w.path),
    stop_reason: end?.stop_reason ?? null,
  };
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

  const outAbs = resolve(labRoot, c.expect.out_path);
  if (!existsSync(outAbs)) {
    fail(`${id}: missing output file ${c.expect.out_path}`);
    continue;
  }

  // path must stay under workspace/out
  const norm = c.expect.out_path.replace(/\\/g, "/");
  if (!norm.startsWith("workspace/out/")) {
    fail(`${id}: out_path must start with workspace/out/`);
    continue;
  }

  // schema checks
  if (c.expect.format === "json") {
    let data;
    try {
      data = JSON.parse(readFileSync(outAbs, "utf8"));
    } catch (e) {
      fail(`${id}: invalid JSON at ${c.expect.out_path}`);
      continue;
    }
    for (const field of c.expect.required_fields || []) {
      if (!(field in data)) {
        fail(`${id}: missing schema field ${field}`);
        continue;
      }
    }
    if (c.expect.min_shots && (!Array.isArray(data.shots) || data.shots.length < c.expect.min_shots)) {
      fail(`${id}: shots[] length < ${c.expect.min_shots}`);
      continue;
    }
    if (c.expect.min_prompt_items && (!Array.isArray(data.items) || data.items.length < c.expect.min_prompt_items)) {
      fail(`${id}: items[] length < ${c.expect.min_prompt_items}`);
      continue;
    }
    if (c.expect.required_item_fields) {
      for (const item of data.items || []) {
        for (const f of c.expect.required_item_fields) {
          if (!(f in item)) {
            fail(`${id}: prompt item missing ${f}`);
          }
        }
      }
    }
  } else if (c.expect.format === "markdown") {
    const text = readFileSync(outAbs, "utf8");
    for (const heading of c.expect.required_headings || []) {
      if (!text.includes(heading)) {
        fail(`${id}: missing heading/marker ${heading}`);
        continue;
      }
    }
  }

  // Trace
  const tracePath = resolve(labRoot, c.expect.trace_path);
  const rows = loadTrace(tracePath);
  if (!rows) {
    fail(`${id}: missing trace ${c.expect.trace_path}`);
    continue;
  }
  const summary = summarizeTrace(rows);
  if (c.expect.stop_reason && summary.stop_reason !== c.expect.stop_reason) {
    fail(`${id}: stop_reason want=${c.expect.stop_reason} got=${summary.stop_reason}`);
    continue;
  }
  if (c.expect.trace_write_path) {
    if (!summary.writePaths.includes(c.expect.trace_write_path)) {
      fail(`${id}: Trace missing write path ${c.expect.trace_write_path}; saw ${JSON.stringify(summary.writePaths)}`);
      continue;
    }
  }

  if (process.exitCode) continue;
  ok += 1;
  console.log(`ok  ${id}  schema+path+trace`);
}

if (process.exitCode) {
  console.error(`\nvalidated=${ok}/${cases.length} — errors above`);
  process.exit(process.exitCode);
}
console.log(`\nPASS  ${ok}/${cases.length} cases schema+path+trace  file=${casesPath}`);
