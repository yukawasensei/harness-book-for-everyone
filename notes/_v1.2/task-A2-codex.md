# 任务 A2（codex，第 2 轮）：gemma4:26b 对照真跑

前提：任务 A 已验收；`ollama list` 中已有 `gemma4:26b`（总控负责下载）。先读 `notes/_v1.2/plan.md`。

## 要做
1. 用 `ollama show gemma4:26b` 确认 Capabilities 含 tools，把结果原文贴进汇报。
2. 在 `book/harness/pi-agent/models.json` 登记 `gemma4:26b`：reasoning 设为 false，contextWindow 和 maxTokens 与 qwen 项保持一致（只改模型这一个变量）。
3. `NO_PROXY=127.0.0.1,localhost MODEL_ID=gemma4:26b npm run eval -- --repeat 5`，结果写到 `evals/runs/<slug>/`。
4. 生成对照表 `evals/runs/compare-qwen3.8-27b-vs-gemma4-26b.md`：每条 case 两个模型的通过率，按“成功类”和“刹车/拒绝类”分组（分组依据是 case 的期望 stop_reason）；总耗时、单 case 耗时中位数；如有 token 数据也列出。

## 约束
不改 case、prompt、闸门；不碰 chapters 和 README；不 git add/commit；GPU 上同一时间只跑一个评测。

## 交回（完成后汇报一次就停下）
对照表路径和要点：哪些 case 在 gemma 上掉了、刹车/拒绝类是否全部守住、失败的典型 trace 路径（各 1–2 条）。
