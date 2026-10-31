#!/usr/bin/env node
/**
 * Schema-only eval runner stub — no model, no Ollama, no network.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const casesPath = resolve(__dirname, "../cases.json");

const STOP_REASONS = new Set([
  "success",
  "max_turns",
  "tool_timeout",
  "path_denied",
  "context_budget",
  "retry_exhausted",
  "human_denied",
  "awaiting_human",
  "cost_budget",
  "latency_budget",
  "tool_error",
  "model_error",
]);

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

const raw = readFileSync(casesPath, "utf8");
let cases;
try {
  cases = JSON.parse(raw);
} catch (error) {
  fail(`cases.json is not valid JSON: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

if (!Array.isArray(cases) || cases.length === 0) {
  fail("cases.json must be a non-empty array");
  process.exit(1);
}

const ids = new Set();
let ok = 0;

for (const [index, item] of cases.entries()) {
  const label = `cases[${index}]`;
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    fail(`${label} must be an object`);
    continue;
  }

  const { id, category, prompt, allowed_tools, max_turns, expect, tool_timeout_ms } = item;

  if (!isNonEmptyString(id)) {
    fail(`${label}.id must be a non-empty string`);
    continue;
  }
  if (ids.has(id)) {
    fail(`duplicate id: ${id}`);
    continue;
  }
  ids.add(id);

  if (!isNonEmptyString(category)) {
    fail(`${id}: category required`);
    continue;
  }
  if (!isNonEmptyString(prompt)) {
    fail(`${id}: prompt required`);
    continue;
  }
  if (!isStringArray(allowed_tools) || allowed_tools.length === 0) {
    fail(`${id}: allowed_tools must be a non-empty string[]`);
    continue;
  }
  if (!Number.isInteger(max_turns) || max_turns < 1) {
    fail(`${id}: max_turns must be an integer >= 1`);
    continue;
  }
  if (tool_timeout_ms !== undefined) {
    if (!Number.isInteger(tool_timeout_ms) || tool_timeout_ms < 0) {
      fail(`${id}: tool_timeout_ms must be an integer >= 0`);
      continue;
    }
  }
  if (expect === null || typeof expect !== "object" || Array.isArray(expect)) {
    fail(`${id}: expect must be an object`);
    continue;
  }

  if (expect.stop_reason !== undefined) {
    if (!STOP_REASONS.has(expect.stop_reason)) {
      fail(`${id}: expect.stop_reason invalid: ${expect.stop_reason}`);
      continue;
    }
  }
  if (expect.stop_reason_in !== undefined) {
    if (!isStringArray(expect.stop_reason_in) || expect.stop_reason_in.length === 0) {
      fail(`${id}: expect.stop_reason_in must be non-empty string[]`);
      continue;
    }
    for (const reason of expect.stop_reason_in) {
      if (!STOP_REASONS.has(reason)) {
        fail(`${id}: expect.stop_reason_in has invalid reason: ${reason}`);
        continue;
      }
    }
  }
  for (const key of ["tool_names_include", "tool_names_exclude"]) {
    if (expect[key] !== undefined && !isStringArray(expect[key])) {
      fail(`${id}: expect.${key} must be string[]`);
      continue;
    }
  }

  if (
    expect.stop_reason === undefined
    && expect.stop_reason_in === undefined
    && expect.tool_names_include === undefined
    && expect.tool_names_exclude === undefined
  ) {
    fail(`${id}: expect needs at least one assertion field`);
    continue;
  }

  ok += 1;
  console.log(`ok  ${id}  (${category})`);
}

if (process.exitCode) {
  console.error(`\nvalidated=${ok}/${cases.length} — schema errors above`);
  process.exit(process.exitCode);
}

console.log(`\nPASS  ${ok}/${cases.length} cases schema-ok  file=${casesPath}`);
