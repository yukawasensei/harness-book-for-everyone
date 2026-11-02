import assert from "node:assert/strict";
import { test } from "node:test";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { createIsolatedPi } from "./isolated-pi.js";
import { createMaxTurnsGuard, finishTurnWhen } from "./gates/max-turns.js";
import { helloTool } from "./tools/hello.js";

// Use the real SDK loop with deterministic provider responses; no model/network needed.
async function runLoop(maxTurns: number, response: "toolUse" | "stop" | "error" | "aborted") {
  const isolated = await createIsolatedPi(process.cwd());
  const model = isolated.modelRuntime.getModel("ollama", "qwen3.8:27b")!;
  const { session } = await createAgentSession({
    cwd: process.cwd(),
    ...isolated,
    model,
    tools: ["hello"],
    customTools: [helloTool],
    sessionManager: SessionManager.inMemory(process.cwd()),
  });
  const guard = createMaxTurnsGuard(maxTurns);
  session.agent.finishTurn = finishTurnWhen(() => guard.recordTurn());
  let requests = 0;
  const tools: boolean[] = [];
  session.subscribe((event) => {
    if (event.type === "tool_execution_end") tools.push(event.isError);
  });
  session.agent.streamFunction = () => {
    requests += 1;
    // End eventually even if a broken guard lets another request through.
    const stopReason = requests > maxTurns ? "stop" : response;
    const message: AssistantMessage = {
      role: "assistant", api: model.api, provider: model.provider, model: model.id,
      timestamp: Date.now(), stopReason,
      content: stopReason === "toolUse"
        ? [{ type: "toolCall", id: `c${requests}`, name: "hello", arguments: { name: "reader" } }]
        : [{ type: "text", text: "done" }],
      usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    };
    const stream = createAssistantMessageEventStream();
    stream.push({ type: "start", partial: message });
    if (stopReason === "error" || stopReason === "aborted") {
      stream.push({ type: "error", reason: stopReason, error: message });
    } else {
      stream.push({ type: "done", reason: stopReason, message });
    }
    return stream;
  };
  try {
    await session.prompt("Run the greeting tool.");
    return { requests, completed: guard.completed, tools };
  } finally {
    session.dispose();
  }
}

for (const maxTurns of [1, 2]) {
  test(`pi 1.x finishTurn stops tool loop at ${maxTurns} turn(s)`, async () => {
    assert.deepEqual(await runLoop(maxTurns, "toolUse"), {
      requests: maxTurns, completed: maxTurns, tools: Array(maxTurns).fill(false),
    });
  });
}

test("pi 1.x finishTurn preserves a natural final answer without another request", async () => {
  assert.deepEqual(await runLoop(8, "stop"), { requests: 1, completed: 1, tools: [] });
});

for (const reason of ["error", "aborted"] as const) {
  test(`pi 1.x finishTurn does not count a ${reason} response as a completed turn`, async () => {
    assert.deepEqual(await runLoop(1, reason), { requests: 1, completed: 0, tools: [] });
  });
}
