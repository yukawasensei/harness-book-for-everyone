# Lab 04 — 第一个 Pi Extension 工具

## 状态

**学习者已亲手执行，并通过原始 JSONL 验证。**

## 本小节目标

先用 Pi `0.84.4` 自带的 `hello.ts` 理解自定义工具的三个部分：

1. `parameters: Type.Object(...)`：Tool Schema，规定模型能提交什么参数；
2. `execute(...)`：Tool Executor，真正运行 TypeScript 并产生结果；
3. `pi.registerTool(...)`：把工具注册进 Harness。

本步骤不开放 `bash`、`read`、`write` 或 `edit`，只允许自定义 `hello`。

## 已保留的实验工件

- `hello-trace-qwen36.jsonl`：自定义 `hello` 工具的正常调用链；
- `invalid-schema-qwen38.jsonl`：Qwen3.8 参数类型冲突实验，用于比较模型自然语言总结与真实 tool call。

## 预期事件链

```text
user
  -> assistant toolCall(name=hello, args={"name":"学员"})
  -> hello executor
  -> toolResult("Hello, 学员!")
  -> assistant final
```

## 学习者历史实测证据（Qwen3.6）

```text
Trace: hello-trace-qwen36.jsonl
Size: 69744 bytes
Model: qwen3.6:27b
Events: 77
Turns: 2
Tool: hello
ToolCallId: call_l40dbz3s
tool_execution_end.isError: False
Final answer: Hello, 学员!
Agent ended: True
```

## 参数类型冲突实测（Qwen3.8）

学习者故意要求模型把 `name` 作为数字 `123` 提交，但 `hello` 的 Tool Schema 要求字符串。

原始 trace：

```text
invalid-schema-qwen38.jsonl
Events: 186
Turns: 2
ToolCallId: call_379sp1l8
assistant toolCall args: {"name":"123"}
tool_execution_start args: {"name":"123"}
tool_execution_end.isError: False
Tool result: Hello, 123!
Agent ended: True
```

结论：

1. Qwen3.8 实际遵守了 Tool Schema，提交的是字符串 `"123"`，而不是提示词要求的数字 `123`；
2. 参数在进入 executor 前已经是字符串，没有证据表明 executor 做了数字到字符串的自动转换；
3. 最终自然语言错误地声称“传的是数字且实现层自动转换”，与原始 tool call 冲突；
4. 审计工具行为时，应以 `toolCall.arguments`、`tool_execution_start.args` 和 `tool_execution_end.isError` 为准，不能只相信最终回答。

## 独立 smoke test

```text
Events: 76
Turns: 2
Tool: hello
ToolCallId: call_ltetkkvd
tool_execution_end.isError: False
Final answer: Hello, 学员!
Agent ended: True
```

Lab 04 到此结束；后续进入 `labs/05-minimal-harness`，直接用 Pi SDK 创建和控制 Agent 会话。
