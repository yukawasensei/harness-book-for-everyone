import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { createIsolatedPi } from "./isolated-pi.js";
import { helloTool } from "./tools/hello.js";
import { rejectInvalidArguments } from "./gates/strict-schema.js";
import { rejectInvalidJsonWrite } from "./gates/json-write.js";
import { toTraceRow, type TraceRow } from "./trace.js";

// Real SDK loop, deterministic model messages: prove error delivery and recovery, no network.
for (const fix of ["schema", "json"] as const) {
  for (const enabled of [false, true]) {
    test(`${fix} gate ${enabled ? "on" : "off"}: real SDK executor effects and retry`, async (t) => {
      mkdirSync("traces", { recursive: true });
      const root = mkdtempSync(resolve("traces", "json-gate-test-"));
      t.after(() => rmSync(root, { recursive: true, force: true }));
      const file = resolve(root, "board.json");
      writeFileSync(file, '{"original":true}');
      const isolated = await createIsolatedPi(process.cwd());
      const model = isolated.modelRuntime.getModel("ollama", "qwen3.8:27b")!;
      const toolName = fix === "schema" ? "hello" : "write";
      let executions = 0;
      const { session } = await createAgentSession({ cwd: process.cwd(), ...isolated, model,
        tools: [toolName], customTools: fix === "schema" ? [{ ...helloTool, execute: async (...args) => {
          executions += 1;
          return helloTool.execute(...args);
        } }] : [], sessionManager: SessionManager.inMemory(process.cwd()) });
      const rows: TraceRow[] = [];
      session.subscribe(event => { rows.push(toTraceRow(event as unknown as { type: string })); });
      session.agent.beforeToolCall = async ({ toolCall, args }) => {
        if (!enabled) return undefined;
        return fix === "schema"
          ? rejectInvalidArguments(session.agent.state.tools[0], toolCall.id, toolCall.arguments, row => rows.push(row))
          : rejectInvalidJsonWrite(toolCall.name, toolCall.id, args, row => rows.push(row));
      };
      let requests = 0;
      session.agent.streamFunction = (_model, context) => {
        requests += 1;
        assert.ok(requests <= 3, "recovery must finish within three requests");
        if (requests === 2) {
          const result = context.messages.find(message => message.role === "toolResult");
          assert.equal(result?.role === "toolResult" && result.isError, enabled);
          if (enabled) assert.match(JSON.stringify(result), /Retry/i);
          if (fix === "schema") assert.equal(executions, enabled ? 0 : 1);
          else assert.equal(readFileSync(file, "utf8"), enabled ? '{"original":true}' : '{"shots":[}');
        }
        const stopReason = requests === 1 || (enabled && requests === 2) ? "toolUse" : "stop";
        const args: Record<string, string | number> = fix === "schema" ? { name: requests === 1 ? 123 : "123" }
          : { path: relative(process.cwd(), file), content: requests === 1 ? '{"shots":[}' : '{"shots":[]}' };
        const message: AssistantMessage = { role: "assistant", api: model.api, provider: model.provider,
          model: model.id, timestamp: Date.now(), stopReason,
          content: stopReason === "toolUse" ? [{ type: "toolCall", id: `c${requests}`, name: toolName, arguments: args }]
            : [{ type: "text", text: "done" }],
          usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
        const stream = createAssistantMessageEventStream();
        stream.push({ type: "done", reason: stopReason, message });
        return stream;
      };
      try {
        await session.prompt("Call the tool.");
        assert.deepEqual(rows.filter(row => row.eventType === "tool_execution_end").map(row => row.isError),
          enabled ? [true, false] : [false]);
        if (fix === "schema") assert.equal(executions, 1);
        else if (enabled) assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { shots: [] });
      } finally { session.dispose(); }
    });
  }
}
