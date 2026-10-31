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
import {
  buildPaddingMessage,
  estimateContextChars,
  parseContextBudgetChars,
  parseContextBudgetPolicy,
  parseInjectContextChars,
  shouldStopForContextBudget,
} from "./context-budget.js";
import {
  createRetryBudgetGuard,
  decideOnRetryExhausted,
  parseInjectToolFailures,
  parseMaxRetries,
  parseOnRetryExhausted,
  parseRetryBackoffMs,
} from "./retry-budget.js";
import {
  createHitlGate,
  parseHitlRequiredTools,
  parseHitlTimeoutMs,
  parseInjectHitlDecision,
} from "./hitl-gate.js";
import {
  createCostLatencyBudgetGuard,
  parseCostBudgetUnits,
  parseInjectCostUnits,
  parseInjectElapsedMs,
  parseLatencyBudgetMs,
} from "./cost-latency-budget.js";

const cwd = process.cwd();

if (process.platform !== "linux") {
  throw new Error("Lab 05 must run inside WSL2/Linux, not Windows");
}

const inputPath = resolve(cwd, "lesson-input.md");
const traceDirectory = resolve(cwd, "traces");
const tracePath = resolve(traceDirectory, "latest.jsonl");
const maxTurns = parseMaxTurns(process.env.MAX_TURNS);
const toolTimeoutMs = parseToolTimeoutMs(process.env.TOOL_TIMEOUT_MS);
const contextBudgetChars = parseContextBudgetChars(process.env.CONTEXT_BUDGET_CHARS);
const contextBudgetPolicy = parseContextBudgetPolicy(process.env.CONTEXT_BUDGET_POLICY);
const injectContextChars = parseInjectContextChars(process.env.EVAL_INJECT_CONTEXT_CHARS);
const maxRetries = parseMaxRetries(process.env.MAX_RETRIES);
const retryBackoffMs = parseRetryBackoffMs(process.env.RETRY_BACKOFF_MS);
const onRetryExhausted = parseOnRetryExhausted(process.env.ON_RETRY_EXHAUSTED);
const injectToolFailures = parseInjectToolFailures(process.env.EVAL_INJECT_TOOL_FAILURES);
const hitlRequiredTools = parseHitlRequiredTools(process.env.HITL_REQUIRED_TOOLS);
const hitlTimeoutMs = parseHitlTimeoutMs(process.env.HITL_TIMEOUT_MS);
const injectHitlDecision = parseInjectHitlDecision(process.env.EVAL_INJECT_HITL);
const costBudgetUnits = parseCostBudgetUnits(process.env.COST_BUDGET_UNITS);
const latencyBudgetMs = parseLatencyBudgetMs(process.env.LATENCY_BUDGET_MS);
const injectCostUnits = parseInjectCostUnits(process.env.EVAL_INJECT_COST_UNITS);
const injectElapsedMs = parseInjectElapsedMs(process.env.EVAL_INJECT_ELAPSED_MS);
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

const runState: {
  stopReason: StopReason;
  toolTimedOut: boolean;
  pathDenied: boolean;
  contextBudgetHit: boolean;
  retryExhausted: boolean;
  humanDenied: boolean;
  awaitingHuman: boolean;
  costBudgetHit: boolean;
  latencyBudgetHit: boolean;
} = {
  stopReason: "success",
  toolTimedOut: false,
  pathDenied: false,
  contextBudgetHit: false,
  retryExhausted: false,
  humanDenied: false,
  awaitingHuman: false,
  costBudgetHit: false,
  latencyBudgetHit: false,
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
  if (runState.toolTimedOut || runState.pathDenied || runState.contextBudgetHit || runState.retryExhausted || runState.humanDenied || runState.awaitingHuman || runState.costBudgetHit || runState.latencyBudgetHit) {
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
  `[harness] tools=${allowedTools.join(",")} session=memory maxTurns=${maxTurns} toolTimeoutMs=${toolTimeoutMs || "off"} contextBudgetChars=${contextBudgetChars || "off"} policy=${contextBudgetPolicy} maxRetries=${maxRetries} onExhausted=${onRetryExhausted} hitlInject=${injectHitlDecision ?? "off"} costBudget=${costBudgetUnits || "off"} latencyBudgetMs=${latencyBudgetMs || "off"}`,
);
console.error(`[harness] trace=${tracePath}`);





// Deterministic cost/latency budget probe (does not depend on the model).
// Soft prompt "keep going a bit" cannot raise COST_BUDGET_UNITS / LATENCY_BUDGET_MS.
if (injectCostUnits > 0 || injectElapsedMs > 0 || costBudgetUnits > 0 || latencyBudgetMs > 0) {
  const budgetGuard = createCostLatencyBudgetGuard({
    costBudgetUnits,
    latencyBudgetMs,
  });
  if (injectCostUnits > 0) {
    budgetGuard.recordUsage(injectCostUnits);
  }
  if (injectElapsedMs > 0) {
    budgetGuard.recordElapsed(injectElapsedMs);
  } else {
    budgetGuard.recordElapsed(Math.max(0, Math.round(performance.now() - runStartedAt)));
  }
  const decided = budgetGuard.check();
  writeTrace({
    timestamp: new Date().toISOString(),
    eventType: "budget_check",
    costBudgetUnits,
    latencyBudgetMs,
    usedUnits: budgetGuard.usedUnits,
    elapsedMs: budgetGuard.elapsedMs,
    injectCostUnits,
    injectElapsedMs,
    stop: decided.stop,
    stop_reason: decided.stopReason,
  });
  if (decided.stop && decided.stopReason) {
    if (decided.stopReason === "cost_budget") {
      runState.costBudgetHit = true;
    } else {
      runState.latencyBudgetHit = true;
    }
    runState.stopReason = decided.stopReason;
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "harness_stop",
      stop_reason: decided.stopReason,
      usedUnits: budgetGuard.usedUnits,
      elapsedMs: budgetGuard.elapsedMs,
      costBudgetUnits,
      latencyBudgetMs,
    });
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "harness_end",
      stop_reason: decided.stopReason,
      turnCount: maxTurnsGuard.completedTurnCount,
      maxTurns,
      toolTimeoutMs,
      usedUnits: budgetGuard.usedUnits,
      elapsedMs: budgetGuard.elapsedMs,
      costBudgetUnits,
      latencyBudgetMs,
    });
    const durationMs = Math.round(performance.now() - runStartedAt);
    console.error(
      `[harness] status=${decided.stopReason} events=${eventCount} usedUnits=${budgetGuard.usedUnits}/${costBudgetUnits || "off"} elapsedMs=${budgetGuard.elapsedMs}/${latencyBudgetMs || "off"} durationMs=${durationMs}`,
    );
    process.exitCode = 2;
    unsubscribe();
    session.dispose();
    process.exit(process.exitCode ?? 0);
  }
}

