import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import {
  createMaxTurnsGuard,
  parseMaxTurns,
  type StopReason,
} from "./max-turns.js";
import { parseAllowedTools } from "./parse-allowed-tools.js";
import { parseToolTimeoutMs } from "./tool-timeout.js";

const cwd = process.cwd();

if (process.platform !== "linux") {
  throw new Error("Lab 05 must run inside WSL2/Linux, not Windows");
}

const inputPath = resolve(cwd, "lesson-input.md");
const traceDirectory = resolve(cwd, "traces");
const tracePath = resolve(traceDirectory, "latest.jsonl");
const maxTurns = parseMaxTurns(process.env.MAX_TURNS);
const toolTimeoutMs = parseToolTimeoutMs(process.env.TOOL_TIMEOUT_MS);
const allowedTools = parseAllowedTools(
  process.env.EVAL_ALLOWED_TOOLS ?? process.env.ALLOWED_TOOLS,
);

if (!existsSync(inputPath)) {
  throw new Error(`Run this lab from its package directory; missing ${inputPath}`);
}

mkdirSync(traceDirectory, { recursive: true });
writeFileSync(tracePath, "", "utf8");

const modelRuntime = await ModelRuntime.create();
const model = modelRuntime.getModel("ollama", "qwen3.8:27b");

if (!model) {
  throw new Error("Model ollama/qwen3.8:27b is not configured in ~/.pi/agent/models.json");
}

const runState: { stopReason: StopReason; toolTimedOut: boolean; pathDenied: boolean } = {
  stopReason: "success",
  toolTimedOut: false,
  pathDenied: false,
};

const customTools = [];
// Same-name customTools override builtins in pi AgentSession registry.
if (allowedTools.includes("read")) {
  const { createSandboxedReadTool } = await import("./sandboxed-read.js");
  customTools.push(
    createSandboxedReadTool({
      workspaceRoot: cwd,
      onDenied: (info) => {
        runState.pathDenied = true;
        runState.stopReason = "path_denied";
        writeTrace({
          timestamp: new Date().toISOString(),
          eventType: "harness_stop",
          stop_reason: "path_denied",
          requestedPath: info.requestedPath,
          resolvedPath: info.resolvedPath,
          workspaceRoot: info.workspaceRoot,
        });
      },
    }),
  );
}
if (allowedTools.includes("slow")) {
  const { createSlowTool } = await import("./slow-tool.js");
  customTools.push(
    createSlowTool({
      timeoutMs: toolTimeoutMs,
      onTimeout: (ms) => {
        runState.toolTimedOut = true;
        runState.stopReason = "tool_timeout";
        writeTrace({
          timestamp: new Date().toISOString(),
          eventType: "harness_stop",
          stop_reason: "tool_timeout",
          timeoutMs: ms,
        });
      },
    }),
  );
}

const { session } = await createAgentSession({
  cwd,
  model,
  modelRuntime,
  thinkingLevel: "off",
  tools: allowedTools,
  customTools,
  sessionManager: SessionManager.inMemory(cwd),
});

const runStartedAt = performance.now();
const toolStartedAt = new Map<string, number>();
const maxTurnsGuard = createMaxTurnsGuard(maxTurns);
let eventCount = 0;
let toolCallCount = 0;
let toolErrorCount = 0;

function writeTrace(row: Record<string, unknown>): void {
  appendFileSync(tracePath, `${JSON.stringify(row)}\n`, "utf8");
}

// Official pi-agent-core hook: after each completed turn, decide whether to continue.
session.agent.shouldStopAfterTurn = async () => {
  if (runState.toolTimedOut || runState.pathDenied) {
    return true;
  }
  const stop = maxTurnsGuard.recordCompletedTurn();
  writeTrace({
    timestamp: new Date().toISOString(),
    eventType: "turn_guard",
    turnCount: maxTurnsGuard.completedTurnCount,
    maxTurns,
  });
  if (stop) {
    runState.stopReason = "max_turns";
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "harness_stop",
      stop_reason: "max_turns",
      turnCount: maxTurnsGuard.completedTurnCount,
      maxTurns,
    });
  }
  return stop;
};

// After a tool times out, mark isError + ask the loop to terminate this batch.
session.agent.afterToolCall = async (context) => {
  if (runState.pathDenied) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "Harness path sandbox denied this path. stop_reason=path_denied",
        },
      ],
      details: {
        ...(context.result.details as object),
        pathDenied: true,
        stop_reason: "path_denied",
      },
      terminate: true,
    };
  }
  if (!runState.toolTimedOut) {
    return undefined;
  }
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `Harness tool timeout (${toolTimeoutMs}ms). stop_reason=tool_timeout`,
      },
    ],
    details: { ...(context.result.details as object), timedOut: true, stop_reason: "tool_timeout" },
    terminate: true,
  };
};

