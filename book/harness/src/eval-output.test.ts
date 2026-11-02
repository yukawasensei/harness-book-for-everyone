import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";

// Exercise the real CLI, SDK loop, read tool and checker; only HTTP is offline.
function fixture(t: TestContext) {
  mkdirSync("traces", { recursive: true });
  const root = mkdtempSync(resolve("traces", "eval-output-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ["src", "package.json", "lesson-input.md"]) cpSync(name, resolve(root, name), { recursive: true });
  for (const name of ["cases", "pi-agent", "evals/traces"]) mkdirSync(resolve(root, name), { recursive: true });
  cpSync("pi-agent/models.json", resolve(root, "pi-agent/models.json"));
  cpSync("evals/baseline.json", resolve(root, "evals/baseline.json"));
  writeFileSync(resolve(root, "evals/traces/old.jsonl"), "retained trace\n");
  const cases = JSON.parse(readFileSync("cases/cases.json", "utf8"));
  writeFileSync(resolve(root, "cases/cases.json"), JSON.stringify(cases.filter((c: { id: string }) => c.id === "read-happy")));
  symlinkSync(resolve("node_modules"), resolve(root, "node_modules"), "dir");
  const stub = resolve(root, "offline-http.mjs");
  writeFileSync(stub, `
globalThis.fetch = async (_url, init) => {
  const request = JSON.parse(String(init.body));
  const done = request.messages.some(message => message.role === "tool");
  const delta = done ? { content: "Harness 管理工具调用与执行边界。" } : {
    tool_calls: [{ index: 0, id: "offline-read", type: "function",
      function: { name: "read", arguments: JSON.stringify({ path: "lesson-input.md" }) } }],
  };
  return new Response("data: " + JSON.stringify({ id: "offline", choices: [
    { index: 0, delta, finish_reason: done ? "stop" : "tool_calls" },
  ] }) + "\\n\\ndata: [DONE]\\n\\n", { headers: { "content-type": "text/event-stream" } });
};
`);
  return { root, stub };
}

type EvalOptions = { archive?: string; partial?: boolean; repeat?: number; update?: string; model?: string };

function evalCommand(root: string, stub: string, options: EvalOptions = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, MODEL_ID: "ollama/qwen3.8:27b", EVAL_ARCHIVE: options.archive ?? "",
    UPDATE_BASELINE: options.update ?? "", NODE_OPTIONS: `--import=${pathToFileURL(stub).href}` };
  if (options.model) env.MODEL_ID = options.model;
  if (options.model?.startsWith("deepseek/")) env.DEEPSEEK_API_KEY = "test-offline-value";
  delete env.CASES;
  if (options.partial) env.CASES = "read-happy";
  return spawnSync("npm", ["run", "eval", ...(options.repeat ? ["--", "--repeat", String(options.repeat)] : [])], {
    cwd: root, encoding: "utf8", timeout: 30_000,
    env,
  });
}

function runEval(root: string, stub: string, options: EvalOptions = {}) {
  const baseline = readFileSync(resolve(root, "evals/baseline.json"), "utf8");
  const child = evalCommand(root, stub, options);
  assert.equal(child.status, 0, `${child.error ?? ""}\n${child.stderr}\n${child.stdout}`);
  assert.equal(readFileSync(resolve(root, "evals/baseline.json"), "utf8"), baseline);
  assert.equal(readFileSync(resolve(root, "evals/traces/old.jsonl"), "utf8"), "retained trace\n");
  assert.deepEqual(readdirSync(resolve(root, "evals/traces")), ["old.jsonl"]);
  const directory = child.stdout.match(/Artifacts: (.+)\/\{summary.json,report.md,traces\/\}/)?.[1];
  assert.ok(directory, "eval must print its artifact directory");
  return directory;
}

test("eval CLI writes partial, full and repeated runs locally without updating the baseline", (t) => {
  const { root, stub } = fixture(t);
  const directories = new Set<string>();
  for (const options of [{ partial: true }, { update: "0" }, { repeat: 2, archive: "0" }]) {
    const directory = runEval(root, stub, options);
    assert.ok(directory.startsWith("evals/runs/local/qwen3.8-27b/"));
    directories.add(directory);
    const summary = JSON.parse(readFileSync(resolve(root, directory, "summary.json"), "utf8"));
    assert.equal(summary.passCount, options.repeat ?? 1);
    assert.equal(summary.total, options.repeat ?? 1);
    assert.equal(summary.partial, Boolean(options.partial));
    assert.match(readFileSync(resolve(root, directory, "report.md"), "utf8"), /SIGN-OFF: OK/);
    const trace = readFileSync(resolve(root, directory, "traces/read-happy-1.jsonl"), "utf8");
    assert.match(trace, /"toolName":"read"/);
    assert.ok(!trace.includes(root));
  }
  assert.equal(directories.size, 3);
  assert.deepEqual(readdirSync(resolve(root, "evals/runs")), ["local"]);
});

test("UPDATE_BASELINE=1 explicitly updates the full Qwen baseline and its tracked traces", (t) => {
  const { root, stub } = fixture(t);
  const child = evalCommand(root, stub, { update: "1" });
  assert.equal(child.status, 0, child.stderr);
  const baseline = JSON.parse(readFileSync(resolve(root, "evals/baseline.json"), "utf8"));
  assert.equal(baseline.model, "ollama/qwen3.8:27b");
  assert.equal(baseline.passCount, 1);
  assert.equal(baseline.total, 1);
  assert.equal(baseline.results[0].tracePath, "evals/traces/read-happy.jsonl");
  assert.match(readFileSync(resolve(root, baseline.results[0].tracePath), "utf8"), /"toolName":"read"/);
  assert.ok(!JSON.stringify(baseline).includes(root));
  assert.match(child.stdout, /Artifacts: evals\/runs\/local\/qwen3.8-27b\//);
});

test("baseline update rejects partial, repeated and other-model runs before execution", (t) => {
  for (const options of [{ partial: true }, { repeat: 2 }, { model: "deepseek/deepseek-flash" }]) {
    const { root, stub } = fixture(t);
    const baseline = readFileSync(resolve(root, "evals/baseline.json"), "utf8");
    const child = evalCommand(root, stub, { ...options, update: "1" });
    assert.equal(child.status, 1, child.stdout);
    assert.match(child.stderr, /UPDATE_BASELINE=1 requires.*Qwen.*repeat=1.*CASES/);
    assert.equal(readFileSync(resolve(root, "evals/baseline.json"), "utf8"), baseline);
    assert.deepEqual(readdirSync(resolve(root, "evals/traces")), ["old.jsonl"]);
    assert.equal(existsSync(resolve(root, "evals/runs")), false);
    assert.equal(existsSync(resolve(root, "traces/latest.jsonl")), false);
  }
});

test("a failed full run preserves the signed baseline even with UPDATE_BASELINE=1", (t) => {
  const { root, stub } = fixture(t);
  writeFileSync(stub, readFileSync(stub, "utf8").replace(
    'const done = request.messages.some(message => message.role === "tool");', 'const done = true;',
  ));
  const baseline = readFileSync(resolve(root, "evals/baseline.json"), "utf8");
  const child = evalCommand(root, stub, { update: "1" });
  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stdout, /tool read not called/);
  assert.equal(readFileSync(resolve(root, "evals/baseline.json"), "utf8"), baseline);
  assert.deepEqual(readdirSync(resolve(root, "evals/traces")), ["old.jsonl"]);
});

test("EVAL_ARCHIVE=1 explicitly writes a fresh archive without replacing earlier runs", (t) => {
  const { root, stub } = fixture(t);
  const first = runEval(root, stub, { partial: true, archive: "1" });
  assert.ok(first.startsWith("evals/runs/qwen3.8-27b/"));
  const summary = readFileSync(resolve(root, first, "summary.json"), "utf8");
  const second = runEval(root, stub, { archive: "1" });
  assert.ok(second.startsWith("evals/runs/qwen3.8-27b/"));
  assert.notEqual(first, second);
  assert.equal(readFileSync(resolve(root, first, "summary.json"), "utf8"), summary);
  assert.deepEqual(readdirSync(resolve(root, "evals/runs")), ["qwen3.8-27b"]);
});
