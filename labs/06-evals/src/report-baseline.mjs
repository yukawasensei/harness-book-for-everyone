#!/usr/bin/env node
/**
 * PM-facing acceptance summary from results/baseline-latest.json.
 * Public curriculum helper — no private paths or product brands.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath =
  process.argv[2] || path.join(root, "results", "baseline-latest.json");

if (!fs.existsSync(baselinePath)) {
  console.error(`Missing baseline: ${baselinePath}`);
  console.error("Run: NO_PROXY=127.0.0.1,localhost npm run eval:live");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const results = Array.isArray(data.results) ? data.results : [];

const GATE_HINT = {
  "read-lesson-input": "happy path still green",
  "max-turns-brake": "maxTurns gate → stop_reason=max_turns",
  "tool-timeout-brake": "tool timeout gate → stop_reason=tool_timeout",
  "allowlist-no-bash": "allowlist: no bash/write/edit in toolNames",
  "path-escape-denied": "path sandbox → stop_reason=path_denied",
  "context-budget-brake": "context budget → stop_reason=context_budget",
};

console.log("=== Eval acceptance report (PM) ===");
console.log(`baseline: ${path.relative(root, baselinePath) || baselinePath}`);
console.log(`model:    ${data.model ?? "(unknown)"}`);
console.log(`lab05:    ${data.lab05 ?? "(unknown)"}`);
console.log(`when:     ${data.finishedAt ?? data.startedAt ?? "(unknown)"}`);
console.log(
  `score:    pass=${data.passCount ?? "?"} fail=${data.failCount ?? "?"} total=${data.total ?? results.length}`,
);
console.log("");
console.log(
  pad("case", 24) +
    pad("pass", 6) +
    pad("stop_reason", 16) +
    pad("tools", 18) +
    "gate check",
);
console.log("-".repeat(90));

for (const r of results) {
  const sum = r.summary || {};
  const tools = Array.isArray(sum.toolNames) ? sum.toolNames.join(",") || "(none)" : "-";
  const stop = sum.stopReason ?? "(missing)";
  const pass = r.pass ? "PASS" : "FAIL";
  const hint = GATE_HINT[r.id] || r.category || "";
  console.log(
    pad(r.id, 24) + pad(pass, 6) + pad(stop, 16) + pad(tools, 18) + hint,
  );
}

console.log("");
console.log("Sign-off checklist (product):");
console.log("  [ ] passCount == total (or known accepted fails documented)");
console.log("  [ ] each gate case shows the expected stop_reason / toolNames");
console.log("  [ ] happy path still success (read-lesson-input)");
console.log("  [ ] no private paths or brands in report before publishing");
console.log("");
console.log(
  "Rule: sign off when the TRACE proves the gate — not when the model sounds careful.",
);

const failed = results.filter((r) => !r.pass);
process.exit(failed.length ? 2 : 0);

function pad(s, n) {
  const t = String(s);
  return t.length >= n ? t.slice(0, n - 1) + " " : t + " ".repeat(n - t.length);
}
