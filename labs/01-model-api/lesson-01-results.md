# 第一课实验报告：模型、上下文注入与 Agent 读取

## 环境

- 推理模型：Windows Ollama `qwen3.6:27b`
- Harness：WSL Pi
- 项目：`<repo-root>`

## 实验 A：裸模型，没有文件内容和工具

- 请求模型：`qwen3.6:27b`
- 响应模型：`qwen3.6:27b`
- 耗时：`8.270s`
- 结果：模型明确说明无法直接访问本地文件，并要求用户粘贴 Goal 内容。

结论：模型没有收到文件内容，也没有工具，因此没有真正读取 `README.md`。

## 实验 B：宿主 Python 注入文件内容

- 请求模型：`qwen3.6:27b`
- 响应模型：`qwen3.6:27b`
- 真正打开文件的组件：Python host program
- 注入内容：当前项目 `README.md`
- 耗时：`2.004s`
- 结果：模型准确复述了 Qwen3.6 课程 Goal。

结论：模型读到的是宿主程序放进 prompt 的文本，不是模型直接访问文件系统。

## 实验 C：Pi Agent 调用 read

- Trace：`experiment-c-agent-read.jsonl`
- Trace 事件：`124`
- 模型：`qwen3.6:27b`
- Agent turns：`2`
- 消息角色：`user -> assistant -> toolResult -> assistant`
- 工具：`read`
- ToolCallId：`call_ne8kk15a`
- `tool_execution_end.isError`：`False`
- 读取路径：`<repo-root>/README.md`

结论：Qwen3.6 生成结构化 `read` 请求；Pi Harness 验证并执行；read 执行器打开文件；Pi 创建 `toolResult`；Qwen3.6 在第二个 turn 生成最终答案。

## 三种文件访问方式

```text
A. 裸模型，无文件文本、无工具
   -> 无法读取

B. Python 先读取并注入 prompt
   -> Python 打开文件，模型只读取上下文

C. Qwen3.6 请求 read，Pi 执行
   -> 动态 Agent loop
```

## 验收

- 三个实验均由 Qwen3.6 真实重跑；
- A/B 的 Ollama 响应标记 `done=true`；
- C 存在完整工具 start/end，且 `isError=False`；
- 没有把模型生成的命令文本误认为真实执行。
