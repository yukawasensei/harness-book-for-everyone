# 评测稳定性与模型切换 / Stability and model selection

在 `book/harness` 内执行：

```bash
npm run eval                            # 默认 repeat=1，全量默认模型更新原 baseline
NO_PROXY=127.0.0.1,localhost npm run eval -- --repeat 5
CASES=read-happy npm run eval -- --repeat 2
npm run report                          # 只读旧 baseline，按单次结果显示稳定性表
npm run report -- evals/runs/<model-slug>/<run-id>/summary.json
npm run report -- evals/runs/<model-slug>/<run-id>  # 也支持结果目录
npm run report -- <same-model-summary-1.json> <same-model-summary-2.json>
```

所有模型调用串行执行，每个 case 连续跑 N 次；每次创建独立会话并沿用原 prompt、case、闸门。`--repeat N` 和 `--repeat=N` 仅接受正整数，默认 1。任何一次失败都会使评测退出码为 1，保留原始失败，不自动补跑。`EVAL_TIMEOUT_MS` 默认 300000，是每次子进程的超时。

每条 case 汇总 `passCount/total`、通过率、flaky、stop_reason 分布和耗时中位数；每次 stop_reason、耗时、错误、tracePath 都保留在 summary 和报告中。按本任务定义，通过率低于 100%（含 0%）都标 flaky；它不单独证明模型随机性。耗时包含进程启动和验收；缺失 harness_end 显示 missing。

仅 **qwen3.8:27b + repeat=1 + 未设置 CASES 的全量运行** 更新 `evals/baseline.json` 和 `evals/traces/`。其他结果全部写入 `evals/runs/<model-slug>/<timestamp-unique-id>/`，含 `summary.json`、`report.md`、`traces/`，每次建新目录。slug 将 `/`、`:` 等替换为 `-`，例如 `vendor/model:4b` 变为 `vendor-model-4b`。同一模型的多份 summary 可合并报表，分母为实际运行次数；不同模型分开报告。旧 baseline 只有一次观察，不代表重复评测已稳定。

切换模型只需两步（模型须由操作者预先准备，本命令不 pull）：

1. 在 `pi-agent/models.json` 的 `providers.ollama.models` 数组追加一项。以下是非 Qwen 模型的字段模板，`example-model:tag` 须改成 Ollama 中的准确名称；数值须匹配实际模型能力。原 qwen 项保持不动。

   ```json
   {
     "id": "example-model:tag",
     "name": "Example local model",
     "reasoning": false,
     "input": ["text"],
     "contextWindow": 32768,
     "maxTokens": 2048,
     "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
   }
   ```

   `id` 是精确匹配的模型名；`name` 是展示名；`reasoning` 是模型是否支持推理能力；`input` 是支持的输入类型；`contextWindow` 是上下文容量；`maxTokens` 是输出上限；四个 `cost` 字段是每百万 token 的价格，本地免费推理填 0。非 Qwen 也使用同一结构，无需改源码。模型须支持工具调用。沿用 provider 的 `baseUrl`、`api: openai-completions` 和 `compat`；harness 固定 thinking off。对照时沿用同样的上下文和输出限制（且两模型都须支持），只切换模型。

2. 设置 `MODEL_ID`：

   ```bash
   MODEL_ID=example-model:tag NO_PROXY=127.0.0.1,localhost npm run eval -- --repeat 5
   MODEL_ID=example-model:tag npm start
   ```

`npm start` 与 `npm run eval` 均在运行前确认 id 已显式登记；未知 id 明确报错并指出 `pi-agent/models.json`，不回退到默认模型。归档 trace 含模型、prompt、工具清单、case 配置、隔离说明；仓库绝对路径在验收后改为相对 harness 根目录的路径。
