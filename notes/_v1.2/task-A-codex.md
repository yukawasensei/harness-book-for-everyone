# 任务 A（codex）：评测稳定性 `--repeat N` + 可切换模型

仓库：<repo-root>，工作目录 `book/harness`。先读 `notes/_v1.2/plan.md`。

## 背景
`npm run eval`（`src/eval/run-evals.ts`）对 `cases/cases.json` 的 20 条 case 真跑本地 Ollama 一次，`src/eval/report.ts` 出报告，`evals/baseline.json` 是 qwen3.8:27b 的 20/20 签收基线。一次全过不代表稳定，下一步还要拿小模型做对照。模型已可用 `MODEL_ID` 环境变量切换（`src/index.ts`、`run-evals.ts`），但 `pi-agent/models.json` 只登记了 qwen3.8:27b。

## 要达到的效果
1. `npm run eval -- --repeat N`（默认 1，行为与现在一致）：每条 case 跑 N 次，结果汇总为每条 case 的 `passCount/N`、通过率、每次的 stop_reason 与耗时；通过率 <100% 的标为 flaky。
2. `report` 能读多次运行结果，输出一张表：case id、章节、通过率、是否 flaky、stop_reason 分布、耗时中位数。
3. 换模型只需要两步：在 `pi-agent/models.json` 加一项 + 设 `MODEL_ID`。写清楚非 qwen 模型需要的字段（照现有 qwen 项的结构）。如果 `MODEL_ID` 不在 models.json 里，启动时给出明确报错，而不是静默回退。
4. 非 qwen3.8:27b 或 repeat>1 的结果写到 `evals/runs/<模型名 slug>/`（summary json + 报告 md），**不覆盖** `evals/baseline.json`。trace 里的路径必须是相对路径（不得出现 `/home/...`）。
5. 为聚合逻辑写离线单测（不调 Ollama），放在 `src/` 下符合 `src/*.test.ts` 的新文件里。

## 约束 / 不要做
- 不改 case、prompt、闸门逻辑（`src/gates/**`、`cases/cases.json`）——对照实验只允许模型一个变量。
- 不碰 `chapters/**`、`README.md`、根目录文件。
- 不 git add / commit。不 pull 新模型（总控会安排）。

## 验收
- `npm test` 和 `npm run typecheck` 全绿（这两个你可以跑）。
- 真跑一次：`NO_PROXY=127.0.0.1,localhost npm run eval -- --repeat 5`（qwen3.8:27b，约 15 分钟，GPU 同时只跑这一个评测）。
- `git grep -n "/home/" -- book/harness` 无新增命中。

## 交回（完成后汇报一次就停下）
改动文件清单；新增命令用法；repeat 5 的结果表（每条 case 通过率，flaky 列表及你判断的原因）；产物路径。
