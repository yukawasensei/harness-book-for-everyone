#!/usr/bin/env node
/**
 * Run all four skill stubs in pipeline order (fixture → files under workspace/out).
 */
import { runPickTopic } from "./skills/pick_topic.mjs";
import { runDraftScript } from "./skills/draft_script.mjs";
import { runDraftBoard } from "./skills/draft_board.mjs";
import { runShotPrompts } from "./skills/shot_prompts.mjs";
import { assertUnderOutDir } from "./path-sandbox.mjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labRoot = resolve(__dirname, "..");

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

const steps = [
  () => runPickTopic({ caseId: "case-pick_topic" }),
  () => runDraftScript({ caseId: "case-draft_script" }),
  () => runDraftBoard({ caseId: "case-draft_board" }),
  () => runShotPrompts({ caseId: "case-shot_prompts" }),
];

assertEscapeDenied();

for (const step of steps) {
  const r = step();
  console.log(`ok  stub ${r.relativePath} stop_reason=${r.stop_reason}`);
}

console.log("\nPASS  stub pipeline wrote workspace/out/{topic.json,script.md,board.json,prompts.json}");
