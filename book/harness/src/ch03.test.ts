import { test } from "node:test";
import { validateToolArguments } from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkTrace, parseTrace, type CaseSpec } from "./check-trace.js";
import { toTraceRow } from "./trace.js";
import { helloTool, CUSTOM_TOOLS } from "./tools/hello.js";
import { createIsolatedPi, ISOLATION_FLAGS } from "./isolated-pi.js";

const cases = JSON.parse(readFileSync("cases/cases.json", "utf8")) as CaseSpec[];
const customCall = cases.find((c) => c.id === "custom-tool-call")!;
const conflict = cases.find((c) => c.id === "custom-tool-schema-conflict")!;
const fixture = parseTrace(readFileSync("fixtures/custom-tool-call.trace.jsonl", "utf8"));

// --- schema vs executor ---

test("hello schema: name is a required string", () => {
  const schema = helloTool.parameters as { properties: Record<string, { type: string }>; required: string[] };
  assert.equal(schema.properties.name.type, "string");
  assert.deepEqual(schema.required, ["name"]);
});

test("hello executor: greets and reports the type it actually received", async () => {
  const result = await helloTool.execute("c1", { name: "学员" }, undefined, undefined, undefined as never);
  assert.deepEqual(result.content, [{ type: "text", text: "Hello, 学员!" }]);
  assert.equal((result.details as { receivedType: string }).receivedType, "string");
});

test("CUSTOM_TOOLS registry only contains hello in ch03", () => {
  assert.deepEqual(CUSTOM_TOOLS.map((t) => t.name), ["hello"]);
});

// --- cases ---

test("cases: custom-tool-call and schema-conflict expect a string name", () => {
  for (const spec of [customCall, conflict]) {
    assert.deepEqual(spec.allowed_tools, ["hello"]);
    assert.deepEqual(spec.expect.arg_types, { name: "string" });
  }
});

// --- trace + checker ---

test("toTraceRow records tool args and assistant final text", () => {
  const start = toTraceRow({ type: "tool_execution_start", toolName: "hello", toolCallId: "c1", args: { name: "123" } });
  assert.deepEqual(start.args, { name: "123" });
  const end = toTraceRow({
    type: "message_end",
    message: { role: "assistant", content: [{ type: "text", text: "我传的是数字" }] },
  });
  assert.equal(end.text, "我传的是数字");
});

test("checkTrace: fixture passes custom-tool-call", () => {
  assert.deepEqual(checkTrace(fixture, customCall), { pass: true, reasons: [] });
});

test("checkTrace: numeric name violates arg_types even if the answer claims success", () => {
  const rows = fixture.map((r) =>
    r.eventType === "tool_execution_start" ? { ...r, args: { name: 123 } } : r,
  );
  assert.match(checkTrace(rows, conflict).reasons.join(), /arg name is number/);
});

test("checkTrace: answering without calling hello fails", () => {
  const rows = fixture.filter((r) => !String(r.eventType).startsWith("tool_execution"));
  assert.match(checkTrace(rows, customCall).reasons.join(), /tool hello not called/);
});

// --- isolation from global ~/.pi ---

test("isolation flags turn off every global resource", () => {
  assert.deepEqual(ISOLATION_FLAGS, {
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });
});

test("createIsolatedPi: only repo models, no extensions/skills/context files", async () => {
  const { modelRuntime, resourceLoader, agentDir } = await createIsolatedPi(process.cwd());
  assert.ok(agentDir.endsWith("/pi-agent"));
  assert.deepEqual(
    modelRuntime.getModels("ollama").map((m) => m.id),
    ["qwen3.8:27b"],
  );
  assert.equal(resourceLoader.getExtensions().extensions.length, 0);
  assert.equal(resourceLoader.getSkills().skills.length, 0);
  assert.equal(resourceLoader.getPrompts().prompts.length, 0);
  assert.equal(resourceLoader.getAgentsFiles().agentsFiles.length, 0);
});

// --- 招牌实验的确定性部分：pi 在 executor 之前会做类型转换 ---

test("pi coerces a numeric name to string before the executor runs", () => {
  const raw = { type: "toolCall" as const, id: "c1", name: "hello", arguments: { name: 123 } };
  const validated = validateToolArguments(helloTool as never, raw as never) as { name: unknown };
  assert.equal(validated.name, "123"); // executor 看到的是字符串
  assert.equal(raw.arguments.name, 123); // 原始 toolCall 不被改写：trace 的 start.args 仍是模型原话
});

test("toTraceRow records executor details on tool_execution_end", () => {
  const row = toTraceRow({
    type: "tool_execution_end",
    toolName: "hello",
    toolCallId: "c1",
    isError: false,
    result: { content: [], details: { greeted: "123", receivedType: "string" } },
  });
  assert.deepEqual(row.details, { greeted: "123", receivedType: "string" });
});
