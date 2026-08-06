# 第二课实验报告：Pi CLI、Tool Schema 与 allowlist

## 目标

在同一个 Qwen3.6 模型、任务、工作目录和目标文件下，只改变工具 allowlist，对比模型能否真正读取文件。

## 环境

- 模型：Windows Ollama `qwen3.6:27b`
- Provider：`http://127.0.0.1:11434/v1`
- 目标文件：`labs/02-pi-cli/tool-schema-target.txt`
- 目标值：`BLUE-MANGO-7319`

## 唯一实验变量

```text
对照 A：--no-tools
对照 B：--tools read
```

## 对照 A：没有工具 Schema

- Trace：`lesson-02-no-tools.jsonl`
- 事件数：`58`
- Agent turns：`1`
- 工具调用次数：`0`
- 消息角色：`user -> assistant`
- 可见最终文本：空

结论：Qwen3.6 没有得到任何文件工具，trace 中不存在 `tool_execution_start`，因此没有读取目标文件。即使模型拒绝、猜测、输出命令或没有可见文本，都不构成工具执行。

## 对照 B：只允许 read

- Trace：`lesson-02-read-enabled.jsonl`
- 事件数：`95`
- Agent turns：`2`
- 工具调用次数：`1`
- 工具：`read`
- ToolCallId：`call_2fv20uef`
- 参数：`{"path":"<repo-root>/labs/02-pi-cli/tool-schema-target.txt"}`
- `tool_execution_end.isError`：`False`
- 消息角色：`user -> assistant -> toolResult -> assistant`
- 最终回答：`BLUE-MANGO-7319`

## 职责边界

- Qwen3.6：根据上下文与 Tool Schema 选择工具并生成参数；
- Pi Harness：注册/筛选工具、调用执行器、创建 `toolResult`、维护消息历史；
- read 执行器：真正通过文件系统 API 打开并读取文件；
- Tool Schema：只描述工具名称和参数，不会自己执行。

## 为什么是两个 turns

```text
Turn 1：Qwen3.6 输出 read toolCall
Harness：执行 read，创建 toolResult
Turn 2：Qwen3.6 读取 toolResult，输出最终答案
```

## 验收

- 两个对照均由 `qwen3.6:27b` 真实重跑；
- A 没有任何工具生命周期；
- B 的 start/end 使用同一 ToolCallId；
- B 的工具结束事件明确为 `isError=False`；
- 最终值与真实文件一致。