// Deterministic HITL confirm-gate probe (does not depend on the model).
// Soft prompt "I already have approval" cannot bypass HITL_REQUIRED_TOOLS.
if (injectHitlDecision) {
  const hitlGate = createHitlGate({
    requiredTools: hitlRequiredTools,
    timeoutMs: hitlTimeoutMs,
  });
  const toolName = "confirm_gate";
  writeTrace({
    timestamp: new Date().toISOString(),
    eventType: "hitl_request",
    toolName,
    toolCallId: "eval-hitl-1",
    requiredTools: hitlRequiredTools,
    hitlTimeoutMs,
    injectedDecision: injectHitlDecision,
  });
  writeTrace({
    timestamp: new Date().toISOString(),
    eventType: "tool_execution_start",
    toolName,
    toolCallId: "eval-hitl-1",
    injected: true,
    awaitingHitl: true,
  });
  toolCallCount += 1;
  const outcome = hitlGate.resolve(toolName, injectHitlDecision);
  writeTrace({
    timestamp: new Date().toISOString(),
    eventType: "hitl_decision",
    toolName,
    decision: injectHitlDecision,
    allow: outcome.allow,
    stop_reason: outcome.stopReason,
  });
  if (!outcome.allow && outcome.stopReason) {
    if (outcome.stopReason === "human_denied") {
      runState.humanDenied = true;
    } else {
      runState.awaitingHuman = true;
    }
    runState.stopReason = outcome.stopReason;
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "tool_execution_end",
      toolName,
      toolCallId: "eval-hitl-1",
      isError: true,
      injected: true,
      error: `hitl ${injectHitlDecision}`,
      stop_reason: outcome.stopReason,
    });
    toolErrorCount += 1;
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "harness_stop",
      stop_reason: outcome.stopReason,
      toolName,
      decision: injectHitlDecision,
    });
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "harness_end",
      stop_reason: outcome.stopReason,
      turnCount: maxTurnsGuard.completedTurnCount,
      maxTurns,
      toolTimeoutMs,
      hitlDecision: injectHitlDecision,
      requiredTools: hitlRequiredTools,
    });
    const durationMs = Math.round(performance.now() - runStartedAt);
    console.error(
      `[harness] status=${outcome.stopReason} events=${eventCount} tool=${toolName} decision=${injectHitlDecision} durationMs=${durationMs}`,
    );
    process.exitCode = 2;
    unsubscribe();
    session.dispose();
    process.exit(process.exitCode ?? 0);
  }
  // approve path: record end of gated tool and continue into remaining probes / model.
  writeTrace({
    timestamp: new Date().toISOString(),
    eventType: "tool_execution_end",
    toolName,
    toolCallId: "eval-hitl-1",
    isError: false,
    injected: true,
    hitlApproved: true,
  });
}