const unsubscribe = session.subscribe((event) => {
  eventCount += 1;

  const row: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    eventType: event.type,
  };

  if (event.type === "message_start" || event.type === "message_end") {
    row.role = event.message.role;
  }

  if (event.type === "tool_execution_start") {
    toolCallCount += 1;
    toolStartedAt.set(event.toolCallId, performance.now());
    row.toolName = event.toolName;
    row.toolCallId = event.toolCallId;
  }

  if (event.type === "tool_execution_end") {
    const startedAt = toolStartedAt.get(event.toolCallId);
    row.toolName = event.toolName;
    row.toolCallId = event.toolCallId;
    row.isError = event.isError;
    row.durationMs = startedAt === undefined
      ? null
      : Math.round(performance.now() - startedAt);

    if (event.isError) {
      toolErrorCount += 1;
    }
  }

  writeTrace(row);

  if (
    event.type === "message_update"
    && event.assistantMessageEvent.type === "text_delta"
  ) {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

console.error(`[harness] runtime=${process.platform} model=${model.provider}/${model.id}`);
console.error(
  `[harness] tools=${allowedTools.join(",")} session=memory maxTurns=${maxTurns} toolTimeoutMs=${toolTimeoutMs || "off"}`,
);
console.error(`[harness] trace=${tracePath}`);

// Deterministic path-sandbox probe for evals (does not depend on the model calling read).
const injectReadPath = process.env.EVAL_INJECT_READ_PATH?.trim();
if (injectReadPath) {
  const sandboxed = customTools.find((tool) => tool.name === "read");
  if (!sandboxed || typeof sandboxed.execute !== "function") {
    throw new Error("EVAL_INJECT_READ_PATH set but sandboxed read tool is not registered");
  }
  const probeId = "eval-inject-read";
  writeTrace({
    timestamp: new Date().toISOString(),
    eventType: "tool_execution_start",
    toolName: "read",
    toolCallId: probeId,
    injected: true,
    path: injectReadPath,
  });
  try {
    await sandboxed.execute(probeId, { path: injectReadPath }, undefined, undefined, undefined);
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "tool_execution_end",
      toolName: "read",
      toolCallId: probeId,
      isError: false,
      injected: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "tool_execution_end",
      toolName: "read",
      toolCallId: probeId,
      isError: true,
      injected: true,
      error: message,
    });
    toolErrorCount += 1;
  }
  toolCallCount += 1;
  writeTrace({
    timestamp: new Date().toISOString(),
    eventType: "harness_end",
    stop_reason: runState.stopReason,
    turnCount: maxTurnsGuard.completedTurnCount,
    maxTurns,
    toolTimeoutMs,
    injectedReadPath: injectReadPath,
  });
  const durationMs = Math.round(performance.now() - runStartedAt);
  console.error(
    `[harness] status=${runState.stopReason} events=${eventCount} toolCalls=${toolCallCount} toolErrors=${toolErrorCount} turns=${maxTurnsGuard.completedTurnCount} maxTurns=${maxTurns} toolTimeoutMs=${toolTimeoutMs || "off"} durationMs=${durationMs} inject=${injectReadPath}`,
  );
  if (runState.stopReason === "path_denied") {
    process.exitCode = 2;
  }
  unsubscribe();
  session.dispose();
  process.exit(process.exitCode ?? 0);
}

try {
  const prompt =
    process.env.EVAL_PROMPT?.trim()
    || "必须调用 read 工具读取 lesson-input.md，然后只根据文件内容，用一句中文说明 Harness 的职责。";
  await session.prompt(prompt);
  process.stdout.write("\n");

  if (runState.stopReason === "success" && !runState.toolTimedOut) {
    runState.stopReason = "success";
  }

  writeTrace({
    timestamp: new Date().toISOString(),
    eventType: "harness_end",
    stop_reason: runState.stopReason,
    turnCount: maxTurnsGuard.completedTurnCount,
    maxTurns,
    toolTimeoutMs,
  });

  const durationMs = Math.round(performance.now() - runStartedAt);
  console.error(
    `[harness] status=${runState.stopReason} events=${eventCount} toolCalls=${toolCallCount} toolErrors=${toolErrorCount} turns=${maxTurnsGuard.completedTurnCount} maxTurns=${maxTurns} toolTimeoutMs=${toolTimeoutMs || "off"} durationMs=${durationMs}`,
  );
  if (runState.stopReason === "max_turns" || runState.stopReason === "tool_timeout" || runState.stopReason === "path_denied") {
    process.exitCode = 2;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (runState.toolTimedOut) {
    runState.stopReason = "tool_timeout";
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "harness_end",
      stop_reason: "tool_timeout",
      turnCount: maxTurnsGuard.completedTurnCount,
      maxTurns,
      toolTimeoutMs,
      error: message,
    });
    console.error(`[harness] status=tool_timeout error=${message}`);
    process.exitCode = 2;
  } else {
    runState.stopReason = "model_error";
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "harness_error",
      stop_reason: "model_error",
      error: message,
    });
    console.error(`[harness] status=model_error error=${message}`);
    process.exitCode = 1;
  }
} finally {
  unsubscribe();
  session.dispose();
}
