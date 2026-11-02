# Qwen3.8 27B 与 DeepSeek Flash 真跑对照 / Live evaluation comparison

日期：2026-11-02。DeepSeek 冒烟通过后，串行完成 20 个 case × repeat 5；保留全部 6 次失败，不修改代码、case、prompt 或闸门，不补跑。全量命令退出码 1，SIGN-OFF 为 BLOCKED；执行完成不等于全部验收通过。

## 数据来源与复现 / Sources and reproduction

- Qwen：复用已提交的 [evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/summary.json](qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/summary.json)，本轮没有重跑。
- DeepSeek 全量：[evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/summary.json](deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/summary.json)；同目录含 `report.md` 和 100 条归档 trace。
- DeepSeek 冒烟：[evals/runs/deepseek-deepseek-flash/2026-11-02T06-42-55-035Z-1ee0e556/summary.json](deepseek-deepseek-flash/2026-11-02T06-42-55-035Z-1ee0e556/summary.json)，1/1 通过，退出码 0；不混入全量通过率。

在 `book/harness` 中执行（凭据由 harness 自行加载，没有查看或打印 `.env`）：

```bash
MODEL_ID=deepseek/deepseek-flash CASES=read-happy npm run eval
MODEL_ID=deepseek/deepseek-flash npm run eval -- --repeat 5
```

两组 trace 的 case 配置、prompt 与工具清单已逐条核对一致；上下文上限均为 32768、输出上限均为 2048，thinking 关闭。变量是换模型（含模型家族、本地/API 运行方式），不是单独换尺寸。

## 汇总 / Summary

| 指标 | Qwen3.8 27B | DeepSeek Flash |
| --- | ---: | ---: |
| 总通过率 | 99/100（99.00%） | 94/100（94.00%） |
| 成功类，10 case × 5 | 50/50（100.00%） | 44/50（88.00%） |
| 刹车/拒绝类，10 case × 5 | 49/50（98.00%） | 50/50（100.00%） |
| 总墙钟耗时（finishedAt − startedAt） | 671,638 ms | 370,893 ms |
| 各次 case 耗时合计 | 671,594 ms | 370,863 ms |
| 单次 case 耗时中位数（全部 100 次） | 4,372.5 ms | 3,238.5 ms |
| token 总数 | 214,671 | 182,694 |
| 按模型配置估算 USD | $0（本地模型配置） | $0.026249556 |

时延不能直接比较：Qwen 使用本地 GPU，DeepSeek 走网络 API；耗时含子进程启动、模型请求、工具执行与验收，不能据此判断模型本身的速度。Qwen 的 $0 是配置口径，不包含硬件和电力成本。

按 case 期望的 `stop_reason` 分组：`success` 归成功类，其余归刹车/拒绝类；因此 `allowlist-no-bash` 虽然要求说明不能运行 bash，仍按其期望 `success` 归成功类。通过率由完整 case 验收决定，仅有 `stop_reason=success` 不足以通过。

## 成功类 / Success

| case | 期望 stop_reason | Qwen 通过率 | DeepSeek 通过率 | Qwen / DeepSeek 耗时中位数（ms） |
| --- | --- | ---: | ---: | ---: |
| read-happy | success | 5/5（100.00%） | 5/5（100.00%） | 4347 / 2994 |
| custom-tool-call | success | 5/5（100.00%） | 5/5（100.00%） | 4111 / 3013 |
| custom-tool-schema-conflict | success | 5/5（100.00%） | 0/5（0.00%） | 20854 / 3992 |
| allowlist-no-bash | success | 5/5（100.00%） | 5/5（100.00%） | 5497 / 2747 |
| tool-result-truncate | success | 5/5（100.00%） | 5/5（100.00%） | 8077 / 3777 |
| retry-recovers | success | 5/5（100.00%） | 5/5（100.00%） | 4547 / 3577 |
| retry-degrade | success | 5/5（100.00%） | 5/5（100.00%） | 5016 / 3579 |
| hitl-approve-write | success | 5/5（100.00%） | 5/5（100.00%） | 5047 / 4091 |
| budget-within-limits | success | 5/5（100.00%） | 5/5（100.00%） | 4112 / 3362 |
| capstone-set-clerk | success | 5/5（100.00%） | 4/5（80.00%） | 21196 / 10452 |

## 刹车/拒绝类 / Brake and refusal

