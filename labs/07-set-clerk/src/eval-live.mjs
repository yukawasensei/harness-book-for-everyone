#!/usr/bin/env node
/**
 * Optional live eval: MODEL=ollama against local Ollama/qwen, then same schema/path/Trace gate.
 * Without Ollama → SKIP (exit 0). Stubs remain the CI gate via npm test / eval:schema.
 *
 * Tip: set NO_PROXY=127.0.0.1,localhost so proxies do not hijack loopback.
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureOllamaReachable, noProxyEnv, ollamaConfig } from "./model-adapter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(__dirname, "..");

Object.assign(process.env, noProxyEnv());

const status = await ensureOllamaReachable();
if (!status.ok) {
  console.log("SKIP  eval:live — Ollama not reachable; stubs remain the acceptance gate.");
  console.log(`HINT  start Ollama at ${status.host}, then:`);
  console.log("      NO_PROXY=127.0.0.1,localhost MODEL=ollama npm run eval:live");
  if (status.error) console.log(`DETAIL ${status.error}`);
  process.exit(0);
}

const { model } = ollamaConfig();
if (!status.modelPresent) {
  console.log(
    `SKIP  eval:live — model ${model} not listed; have=${JSON.stringify(status.names)}`,
  );
  console.log(`HINT  ollama pull ${model}   (or set OLLAMA_MODEL to an installed tag)`);
  process.exit(0);
}

console.log(`[live] ollama=up model=${model} host=${status.host}`);
console.log("[live] running pipeline with MODEL=ollama (same schema/path/Trace as stubs)");

function runNode(args) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, args, {
      cwd: labRoot,
      env: {
        ...noProxyEnv(),
        MODEL: "ollama",
        SET_CLERK_BACKEND: "ollama",
      },
      stdio: "inherit",
    });
    child.on("close", (code, signal) => resolvePromise({ code: code ?? 1, signal }));
  });
}

const pipeline = await runNode(["src/run-all.mjs"]);
if (pipeline.code !== 0) {
  console.error("FAIL  live pipeline (run-all) non-zero");
  process.exit(pipeline.code || 1);
}

const validate = await runNode(["src/validate-schema.mjs"]);
if (validate.code !== 0) {
  console.error("FAIL  live validate-schema — stubs contract broken (path/schema/Trace)");
  process.exit(validate.code || 1);
}

console.log("\nPASS  eval:live — model outputs satisfied schema/path/Trace");
