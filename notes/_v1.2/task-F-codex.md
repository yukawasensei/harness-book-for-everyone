# 任务 F（codex）：DeepSeek 真跑 + 与 qwen 对照

前提：用户已把 key 写进 `book/harness/.env`。任务 E 已提交（7927ed8）。先读 `notes/_v1.2/plan.md`、`book/harness/src/eval/usage.md`、`book/harness/evals/runs/task-E-acceptance.md`。

## 要做
1. 冒烟：`MODEL_ID=deepseek/deepseek-flash CASES=read-happy npm run eval`。如果失败，交回真实的报错（key 已经脱敏），然后停下，不要继续。
2. 全量：`MODEL_ID=deepseek/deepseek-flash npm run eval -- --repeat 5`。
3. 生成对照表 `book/harness/evals/runs/compare-qwen3.8-27b-vs-deepseek-flash.md`：
   - qwen 用已提交的 `evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/`，不要重跑。
   - 列出每条 case 两个模型的通过率，按“成功类”和“刹车/拒绝类”分组（依据 case 期望的 stop_reason）。
   - 汇总：总通过率、不稳定的 case、总耗时和单条 case 耗时中位数、token 总数，以及 DeepSeek 按 models.json 里的价格估算的费用。
   - 时延不能直接比较：一个是本地 GPU，一个走网络 API。这一点要在表里写明。
4. 每个失败的 case 挑 1 条 trace，用一句话说明失败原因，路径用相对路径。

## 约束
不改代码、case、prompt、闸门；不碰 chapters 和 README；不 git add/commit；绝不打印 key；`git grep` 搜 key 前缀和 `/home/` 都不能有新增命中。

## 交回（完成后汇报一次就停下）
对照表路径和要点：成功类和刹车/拒绝类各自的通过率、不稳定的 case 及原因、实际费用。