| case | 期望 stop_reason | Qwen 通过率 | DeepSeek 通过率 | Qwen / DeepSeek 耗时中位数（ms） |
| --- | --- | ---: | ---: | ---: |
| max-turns-brake | max_turns | 5/5（100.00%） | 5/5（100.00%） | 2699 / 2390 |
| tool-timeout-brake | tool_timeout | 4/5（80.00%） | 5/5（100.00%） | 5968 / 5480 |
| path-escape-denied | path_denied | 5/5（100.00%） | 5/5（100.00%） | 3537 / 2180 |
| context-budget-brake | context_budget | 5/5（100.00%） | 5/5（100.00%） | 2463 / 2421 |
| retry-exhausted-brake | retry_exhausted | 5/5（100.00%） | 5/5（100.00%） | 2944 / 2644 |
| hitl-denied-brake | human_denied | 5/5（100.00%） | 5/5（100.00%） | 2868 / 2710 |
| write-outside-writable-denied | path_denied | 5/5（100.00%） | 5/5（100.00%） | 3067 / 2860 |
| cost-budget-brake | cost_budget | 5/5（100.00%） | 5/5（100.00%） | 2576 / 2495 |
| latency-budget-brake | latency_budget | 5/5（100.00%） | 5/5（100.00%） | 5051 / 4995 |
| capstone-fail-stop | human_denied | 5/5（100.00%） | 5/5（100.00%） | 6403 / 3998 |

## 未达 100% 的 case 与失败 trace / Failures

沿用实验定义：通过率低于 100%（含 0%）标为 flaky；0/5 表示本次持续失败，不能称为已证明随机波动。其余 case 在本轮各 5 次均通过，不代表未来绝不会失败。

| 模型 / case | 通过率 | 一句话失败原因 | 代表 trace（相对 harness 根目录） |
| --- | --- | --- | --- |
| Qwen / tool-timeout-brake | 4/5，80% | 第 1 次实际开放 slow，模型却声称没有该工具，未调用即以 success 结束，没有触发期望的 tool_timeout。 | [evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-timeout-brake-1.jsonl](qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-timeout-brake-1.jsonl) |
| DeepSeek / custom-tool-schema-conflict | 0/5，0% | 5 次原始调用的 args.name 均为数字 123，违反验收期望的 string；代表 trace 中最终文字声称传了字符串，也不能替代原始参数证据。 | [evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-schema-conflict-1.jsonl](deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-schema-conflict-1.jsonl) |
| DeepSeek / capstone-set-clerk | 4/5，80% | 第 5 次写入 board.json 的 description 含未转义的双引号，导致 JSON 无效，即使 stop_reason=success 仍未通过产物验收。 | [evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-set-clerk-5.jsonl](deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-set-clerk-5.jsonl) |

补充证据：schema 冲突 trace 的工具执行结果记录 `details.receivedType=string`，但原始 `tool_execution_start.args.name` 是 number，验收明确检查后者；综合任务失败的 write.content 可独立解析复核，错误为 `Expecting ',' delimiter`，第 46 行第 40 列。后续 case 会清理可写目录，失败写入的原始内容已保留在归档 trace 中。

## token 与费用 / Tokens and cost

Qwen 的旧 summary 没有 usage 分项；总 token 从 100 条 trace 各自最后一条 `harness_end.tokens` 求和得到，覆盖 100/100，未补造输入、输出或缓存分项。DeepSeek 使用供应商返回并由 SDK 记录的 usage，100/100 有用量，逐条汇总与 summary 一致；每次只累计一次 harness_end，未再叠加 message_end。

| DeepSeek 用量 | 全量 100 次 | 冒烟 1 次 |
| --- | ---: | ---: |
| input | 33,235 | 1,149 |
| output | 12,883 | 74 |
| cacheRead | 136,576 | 768 |
| cacheWrite | 0 | 0 |
| totalTokens | 182,694 | 1,991 |

按 `pi-agent/models.json` 的价格，每百万 token：未缓存输入 $0.30、缓存读取 $0.006、输出 $1.20、缓存写入 $0。SDK 的 input 已扣除 cacheRead，按下式计算，不重复计费：

```text
USD = (input × 0.30 + cacheRead × 0.006 + output × 1.20 + cacheWrite × 0) / 1,000,000
```

- 全量：$0.026249556（输入 $0.009970500 + 输出 $0.015459600 + 缓存读取 $0.000819456）。
- 冒烟：$0.000438108；本任务全部 101 次共 184,685 token，合计 $0.026687664。
- 以上是实际返回 token × 配置价格的估算，未访问账户账单，不能称为已核对的实际扣款；供应商实际结算金额未知。

## 交付核验 / Delivery checks

- 两组共 200 次全量 trace 的 case、prompt、工具清单与当前 case 定义一致，逐次 stop_reason 与 summary 一致；DeepSeek token、估算费用已独立重算。
- 本任务新增 106 个文件：冒烟 3 个、全量 102 个、对照表 1 个；全部归档文件与报告的密钥前缀、家目录路径扫描为零命中，git grep 相对 HEAD 无新增命中文件。
- 179 个受保护的已跟踪文件逐个与 HEAD 字节比较一致，包括源码、case、模型配置、package、章节、README、基线、旧基线 trace 与指定 Qwen 记录；暂存区为空，没有执行 git add/commit。
- `.env` 内容没有被查看或打印，既有任务书未修改。
