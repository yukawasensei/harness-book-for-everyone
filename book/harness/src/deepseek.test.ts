import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { streamSimple } from "@earendil-works/pi-ai/api/openai-completions";
import type { Model } from "@earendil-works/pi-ai";
import { configuredModel, validateModel } from "./eval/model-config.js";
import { aggregateRuns, runDirectory, scrubPaths } from "./eval/stability.js";
import { scrubSecrets } from "./secrets.js";
import { sumUsage } from "./eval/usage.js";
import { createIsolatedPi } from "./isolated-pi.js";
import { createTraceWriter, toTraceRow } from "./trace.js";

const config = JSON.parse(readFileSync("pi-agent/models.json", "utf8"));
const fixtureRoot = () => {
  mkdirSync("traces", { recursive: true });
  const root = mkdtempSync(resolve("traces", "startup-test-"));
  mkdirSync(resolve(root, "pi-agent"));
  writeFileSync(resolve(root, "pi-agent/models.json"), JSON.stringify(config));
  return root;
};

test("provider/model selection stays explicit and preserves legacy Ollama ids", () => {
  assert.equal(validateModel(config, "qwen3.8:27b"), "ollama/qwen3.8:27b");
  assert.equal(validateModel(config, "ollama/qwen3.8:27b"), "ollama/qwen3.8:27b");
  assert.equal(validateModel(config, "deepseek/deepseek-flash"), "deepseek/deepseek-flash");
  for (const id of ["unknown/deepseek-flash", "deepseek/unknown", "deepseek/", "/deepseek-flash"]) {
    assert.throws(() => validateModel(config, id), /pi-agent\/models.json/);
  }
  assert.equal(runDirectory("ollama/qwen3.8:27b", 1, false), undefined);
  assert.equal(runDirectory("deepseek/deepseek-flash", 5, false), "evals/runs/deepseek-deepseek-flash");
});

test("startup rejects a missing key, loads only once, and lets environment win", () => {
  const oldKey = process.env.DEEPSEEK_API_KEY;
  const oldModel = process.env.MODEL_ID;
  try {
    delete process.env.DEEPSEEK_API_KEY;
    process.env.MODEL_ID = "deepseek/deepseek-flash";
    const missingRoot = fixtureRoot();
    assert.throws(() => configuredModel(missingRoot), /DEEPSEEK_API_KEY.*\.env/);
    assert.equal(existsSync(resolve(missingRoot, "traces")), false);
    const root = fixtureRoot();
    writeFileSync(resolve(root, ".env"), "DEEPSEEK_API_KEY=test-file-value\n");
    assert.equal(configuredModel(root), "deepseek/deepseek-flash");
    assert.ok(process.env.DEEPSEEK_API_KEY === "test-file-value");
    writeFileSync(resolve(root, ".env"), "DEEPSEEK_API_KEY=test-replaced-value\n");
    configuredModel(root);
    assert.ok(process.env.DEEPSEEK_API_KEY === "test-file-value");
    process.env.DEEPSEEK_API_KEY = "test-environment-value";
    const overrideRoot = fixtureRoot();
    writeFileSync(resolve(overrideRoot, ".env"), "DEEPSEEK_API_KEY=test-file-value\n");
    configuredModel(overrideRoot);
    assert.ok(process.env.DEEPSEEK_API_KEY === "test-environment-value");
    delete process.env.DEEPSEEK_API_KEY;
    process.env.MODEL_ID = "qwen3.8:27b";
    assert.equal(configuredModel(fixtureRoot()), "ollama/qwen3.8:27b");
  } finally {
    if (oldKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.MODEL_ID;
    else process.env.MODEL_ID = oldModel;
  }
});

test("trace writer redacts the key before disk, including nested args, errors and escaped text", () => {
  const oldKey = process.env.DEEPSEEK_API_KEY;
  const secret = 'test-secret-"\\-value';
  try {
    process.env.DEEPSEEK_API_KEY = secret;
    const path = resolve(fixtureRoot(), "trace.jsonl");
    const write = createTraceWriter(path);
    write({ timestamp: "now", eventType: "error", error: secret, args: { nested: [secret] } });
    write(toTraceRow({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "x".repeat(490) + secret }] } }));
    const raw = readFileSync(path, "utf8");
    assert.ok(!raw.includes(JSON.stringify(secret).slice(1, -1)));
    assert.ok(!raw.includes("test-secret"));
    assert.match(raw, /\[REDACTED\]/);
    for (const line of raw.trim().split("\n")) JSON.parse(line);
    const archived = scrubPaths(scrubSecrets(JSON.stringify({ error: secret, path: "/project/book/harness/file" })), "/project/book/harness", "/project");
    assert.ok(!archived.includes("test-secret"));
    assert.equal(JSON.parse(archived).path, "./file");
  } finally {
    if (oldKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = oldKey;
  }
});

