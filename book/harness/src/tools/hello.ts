// Ch3 · 第一个自定义工具 / First custom tool
// Schema（parameters）：规定模型“能提交什么参数”——这是给模型看的合同。
// Executor（execute）：真正运行的 TypeScript——模型永远碰不到这段代码。
import { Type } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-coding-agent";

export const helloTool = defineTool({
  name: "hello",
  label: "Hello",
  description: "Greet a person by name. 按名字打招呼。",
  parameters: Type.Object({
    name: Type.String({ description: "Name to greet (string). 要问候的名字（字符串）" }),
  }),
  async execute(_toolCallId, params) {
    return {
      content: [{ type: "text", text: `Hello, ${params.name}!` }],
      // details 写进 trace：executor 实际收到的参数类型，是审计证据。
      details: { greeted: params.name, receivedType: typeof params.name },
    };
  },
});
