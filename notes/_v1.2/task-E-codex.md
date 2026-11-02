# 任务 E（codex）：接入 DeepSeek API（`deepseek-flash`），与本地 qwen 二选一

仓库：`<repo-root>`（本地目录已改名为 `harness-book-for-everyone`），工作目录 `book/harness`。先读 `notes/_v1.2/plan.md` 和 `src/eval/usage.md`。

## 背景
现在只支持本地 Ollama：`src/index.ts` 和 `src/eval/run-evals.ts` 写死了 `ollama/` 前缀，`src/eval/model-config.ts` 只检查 `pi-agent/models.json` 里的 ollama 模型。`src/isolated-pi.ts` 隔离了 `~/.pi`，只读取 `pi-agent/models.json`。
用户要求本地 qwen 和 DeepSeek API 两种方式都能跑。

已查实的事实（不用重新调研）：
- DeepSeek 官方：模型 ID `deepseek-flash`，OpenAI 格式，baseUrl `https://api.deepseek.com`，支持 tool calls，**默认开启 thinking**。价格（每 1M token，高峰时段）：输入未命中缓存 $0.30、命中缓存 $0.006、输出 $1.20。
- pi 文档（`node_modules/@earendil-works/pi-coding-agent/docs/models-configuration.md`）：`apiKey` 支持 `"$NAME"` 形式的环境变量插值；`compat.thinkingFormat: "deepseek"` 通过 `thinking.type` 控制 thinking；`providers.md` 里 DeepSeek 的环境变量是 `DEEPSEEK_API_KEY`。

## 要达到的效果
1. 选模型统一用 `MODEL_ID=<provider>/<model>`，例如 `ollama/qwen3.8:27b`、`deepseek/deepseek-flash`。不带前缀的写法（如 `qwen3.8:27b`）照旧视为 ollama，保持向后兼容。trace 和 summary 里的 model 字段记录完整的 `provider/model`。
2. 在 `pi-agent/models.json` 新增 deepseek provider：`apiKey: "$DEEPSEEK_API_KEY"`。为了只改一个变量，thinking 必须**关闭**，`contextWindow`/`maxTokens` 和 qwen 那一项保持一致；cost 按上面的价格填。需要用 trace 或单测证明发出去的请求里 thinking 确实是关闭的。
3. key 的来源：环境变量，或者被 gitignore 的 `book/harness/.env`（只在启动时读取）。在仓库里提交 `book/harness/.env.example`，只放变量名。选了 deepseek 却没有 key 时，启动前直接报错并说明怎么配置。**任何时候都不能打印、记录、写进 trace 的都是 key 的值**：trace 落盘前的 scrub 要把 key 一并抹掉，并写单测验证。
4. `npm run eval -- --repeat N` 对 deepseek 同样可用；结果写到 `evals/runs/deepseek-deepseek-flash/`（slug 由你定，但要稳定），不覆盖 `evals/baseline.json`。
5. CI 继续离线：单测里不发真实请求。
6. 更新 `src/eval/usage.md`：两种方式各怎么跑、key 怎么配、大致费用。

## 约束 / 不要做
- 不改 case、prompt、闸门（`src/gates/**`、`cases/cases.json`）。
- 不碰 `chapters/**`、`README.md`。不 git add/commit。
- 不去读 `.env` 的内容，也不要在终端输出它；key 不存在就直接报告，不要去找。

## 验收
- `npm test` 和 `npm run typecheck` 全绿。
- `git check-ignore book/harness/.env` 能命中。
- 如果 `DEEPSEEK_API_KEY` 可用（`.env` 或环境变量里有）：先 `MODEL_ID=deepseek/deepseek-flash CASES=read-happy npm run eval` 冒烟一次，再跑 `--repeat 5` 全量（预计花费不到 1 美元）。不可用就跳过真跑，在汇报里说明。
- 本地 qwen 的回归：`CASES=read-happy npm run eval` 仍然 PASS。
- `git grep -n "sk-"` 和 `git grep -n "/home/"` 都没有新增命中。

## 交回（完成后汇报一次就停下）
改动文件清单；两种方式的命令；证明 thinking 关闭的证据；有真跑的话附上 deepseek 与 qwen 的逐条通过率对照（按成功类和刹车/拒绝类分组）、总耗时和实际 token 数及费用；产物路径。