test("usage sums attempts once and leaves historical unknown usage absent", () => {
  const usage = { input: 100, output: 20, cacheRead: 50, cacheWrite: 0, totalTokens: 170,
    cost: { input: 0.00003, output: 0.000024, cacheRead: 0.0000003, cacheWrite: 0, total: 0.0000543 } };
  assert.equal(sumUsage([]), undefined);
  const attempt = { id: "test", pass: true, stop_reason: "success", tools: [], reasons: [], durationMs: 1, usage };
  const summary = aggregateRuns([{ model: "deepseek/deepseek-flash", startedAt: "a", finishedAt: "b", passCount: 2, total: 2, results: [attempt, attempt] }]);
  assert.equal(summary.usage?.totalTokens, 340);
  assert.equal(summary.usage?.cost.total, usage.cost.total * 2);
  assert.deepEqual(aggregateRuns([summary]).usage, summary.usage);
});

test("real SDK session serializes DeepSeek thinking disabled with equal context and output limits", async () => {
  const oldKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-request-value";
  try {
    const isolated = await createIsolatedPi(process.cwd());
    const model = isolated.modelRuntime.getModel("deepseek", "deepseek-flash");
    assert.ok(model, "DeepSeek must be in the repo model config");
    const qwen = isolated.modelRuntime.getModel("ollama", "qwen3.8:27b")!;
    assert.equal(model.contextWindow, qwen.contextWindow);
    assert.equal(model.maxTokens, qwen.maxTokens);
    assert.deepEqual(model.cost, { input: 0.30, output: 1.20, cacheRead: 0.006, cacheWrite: 0 });
    const auth = await isolated.modelRuntime.getAuth(model);
    assert.ok(auth?.auth.apiKey === "test-request-value", "SDK must resolve the configured environment key");
    const { session } = await createAgentSession({
      cwd: process.cwd(), ...isolated, model, thinkingLevel: "off", tools: [],
      sessionManager: SessionManager.inMemory(process.cwd()),
    });
    const requests: Record<string, unknown>[] = [];
    session.agent.streamFunction = (selected, context, options) => {
      return streamSimple(selected as Model<"openai-completions">, context, {
        ...options, apiKey: auth!.auth.apiKey, maxRetries: 0,
        fetch: async (_url, init) => {
          requests.push(JSON.parse(String(init?.body)));
          return new Response('data: {"id":"test","choices":[{"index":0,"delta":{"content":"done"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', {
            headers: { "content-type": "text/event-stream" },
          });
        },
      });
    };
    try {
      await session.prompt("Reply done.");
      assert.equal(requests.length, 1);
      assert.equal(requests[0].model, "deepseek-flash");
      assert.deepEqual(requests[0].thinking, { type: "disabled" });
      assert.equal(requests[0].max_tokens, 2048);
      assert.ok(!JSON.stringify(requests).includes("test-request-value"));
    } finally {
      session.dispose();
    }
  } finally {
    if (oldKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = oldKey;
  }
});
