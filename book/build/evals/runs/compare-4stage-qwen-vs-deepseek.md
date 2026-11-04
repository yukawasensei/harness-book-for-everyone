# 四工序 Qwen 与 DeepSeek 真实评测对照 / Four-stage live evaluation comparison

日期：2026-11-04。流水线：`reelloom-4stage-v1`。两模型各执行一次全量四 cases × repeat 1，均退出码 0；没有补跑或调整源码、case、提示词与闸门。以下只报告结构观察。

## 数据来源与复现 / Sources and reproduction

运行目录在本地 `evals/runs/local/<model>/<run-id>/` 下生成（含逐 case JSON、`summary.json`、`report.md`、项目产物、sessions 与 staging），不入库；本次两个运行记录的 `<model>/<run-id>` 分别为 `ollama-qwen3-8-27b/2026-11-04T06-31-20-332Z-ef68435f` 与 `deepseek-deepseek-flash/2026-11-04T06-37-47-083Z-2d880c7c`。

在 `<repo-root>/book/build` 执行 Qwen：

```sh
EVAL_FAKE=0 MODEL_ID=ollama/qwen3.8:27b \
  NO_PROXY=127.0.0.1,localhost npm run eval -- --repeat 1
```

执行 DeepSeek 前，先将 `DEEPSEEK_API_KEY` 放在 `book/build/.env`（勿提交；评测脚本会自动加载本包 `.env`），再运行：

```sh
EVAL_FAKE=0 MODEL_ID=deepseek/deepseek-flash npm run eval -- --repeat 1
```

逐 case 独立建项，分别使用固定上游夹具，不是前一道本次生成的作品。两模型的 case 配置、用户提示词、系统提示词、工具清单、上下文说明与轮数预算已从八份 session 逐项核对一致。配置均为上下文 32768、输出上限 2048、thinking off，每道超时 600000 ms。

## 逐工序观察 / Per-stage observations

结构通过需同时满足：存在有效版本且通过重新读取校验、`stop_reason=draft_written`、未超轮数预算、存在 usage。仅有结束文本或 stop_reason 不能代替完整验收。

| 模型 | 工序 | 结构通过 | stop_reason | 闸门拒绝次数 | 主要拒绝原因 | 耗时 ms | token 总数 |
| --- | --- | --- | --- | ---: | --- | ---: | ---: |
| Qwen | 故事 story | 1/1 | draft_written | 0 | 无 | 56,655 | 5,595 |
| Qwen | 剧本 script | 1/1 | draft_written | 1 | scene 参数为字符串且不是合法 JSON；同次运行内修正后通过。 | 69,837 | 29,993 |
| Qwen | 设定集 bible | 1/1 | draft_written | 0 | 无 | 57,110 | 11,321 |
| Qwen | 分镜板 board | 1/1 | draft_written | 0 | 无 | 191,067 | 39,739 |
| DeepSeek | 故事 story | 1/1 | draft_written | 0 | 无 | 11,362 | 4,778 |
| DeepSeek | 剧本 script | 1/1 | draft_written | 1 | write_scene 的原始参数 JSON 语法错误；同次运行内修正后通过。 | 25,484 | 34,378 |
| DeepSeek | 设定集 bible | 1/1 | draft_written | 0 | 无 | 14,401 | 8,942 |
| DeepSeek | 分镜板 board | 1/1 | draft_written | 3 | 首次缺少镜头 scene_id、prop_ids；随后两次 S02-03 描写角色不在引用中；同次运行内修正后通过。 | 42,069 | 70,371 |

拒绝次数按程序口径统计：`write_draft`、`write_scene`、`write_scene_shots`、`finalize_draft` 的 `isError` 工具结果数；包含 SDK 参数解析拒绝，不等于失败工序数。一条拒绝信息可列出多个缺失字段，仍只计一次调用。

## 真实拒绝与 session / Actual rejections and sessions

Qwen 的 1 次拒绝发生于剧本 `write_scene`：

> 参数 scene：期望 对象(object)，实际 字符串(string)，但不是合法 JSON；请检查双引号、逗号和括号；正确示例（此处的值）：{}。保留其余必填字段。

DeepSeek 剧本的 1 次拒绝为原始 JSON 解析错误；分镜板的 3 次拒绝分别为缺少字段、麦冬引用缺失、陆岑引用缺失。代表原始信息：

> Invalid arguments for tool "write_scene": Expected double-quoted property name in JSON at position 1076 (line 1 column 1077)

> S02-03 提到“麦冬”，该角色 麦冬 不在本镜角色引用中；请移除镜头外角色，或回到分镜修正引用

本地运行目录中各项目的 `sessions/*.jsonl` 同时保存模型、完整提示词、工具、上下文说明、usage、错误和 `stage_run_end`。

## 汇总与 token / Summary and tokens

| 指标 | Qwen3.8 27B | DeepSeek Flash |
| --- | ---: | ---: |
| 结构通过 | 4/4 | 4/4 |
| 闸门拒绝 / 全部工具执行 | 1/18（5.56%） | 4/22（18.18%） |
| 各 case 耗时合计 ms | 374,669 | 93,316 |
| 参数容错解码 coerced_args | 9 | 0 |
| input | 20,738 | 14,066 |
| output | 16,404 | 12,499 |
| cacheRead | 49,506 | 91,904 |
| cacheWrite | 0 | 0 |
| totalTokens | 86,648 | 118,469 |
| 配置价格估算 USD | $0 | $0.019770024 |

耗时为各 case `duration_ms` 之和，包含会话创建、上游准备、模型调用、工具与验收，不标为总墙钟时间。token 由各 session 的 assistant usage 求和，逐项与单次 JSON、summary 一致，不重复累计结束摘要。

DeepSeek 按配置每百万 input $0.30、output $1.20、cacheRead $0.006、cacheWrite $0 估算：`(14066 × 0.30 + 12499 × 1.20 + 91904 × 0.006) / 1000000 = $0.019770024`。这是 usage 乘配置价格，未核对账单；Qwen 的 $0 是本地模型配置价格，不含硬件、电力。

## 基线最终状态 / Final baseline state

已提交的签收基线 [4stage-v1.json](../baselines/4stage-v1.json) 沿用 2026-11-03 的真实 Qwen 运行（`2026-11-03T13-24-18-357Z-ade15417`）。本次 Qwen 对比结果为 `vs baseline: no change`、`SIGN-OFF: OK`。DeepSeek 输出 `STRUCTURE ONLY`，只做结构观察，不参与基线签收。

## 结论与限制 / Conclusions and limitations

本轮 Qwen 与 DeepSeek 均为四道工序结构通过（各 4/4），八次均以 `draft_written` 停止；Qwen 记录 1 次闸门拒绝、86648 token、case 耗时合计 374669 ms，DeepSeek 记录 4 次闸门拒绝、118469 token、case 耗时合计 93316 ms。每个工序每模型仅一次、上游为固定夹具；这些数据不构成多次稳定性、连续创作链或人工质量评分。Qwen 使用本地模型服务，DeepSeek 使用网络 API，耗时不用于判断模型本身的速度；配置费用估算不等于实际扣款。
