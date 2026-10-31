#!/usr/bin/env node
/**
 * Live eval: run lab05 against local Ollama per case, then assert trace.
 * No paid APIs. Forces NO_PROXY so http_proxy cannot hijack localhost.
 */
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { assertExpect, loadTrace, summarizeTrace } from "./assert-trace.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const lab06Root = resolve(__dirname, "..");
const repoRoot = resolve(lab06Root, "../..");
const lab05Root = resolve(repoRoot, "labs/05-minimal-harness");
const casesPath = resolve(lab06Root, "cases.json");
const resultsDir = resolve(lab06Root, "results");
const tracesDir = resolve(resultsDir, "traces");

const CASE_FILTER = process.env.EVAL_CASE_ID; // optional single case
const PER_CASE_TIMEOUT_MS = Number(process.env.EVAL_TIMEOUT_MS || 180_000);

function failFast(message) {
  console.error(`BLOCKER: ${message}`);
  process.exit(2);
}

async function ensureOllama() {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", { signal: ac.signal });
    if (!res.ok) failFast(`Ollama /api/tags HTTP ${res.status}`);
    const body = await res.json();
    const names = (body.models || []).map((m) => m.name);
    if (!names.includes("qwen3.8:27b")) {
      failFast(`model qwen3.8:27b not in Ollama tags; have=${JSON.stringify(names)}`);
    }
    console.error(`[eval] ollama=up model=qwen3.8:27b`);
  } catch (error) {
    failFast(`Ollama not reachable at 127.0.0.1:11434 (${error instanceof Error ? error.message : error})`);
  } finally {
    clearTimeout(timer);
  }
}

function runLab05({ prompt, maxTurns, allowedTools, toolTimeoutMs, injectReadPath, traceOut }) {
  return new Promise((resolvePromise) => {
    const started = performance.now();
    const env = {
      ...process.env,
      MAX_TURNS: String(maxTurns),
      EVAL_PROMPT: prompt,
      EVAL_ALLOWED_TOOLS: allowedTools.join(","),
      TOOL_TIMEOUT_MS: toolTimeoutMs === undefined ? "" : String(toolTimeoutMs),
      EVAL_INJECT_READ_PATH: injectReadPath ? String(injectReadPath) : "",
      NO_PROXY: "127.0.0.1,localhost",
      no_proxy: "127.0.0.1,localhost",
      // Clear proxy vars that may hijack localhost Ollama
      http_proxy: "",
      https_proxy: "",
      HTTP_PROXY: "",
      HTTPS_PROXY: "",
      ALL_PROXY: "",
      all_proxy: "",
    };

    const lab05Trace = resolve(lab05Root, "traces/latest.jsonl");
    try {
      if (existsSync(lab05Trace)) {
        // Prevent asserting against a previous case if this run crashes early.
        writeFileSync(lab05Trace, "", "utf8");
      }
      if (existsSync(traceOut)) {
        writeFileSync(traceOut, "", "utf8");
      }
    } catch {
      // ignore
    }

    const child = spawn("npm", ["start"], {
      cwd: lab05Root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, PER_CASE_TIMEOUT_MS);

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const durationMs = Math.round(performance.now() - started);
      if (existsSync(lab05Trace) && readFileSync(lab05Trace, "utf8").trim().length > 0) {
        copyFileSync(lab05Trace, traceOut);
      }
      resolvePromise({
        code,
        signal,
        durationMs,
        stdout,
        stderr,
        traceOut,
        traceExists: existsSync(traceOut),
      });
    });
  });
}

await ensureOllama();

if (!existsSync(resolve(lab05Root, "package.json"))) {
  failFast(`lab05 missing at ${lab05Root}`);
}

const cases = JSON.parse(readFileSync(casesPath, "utf8"));
mkdirSync(tracesDir, { recursive: true });

const selected = cases.filter((c) => {
  if (CASE_FILTER && c.id !== CASE_FILTER) return false;
  return (c.run ?? "live") === "live";
});

if (selected.length === 0) {
  failFast(CASE_FILTER ? `no live case matching EVAL_CASE_ID=${CASE_FILTER}` : "no live cases");
}

const report = {
  startedAt: new Date().toISOString(),
  model: "ollama/qwen3.8:27b",
  lab05: lab05Root,
  timeoutMs: PER_CASE_TIMEOUT_MS,
  results: [],
};

let passCount = 0;
let failCount = 0;

for (const item of selected) {
  console.error(
    `\n[eval] case=${item.id} maxTurns=${item.max_turns} tools=${(item.allowed_tools || []).join(",")} toolTimeoutMs=${item.tool_timeout_ms ?? "off"}`,
  );
  const traceOut = resolve(tracesDir, `${item.id}.jsonl`);
  const run = await runLab05({
    prompt: item.prompt,
    maxTurns: item.max_turns,
    allowedTools: item.allowed_tools || ["read"],
    toolTimeoutMs: item.tool_timeout_ms,
    injectReadPath: item.inject_read_path,
    traceOut,
  });

  const entry = {
    id: item.id,
    category: item.category,
    max_turns: item.max_turns,
    allowed_tools: item.allowed_tools,
    tool_timeout_ms: item.tool_timeout_ms ?? null,
    durationMs: run.durationMs,
    exitCode: run.code,
    signal: run.signal,
    pass: false,
    failures: [],
    summary: null,
  };

  if (!run.traceExists) {
    entry.failures.push("missing trace after lab05 run");
  } else {
    const summary = summarizeTrace(loadTrace(traceOut));
    entry.summary = summary;
    entry.failures = assertExpect(item.expect, summary);
  }

  entry.pass = entry.failures.length === 0;
  if (entry.pass) {
    passCount += 1;
    console.error(`[eval] PASS ${item.id} durationMs=${run.durationMs} stop=${entry.summary?.stopReason}`);
  } else {
    failCount += 1;
    console.error(`[eval] FAIL ${item.id} durationMs=${run.durationMs}`);
    for (const f of entry.failures) console.error(`  - ${f}`);
  }
  report.results.push(entry);
}

report.finishedAt = new Date().toISOString();
report.passCount = passCount;
report.failCount = failCount;
report.total = selected.length;

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = resolve(resultsDir, `baseline-${stamp}.json`);
const latestPath = resolve(resultsDir, "baseline-latest.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(latestPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(resultsDir, ".gitkeep"), "");

console.error(`\n[eval] done pass=${passCount} fail=${failCount} total=${selected.length}`);
console.error(`[eval] report=${reportPath}`);
console.log(JSON.stringify({ passCount, failCount, total: selected.length, reportPath: latestPath }, null, 2));

process.exitCode = failCount === 0 ? 0 : 1;
