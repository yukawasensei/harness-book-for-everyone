#!/usr/bin/env node
/**
 * Run all four skills in pipeline order (fixture → files under workspace/out).
 * Default backend = stub. Set MODEL=ollama to use local qwen via model-adapter.
 */
import { runPickTopic } from "./skills/pick_topic.mjs";
import { runDraftScript } from "./skills/draft_script.mjs";
import { runDraftBoard } from "./skills/draft_board.mjs";
import { runShotPrompts } from "./skills/shot_prompts.mjs";
import { assertUnderOutDir } from "./path-sandbox.mjs";
import { getBackend } from "./model-adapter.mjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(__dirname, "..");
const backend = getBackend();

function assertEscapeDenied() {
  let denied = false;
  try {
    assertUnderOutDir(labRoot, "../../etc/passwd");
  } catch (e) {
    if (e && e.code === "PATH_DENIED") denied = true;
  }
  if (!denied) {
    console.error("FAIL: path sandbox did not deny escape");
    process.exitCode = 1;
    return false;
  }
  console.log("ok  path-sandbox escape denied");
  return true;
}

assertEscapeDenied();
console.log(`backend=${backend}  (MODEL / SET_CLERK_BACKEND; default stub)`);

const steps = [
  () => runPickTopic({ caseId: "case-pick_topic", backend }),
  () => runDraftScript({ caseId: "case-draft_script", backend }),
  () => runDraftBoard({ caseId: "case-draft_board", backend }),
  () => runShotPrompts({ caseId: "case-shot_prompts", backend }),
];

for (const step of steps) {
  const r = await step();
  console.log(`ok  ${r.backend} ${r.relativePath} stop_reason=${r.stop_reason}`);
}

console.log(
  "\nPASS  pipeline wrote workspace/out/{topic.json,script.md,board.json,prompts.json}",
);
