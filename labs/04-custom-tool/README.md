# Lab 04 — 第一个 Pi Extension 工具

## 状态

**学习者已亲手执行，并通过原始 JSONL 验证。**

## 本小节目标

先用 Pi `0.80.10` 自带的 `hello.ts` 理解自定义工具的三个部分：

1. `parameters: Type.Object(...)`：Tool Schema，规定模型能提交什么参数；
2. `execute(...)`：Tool Executor，真正运行 TypeScript 并产生结果；
3. `pi.registerTool(...)`：把工具注册进 Harness。

本步骤不开放 `bash`、`read`、`write` 或 `edit`，只允许自定义 `hello`。

## 你现在唯一的操作

在 WSL Zsh 中运行：

```bash
cd <repo-root>

pi --offline --provider ollama --model qwen3.6:27b \
  -e ~/.local/share/fnm/node-versions/v22.22.1/installation/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/hello.ts \
  --tools hello --mode json --no-session -p \
  "必须调用 hello 工具，参数 name=恒仔；最后只回答工具返回内容。" \
  > labs/04-custom-tool/hello-trace-qwen36.jsonl

python3 labs/03-agent-events/analyze_trace.py \
  labs/04-custom-tool/hello-trace-qwen36.jsonl
```

## 预期事件链

```text
user
  -> assistant toolCall(name=hello, args={"name":"恒仔"})
  -> hello executor
  -> toolResult("Hello, 恒仔!")
  -> assistant final
```

## 学习者实测证据

```text
Trace: hello-trace-qwen36.jsonl
Size: 69744 bytes
Model: qwen3.6:27b
Events: 77
Turns: 2
Tool: hello
ToolCallId: call_l40dbz3s
tool_execution_end.isError: False
Final answer: Hello, 恒仔!
Agent ended: True
```

## 恒仔的独立 smoke test

```text
Events: 76
Turns: 2
Tool: hello
ToolCallId: call_ltetkkvd
tool_execution_end.isError: False
Final answer: Hello, 恒仔!
Agent ended: True
```

用户执行后，再进入正式的 `workspace_stats`：统计项目目录，并测试正常路径、`../` 越界、目录不存在和符号链接逃逸。
