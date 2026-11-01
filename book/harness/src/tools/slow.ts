// Ch4 · 演示工具：按要求睡一会儿。它自己没有任何超时逻辑——超时由 harness 加上。
import { setTimeout as sleep } from "node:timers/promises";
import { Type } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-coding-agent";

export const slowTool = defineTool({
  name: "slow",
  label: "Slow",
  description: "Sleep for delay_ms milliseconds, then return. 睡 delay_ms 毫秒后返回（演示超时用）。",
  parameters: Type.Object({
    delay_ms: Type.Integer({ minimum: 0, description: "How long to sleep, in ms. 睡多久（毫秒）" }),
  }),
  async execute(_toolCallId, params, signal) {
    await sleep(params.delay_ms, undefined, { signal });
    return { content: [{ type: "text", text: `slept ${params.delay_ms}ms` }], details: { delay_ms: params.delay_ms } };
  },
});
