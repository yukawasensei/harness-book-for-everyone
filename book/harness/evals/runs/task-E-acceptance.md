# Task E 验收记录 / Acceptance

日期：2026-11-02。DeepSeek 接入与离线验收完成；没有可用的 DeepSeek key，按任务约定跳过付费冒烟和全量 repeat 5，尚无 DeepSeek 真跑通过率、实际 token 用量或账单数据。没有执行 git add / commit。

## 改动文件

以下路径相对 `book/harness`：

| 文件 | 变化 |
| --- | --- |
| `pi-agent/models.json` | 新增 DeepSeek provider、环境变量占位符、价格和 thinking 协议；上下文与输出上限和 Qwen 一致 |
| `.env.example` | 仅提供 `DEEPSEEK_API_KEY` 空变量 |
| `package.json` | start 直接进入 index，由同一进程加载环境与预检 |
| `src/eval/model-config.ts` | 统一 provider/model、兼容无前缀 Ollama、启动时加载环境文件一次、缺 key 提前退出 |
| `src/index.ts` | 按 provider 选模型、完整模型名、缓冲并脱敏终端文本、记录用量与真实模型错误 |
| `src/secrets.ts` | 对运行时 key 原文和 JSON 转义形式脱敏 |
| `src/trace.ts` | 落盘前脱敏；文本截断前脱敏；保留供应商用量与错误 |
| `src/eval/run-evals.ts` | 两种 provider 共用 repeat 流程，归档/summary/错误脱敏，保留用量 |
| `src/eval/stability.ts` | 完整默认模型名、稳定归档目录、汇总用量与估算费用 |
| `src/eval/usage.ts` | 累加供应商返回的 token 和配置价格成本，旧记录缺失用量保持未知 |
| `src/deepseek.test.ts` | 新增 5 项离线测试，模拟 fetch，不发真实 API 请求 |
| `src/eval-stability.test.ts` | 更新模型名规范化后的预期返回值 |
| `src/eval/usage.md` | 两种运行方式、配置 key、thinking 开关、价格与产物说明 |

另有本记录与下述 Qwen 冒烟的 `summary.json`、`report.md`、`traces/read-happy-1.jsonl`。开始前已有的 `notes/_v1.2/plan.md` 修改和未跟踪任务书保持原样。

## 复现命令

在 `book/harness` 内执行。DeepSeek 的 key 先通过当前进程环境或被忽略的 `.env` 配置；已有环境变量优先。不要在命令行、报告或 trace 中填写 key 的值。

```bash
MODEL_ID=ollama/qwen3.8:27b npm start
CASES=read-happy npm run eval
MODEL_ID=ollama/qwen3.8:27b npm run eval -- --repeat 5

MODEL_ID=deepseek/deepseek-flash npm start
MODEL_ID=deepseek/deepseek-flash CASES=read-happy npm run eval
MODEL_ID=deepseek/deepseek-flash npm run eval -- --repeat 5

npm test
npm run typecheck
```

无前缀的 `MODEL_ID=qwen3.8:27b` 继续有效。DeepSeek 结果将写到 `evals/runs/deepseek-deepseek-flash/<run-id>/`；不会覆盖 Qwen 签收基线。

## 离线证据

- `npm test`：98 PASS，0 FAIL，退出码 0；日志：`traces/task-E-tests.log`（忽略的本地产物）。
- `npm run typecheck`：退出码 0；日志：`traces/task-E-typecheck.log`（忽略的本地产物）。
- `src/deepseek.test.ts` 的 `real SDK session serializes DeepSeek thinking disabled with equal context and output limits`：从仓库配置创建真实 SDK session，验证配置中的环境变量能解析为测试凭据，通过模拟 fetch 截获序列化 HTTP 请求，断言 `model=deepseek-flash`、`thinking={"type":"disabled"}`、`max_tokens=2048`，并核对 `contextWindow=32768` 与 Qwen 相同。凭据没有进入请求 body。这里是离线请求序列化证据，不是供应商实际响应证据。
- 其余新增测试覆盖模型显式登记、旧模型名兼容、环境文件只加载一次、环境变量优先、缺 key 时不创建 trace、嵌套参数/错误/JSON 转义的 key 脱敏、先脱敏再截断文本、用量不重复累计。
- `.env` 的 Git 忽略检查命中；`.env.example` 可跟踪。密钥前缀和家目录模式的已跟踪新增命中及未跟踪产物命中均为 0；检查只输出计数，不输出匹配内容。
- case、prompt、`src/gates/**`、章节、README、`evals/baseline.json` 与旧 `evals/traces/` 均未修改；Git 暂存区为空；diff 格式检查通过。

## 启动预检与真实运行

DeepSeek 启动检查返回：`DEEPSEEK_API_KEY is required: set it in the environment or book/harness/.env (see .env.example)`。没有查看或显示真实 `.env` 内容，没有查找其他凭据来源。

真实 CLI 的 `npm start` 与 `npm run eval -- --repeat 5` 在选择 DeepSeek 时均退出 1，并提示缺少 key；没有模型调用，也没有创建结果目录或覆盖已有 latest trace。证据：`traces/task-E-preflight.json`（忽略的本地产物）。因此未运行付费冒烟、100 次全量对照，DeepSeek 费用为本轮未发生 API 调用，不能提供实测账单。

本地 Qwen 回归命令为 `CASES=read-happy npm run eval`，退出码 0：

| 分组 | case | Qwen 本轮 | DeepSeek 本轮 |
| --- | --- | --- | --- |
| 成功类 / Success | read-happy | 1/1，100%，stop_reason=success | 缺 key，未运行 |
| 刹车与拒绝类 / Brake and refusal | 全部 | 本轮未运行，未宣称全量回归 | 缺 key，未运行 |

Qwen 耗时 34,058 ms（子进程启动与验收在内）；供应商返回 input=956、output=101、cacheRead=964、cacheWrite=0、totalTokens=2021，按本地模型配置费用为 $0。API 的 usage 成本来自配置价格计算，不等于供应商账单。

Qwen 产物：`evals/runs/qwen3.8-27b/2026-11-02T06-01-27-955Z-2e3421e8/`，包含 summary、报告与 trace。旧的 Qwen repeat 5 记录不参与本轮新实测统计；因为没有 DeepSeek 真跑数据，本记录不构造逐条对照通过率。
