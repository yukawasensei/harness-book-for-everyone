import assert from "node:assert/strict";
import { test } from "node:test";
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { createIsolatedPi } from "./isolated-pi.js";
import { slowTool } from "./tools/slow.js";
import { injectToolInventory } from "./tool-inventory.js";

test("H1: provider context names actual active tools; switch off adds no context", async () => {
  for (const enabled of [false, true]) {
    const isolated = await createIsolatedPi(process.cwd());
    const model = isolated.modelRuntime.getModel("ollama", "qwen3.8:27b")!;
    const { session } = await createAgentSession({ cwd: process.cwd(), ...isolated, model,
      tools: ["slow"], customTools: [slowTool], sessionManager: SessionManager.inMemory(process.cwd()) });
    let contextText = "";
    session.agent.streamFunction = (_model, context) => {
      contextText = JSON.stringify(context.messages);
      const message: AssistantMessage = { role: "assistant", api: model.api, provider: model.provider,
        model: model.id, timestamp: 0, stopReason: "stop", content: [{ type: "text", text: "done" }],
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      const stream = createAssistantMessageEventStream();
      stream.push({ type: "done", reason: "stop", message });
      return stream;
    };
    try {
      await injectToolInventory(session, enabled);
      await session.prompt("Which tools can you call?");
      assert.equal(contextText.includes("Actual available tools / 本次实际可用工具: slow"), enabled);
      assert.deepEqual(session.getActiveToolNames(), ["slow"]);
    } finally { session.dispose(); }
  }
});
