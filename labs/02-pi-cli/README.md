# Lab 02 — Pi CLI

目标：让 Pi 使用 Qwen3.6:27b 完成只读工具调用。当前课程的推理、Agent 与后续训练主线统一基于 Qwen3.6。

初始工具 allowlist：

```text
read,grep,find,ls
```

禁止：

```text
bash,edit,write
```
