// Ch7 · 演示工具：查片场天气。前 failTimes 次调用必定失败（模拟不稳定的外部服务）。
import { Type } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-coding-agent";

export function createFlakyTool(failTimes: number) {
  let calls = 0;
  return defineTool({
    name: "flaky",
    label: "Flaky weather",
    description: "Look up the weather at a filming location. 查询拍摄地天气（服务不稳定）。",
    parameters: Type.Object({ location: Type.String({ description: "Filming location. 拍摄地" }) }),
    async execute(_toolCallId, params) {
      calls += 1;
      if (calls <= failTimes) throw new Error(`weather service unavailable (call ${calls})`);
      return { content: [{ type: "text", text: `${params.location}: 晴，18°C，风力 2 级` }], details: { calls } };
    },
  });
}