// Deterministic retry-budget probe (does not depend on the model).
// Soft prompt "please try again" cannot override MAX_RETRIES.
if (injectToolFailures) {
  const retryGuard = createRetryBudgetGuard({
    maxRetries,
    backoffMs: retryBackoffMs,
    onExhausted: onRetryExhausted,
  });
  writeTrace({
    timestamp: new Date().toISOString(),
    eventType: "retry_budget_start",
    maxRetries,
    retryBackoffMs,
    onRetryExhausted,
  });
  let attempt = 0;
  for (;;) {
    attempt += 1;
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "tool_execution_start",
      toolName: "flaky",
      toolCallId: `eval-flaky-${attempt}`,
      injected: true,
      attempt,
    });
    // Simulated permanent failure for the teaching probe.
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "tool_execution_end",
      toolName: "flaky",
      toolCallId: `eval-flaky-${attempt}`,
      isError: true,
      injected: true,
      error: "injected flaky failure",
      attempt,
    });
    toolCallCount += 1;
    toolErrorCount += 1;
    const decision = retryGuard.recordFailure();
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "retry_decision",
      failureCount: retryGuard.failureCount,
      maxRetries,
      retry: decision.retry,
      backoffMs: decision.backoffMs,
      exhausted: decision.exhausted,
    });
    if (!decision.retry) {
      const decided = decideOnRetryExhausted(onRetryExhausted);
      runState.retryExhausted = true;
      runState.stopReason = decided.stopReason;
      writeTrace({
        timestamp: new Date().toISOString(),
        eventType: "harness_stop",
        stop_reason: decided.stopReason,
        degrade: decided.degrade,
        failureCount: retryGuard.failureCount,
        maxRetries,
        attempts: attempt,
      });
      writeTrace({
        timestamp: new Date().toISOString(),
        eventType: "harness_end",
        stop_reason: decided.stopReason,
        degrade: decided.degrade,
        turnCount: maxTurnsGuard.completedTurnCount,
        maxTurns,
        toolTimeoutMs,
        maxRetries,
        failureCount: retryGuard.failureCount,
        attempts: attempt,
      });
      const durationMs = Math.round(performance.now() - runStartedAt);
      console.error(
        `[harness] status=retry_exhausted events=${eventCount} attempts=${attempt} maxRetries=${maxRetries} degrade=${decided.degrade} durationMs=${durationMs}`,
      );
      process.exitCode = 2;
      unsubscribe();
      session.dispose();
      process.exit(process.exitCode ?? 0);
    }
    if (decision.backoffMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, decision.backoffMs));
    }
  }
}

// Deterministic context-budget probe for evals (does not depend on the model).
// Soft prompt "please keep all history" cannot override CONTEXT_BUDGET_CHARS.
if (injectContextChars > 0 || contextBudgetChars > 0) {
  const promptPreview =
    process.env.EVAL_PROMPT?.trim()
    || "必须调用 read 工具读取 lesson-input.md，然后只根据文件内容，用一句中文说明 Harness 的职责。";
  const synthetic = [
    buildPaddingMessage(injectContextChars),
    { role: "user", content: promptPreview },
  ];
  const estimatedChars = estimateContextChars(synthetic);
  writeTrace({
    timestamp: new Date().toISOString(),
    eventType: "context_budget_check",
    estimatedChars,
    contextBudgetChars,
    injectContextChars,
    policy: contextBudgetPolicy,
  });
  if (
    contextBudgetPolicy === "stop"
    && shouldStopForContextBudget(estimatedChars, contextBudgetChars)
  ) {
    runState.contextBudgetHit = true;
    runState.stopReason = "context_budget";
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "harness_stop",
      stop_reason: "context_budget",
      estimatedChars,
      contextBudgetChars,
      injectContextChars,
      policy: contextBudgetPolicy,
    });
    writeTrace({
      timestamp: new Date().toISOString(),
      eventType: "harness_end",
      stop_reason: "context_budget",
      turnCount: maxTurnsGuard.completedTurnCount,
      maxTurns,
      toolTimeoutMs,
      estimatedChars,
      contextBudgetChars,
      injectContextChars,
      policy: contextBudgetPolicy,
    });
    const durationMs = Math.round(performance.now() - runStartedAt);
    console.error(
      `[harness] status=context_budget events=${eventCount} estimatedChars=${estimatedChars} budget=${contextBudgetChars} inject=${injectContextChars} durationMs=${durationMs}`,
    );
    process.exitCode = 2;
    unsubscribe();
    session.dispose();
    process.exit(process.exitCode ?? 0);
  }
}

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
    contextBudgetChars,
    injectContextChars,
    policy: contextBudgetPolicy,
  });

  const durationMs = Math.round(performance.now() - runStartedAt);
  console.error(
    `[harness] status=${runState.stopReason} events=${eventCount} toolCalls=${toolCallCount} toolErrors=${toolErrorCount} turns=${maxTurnsGuard.completedTurnCount} maxTurns=${maxTurns} toolTimeoutMs=${toolTimeoutMs || "off"} contextBudgetChars=${contextBudgetChars || "off"} durationMs=${durationMs}`,
  );
  if (
    runState.stopReason === "max_turns"
    || runState.stopReason === "tool_timeout"
    || runState.stopReason === "path_denied"
    || runState.stopReason === "context_budget"
    || runState.stopReason === "retry_exhausted"
    || runState.stopReason === "human_denied"
    || runState.stopReason === "awaiting_human"
    || runState.stopReason === "cost_budget"
    || runState.stopReason === "latency_budget"
  ) {
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
