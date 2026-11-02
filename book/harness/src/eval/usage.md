# 评测稳定性与模型切换 / Stability and model selection

在 `book/harness` 内执行：

`npm start` 和 `npm run eval` 统一接受 `MODEL_ID=<provider>/<model>`。默认是 `ollama/qwen3.8:27b`；旧写法 `MODEL_ID=qwen3.8:27b` 仍视为 Ollama。trace 和 summary 始终记录完整的 provider/model。

## 本地 Qwen / Local Qwen

先由操作者启动 Ollama 并准备好 `qwen3.8:27b`，harness 不下载模型：

```bash
MODEL_ID=ollama/qwen3.8:27b npm start
CASES=read-happy npm run eval            # 默认模型冒烟，不覆盖 baseline
MODEL_ID=ollama/qwen3.8:27b NO_PROXY=127.0.0.1,localhost npm run eval -- --repeat 5
```

## DeepSeek API

先在当前 shell 的环境变量中配置 `DEEPSEEK_API_KEY`，或复制 `.env.example` 为 `book/harness/.env` 后，用本地编辑器填入自己的值。不要把值粘贴进命令、报告或 trace；`.env` 已被 gitignore，`.env.example` 只有变量名。无需 `source .env`：启动时用 Node 的 `process.loadEnvFile` 读取一次，已有环境变量优先于文件；运行中不重读。缺失或空白 key 会在创建 trace、会话和结果目录之前报错，指出配置方式。Ollama 不需要此 key，也不读取本机 pi 凭据。

```bash
MODEL_ID=deepseek/deepseek-flash npm start
MODEL_ID=deepseek/deepseek-flash CASES=read-happy npm run eval
MODEL_ID=deepseek/deepseek-flash npm run eval -- --repeat 5
```

以上 DeepSeek 命令会产生 API 费用。按本次配置的高峰价格，每百万 token：未命中缓存的输入 $0.30，命中缓存的输入 $0.006，输出 $1.20。例如未缓存输入 100 万 + 输出 10 万约 $0.42；20 个 case × repeat 5 预计不到 $1，但实际取决于轮数、缓存命中和输出长度。summary、report 和 trace 保留供应商返回的 input/output/cacheRead/cacheWrite/totalTokens 与按配置价格估算的 USD 成本；它不是账单，缺失的历史用量也不会补造。

DeepSeek 默认开启 thinking，本配置显式关闭：`reasoning: true` 声明能力，`compat.thinkingFormat: "deepseek"` 搭配 harness 的 `thinkingLevel: "off"`，请求体包含 `thinking: {"type":"disabled"}`。不要用 `reasoning: false` 代替关闭开关，否则 SDK 会省略该字段。离线 `src/deepseek.test.ts` 用真实 SDK 会话及模拟 fetch 截获序列化请求进行断言，不访问真实 API。上下文 32768、输出上限 2048 与 Qwen 一致；case、prompt、工具与闸门保持不变。对照变量是换模型（包括本地/API 与模型家族），不称为只换尺寸。

trace writer 在任何行落盘前对 key 脱敏，归档、summary、错误和终端文本也会脱敏；终端回复先缓冲再输出，以免 key 跨多个流式片段时漏出。CI 只跑离线单测；真实 DeepSeek 评测须由操作者显式执行。

## 重复评测与产物 / Repeats and artifacts

```bash
npm run eval                            # 默认 repeat=1，全量也只写忽略的 local 目录
NO_PROXY=127.0.0.1,localhost npm run eval -- --repeat 5
CASES=read-happy npm run eval -- --repeat 2
npm run report                          # 只读旧 baseline，按单次结果显示稳定性表
npm run report -- evals/runs/local/<model-slug>/<run-id>/summary.json
npm run report -- evals/runs/local/<model-slug>/<run-id>  # 也支持结果目录
npm run report -- <same-model-summary-1.json> <same-model-summary-2.json>

EVAL_ARCHIVE=1 npm run eval -- --repeat 5 # 显式生成可提交归档，不更新 baseline
npm run report -- evals/runs/<model-slug>/<run-id>/summary.json
UPDATE_BASELINE=1 MODEL_ID=ollama/qwen3.8:27b npm run eval # 显式更新签收基线；须未设置 CASES
```

所有模型调用串行执行，每个 case 连续跑 N 次；每次创建独立会话并沿用原 prompt、case、闸门。`--repeat N` 和 `--repeat=N` 仅接受正整数，默认 1。任何一次失败都会使评测退出码为 1，保留原始失败，不自动补跑。`EVAL_TIMEOUT_MS` 默认 300000，是每次子进程的超时。

每条 case 汇总 `passCount/total`、通过率、flaky、stop_reason 分布和耗时中位数；每次 stop_reason、耗时、错误、tracePath 都保留在 summary 和报告中。按本任务定义，通过率低于 100%（含 0%）都标 flaky；它不单独证明模型随机性。耗时包含进程启动和验收；缺失 harness_end 显示 missing。

默认所有运行（包括默认 Qwen、全量、repeat=1、未设置 CASES）都写入被 Git 忽略的 `evals/runs/local/<model-slug>/<timestamp-unique-id>/`，不修改已跟踪的 `evals/baseline.json` 和 `evals/traces/`。显式设置 `EVAL_ARCHIVE=1` 时，结果改写到可提交的 `evals/runs/<model-slug>/<timestamp-unique-id>/`；该开关只选择归档位置，不更新签收基线。两种位置均含 `summary.json`、`report.md`、`traces/`，每次建新目录，不移动或覆盖旧归档。

更新签收基线须另设 **`UPDATE_BASELINE=1`**，且必须是 **ollama/qwen3.8:27b + repeat=1 + 未设置 CASES 的全量运行**（含旧的无前缀模型写法）。不满足这些条件会在运行前报错；满足条件且全部 case 通过、无回归时，才额外更新 `evals/baseline.json` 和 `evals/traces/<case-id>.jsonl`。失败仍保留运行记录，但不改旧基线和旧 trace。运行记录默认仍留在 `local/`；可同时设置 `EVAL_ARCHIVE=1` 保留可提交归档。这两种显式写入已跟踪或可提交位置的操作会改变 Git 工作区，供维护者审核后提交。

slug 将 `/`、`:` 等替换为 `-`，例如 `deepseek/deepseek-flash` 变为 `deepseek-deepseek-flash`；Ollama 沿用已有 slug（如 `qwen3.8-27b`）。DeepSeek 任何 repeat / CASES 组合都不会覆盖 Qwen baseline。同一模型的多份 summary 可合并报表，分母为实际运行次数；不同模型分开报告。旧 baseline 只有一次观察，不代表重复评测已稳定。

## 注册其他 Ollama 模型 / Other local models

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
   MODEL_ID=ollama/example-model:tag NO_PROXY=127.0.0.1,localhost npm run eval -- --repeat 5
   MODEL_ID=ollama/example-model:tag npm start
   ```

`npm start` 与 `npm run eval` 均在运行前确认 id 已显式登记；未知 id 明确报错并指出 `pi-agent/models.json`，不回退到默认模型。归档 trace 含模型、prompt、工具清单、case 配置、隔离说明；仓库绝对路径在验收后改为相对 harness 根目录的路径。
