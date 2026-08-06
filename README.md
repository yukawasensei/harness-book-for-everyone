# Pi + Qwen Harness 学习项目

## Goal

从零开始，通过真实实验理解本地模型、工具调用、Agent loop、Harness、评测、数据制作和 QLoRA 微调，并最终把微调后的 Qwen3.6 模型重新接入同一套 Harness 做 A/B 对比。

## Architecture

```text
WSL Pi / Harness / Training
        |
        | OpenAI-compatible API
        v
http://127.0.0.1:11434/v1
        |
        v
Windows Ollama + Qwen3.6:27b + RTX 3090
```

## Learning order

1. 普通模型 API
2. Pi 只读工具调用
3. Agent JSONL 事件与循环
4. 自定义工具
5. Pi SDK 最小 Harness
6. 权限、超时、最大轮数与日志
7. 自动评测
8. Qwen3.6-27B QLoRA 可行性烟雾测试
9. Qwen3.6-27B 正式 QLoRA
10. Tool/Agent 轨迹和 A/B 测试

## Safety baseline

前两课只允许 `read,grep,find,ls`，禁止 `bash,edit,write`。Pi 不是安全沙箱；所有实验只在本项目目录进行。
