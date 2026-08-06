# Lab 03 — Qwen3.6 Agent Events

## 状态

**已由学习者执行，并通过真实 trace 验证。**

## 目标

使用 Pi 的 JSON 模式保存一条真实 trace，并在其中识别：

```text
user prompt
  -> model toolCall
  -> tool_execution_start
  -> tool_execution_end
  -> toolResult
  -> model final answer
  -> agent_end
```

## 当前唯一操作

在 WSL 的 Zsh 终端执行：

```bash
cd <repo-root>
pi --offline --provider ollama --model qwen3.6:27b \
  --tools read --mode json --no-session -p \
  "必须调用 read 工具读取 README.md，只回答 Goal 标题下的第一句话。不要修改文件。" \
  > labs/03-agent-events/session-qwen36.jsonl
```

本步骤只允许 `read`，没有开放 `bash`、`edit` 或 `write`。

## 执行后观察

先不要尝试读懂全部 JSON。只记录：

1. 命令是否回到提示符；
2. `session-qwen36.jsonl` 是否生成；
3. 文件是否非空。

## 本次实际证据

```text
Trace: session-qwen36.jsonl
文件大小: 266794 bytes
事件数: 195
Agent turns: 2
工具调用: read × 1
ToolCallId: call_sgpmndp1
tool_execution_end.isError: False
消息角色: user -> assistant -> toolResult -> assistant
终止事件: agent_end
```

本次重跑的模型字段均为 `qwen3.6:27b`，最终答案也来自更新后的 Qwen3.6 课程 Goal。

## 下一步：提取事件链

分析器已经通过单元测试，并在本次真实 trace 上验证。运行：

```bash
cd <repo-root>
python3 labs/03-agent-events/analyze_trace.py \
  labs/03-agent-events/session-qwen36.jsonl
```

观察相同的 `toolCallId` 如何连接 `tool_execution_start` 和 `tool_execution_end`。
