# Task A 验收记录 / Acceptance

本轮实现已完成；真实稳定性评测 99/100，签收状态 BLOCKED。未补跑失败样本。

## 本轮改动

- `package.json`
- `src/eval/run-evals.ts`
- `src/eval/report.ts`
- `src/eval/stability.ts`
- `src/eval/model-config.ts`
- `src/eval/usage.md`
- `src/eval-stability.test.ts`
- 本目录新增 `summary.json`、`report.md`、100 份 `traces/*.jsonl` 及本验收记录。

## 命令与验证

以下命令均在 `book/harness` 执行：

```bash
npm test
npm run typecheck
NO_PROXY=127.0.0.1,localhost npm run eval -- --repeat 5
npm run report
npm run report -- evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/summary.json
npm run report -- evals/baseline.json evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95
```

- `npm test`：93/93 通过，0 失败；`npm run typecheck`：退出 0。
- repeat 5：20 条 case × 5，99/100 通过，退出 1；耗时约 11 分 12 秒。只运行这一轮模型评测，没有自动补跑。
- `report` 已验证旧 baseline、新 summary JSON、运行目录、同模型多份输入；合并旧 baseline 与本轮结果得到 119/120。
- 未登记的 `MODEL_ID` 在 `npm start` / `npm run eval` 中均明确报错，退出 1，没有启动模型调用。
- 逐条核对 100 份 trace：原 case / prompt / 工具 / 配置一致、每条恰好 5 次；JSON 的通过数、通过率、flaky、stop_reason 分布、中位数均重新计算核对。
- 原 `evals/baseline.json` SHA-256：`7d932933e9780f0ce1d748d476de30e2b816abc8cd0e72722c07f2bdfabd3472`，运行前后相同；原归档 trace 无改动。
- case、prompt、闸门、index.ts、模型配置清单均无改动。本轮没有拉取或运行第二个模型。非 Qwen 字段模板与两步切换说明位于 `src/eval/usage.md`。
- 仓库路径检查：tracked grep 和新增文件扫描均无家目录绝对路径命中；`git diff --check` 通过。未执行 git add / commit。

## repeat 5 结果

| case | chapter | pass | rate | flaky | stop_reason distribution | median ms |
| --- | --- | --- | --- | --- | --- | ---: |
| read-happy | ch02 | 5/5 | 100% | no | success: 5 | 4347 |
| custom-tool-call | ch03 | 5/5 | 100% | no | success: 5 | 4111 |
| custom-tool-schema-conflict | ch03 | 5/5 | 100% | no | success: 5 | 20854 |
| max-turns-brake | ch04 | 5/5 | 100% | no | max_turns: 5 | 2699 |
| tool-timeout-brake | ch04 | 4/5 | 80% | yes | success: 1, tool_timeout: 4 | 5968 |
| allowlist-no-bash | ch05 | 5/5 | 100% | no | success: 5 | 5497 |
| path-escape-denied | ch05 | 5/5 | 100% | no | path_denied: 5 | 3537 |
| context-budget-brake | ch07 | 5/5 | 100% | no | context_budget: 5 | 2463 |
| tool-result-truncate | ch07 | 5/5 | 100% | no | success: 5 | 8077 |
| retry-recovers | ch07 | 5/5 | 100% | no | success: 5 | 4547 |
| retry-exhausted-brake | ch07 | 5/5 | 100% | no | retry_exhausted: 5 | 2944 |
| retry-degrade | ch07 | 5/5 | 100% | no | success: 5 | 5016 |
| hitl-approve-write | ch08 | 5/5 | 100% | no | success: 5 | 5047 |
| hitl-denied-brake | ch08 | 5/5 | 100% | no | human_denied: 5 | 2868 |
| write-outside-writable-denied | ch08 | 5/5 | 100% | no | path_denied: 5 | 3067 |
| budget-within-limits | ch09 | 5/5 | 100% | no | success: 5 | 4112 |
| cost-budget-brake | ch09 | 5/5 | 100% | no | cost_budget: 5 | 2576 |
| latency-budget-brake | ch09 | 5/5 | 100% | no | latency_budget: 5 | 5051 |
| capstone-set-clerk | ch10 | 5/5 | 100% | no | success: 5 | 21196 |
| capstone-fail-stop | ch10 | 5/5 | 100% | no | human_denied: 5 | 6403 |

## flaky 证据及判断

唯一 flaky：`tool-timeout-brake`，4/5（80%）。第 1 次 stop_reason 为 success，未调用 slow；另 4 次均为 tool_timeout。

证据：`traces/tool-timeout-brake-1.jsonl` 中 harness_start 的 activeTools 为 [slow]、toolTimeoutMs 为 400；模型回答声称自己没有 slow，并列举了未实际开放的通用工具；没有 tool_execution_start，随后 harness_end 为 success。验收原因是 stop_reason 与预期不符且 slow 未调用。

判断：本次失败表现为模型对当前工具清单的错误陈述和未遵循调用要求，没有进入工具执行阶段，不能据此判断超时闸门失效。4 次真实调用都被闸门按预期停下。保留失败，不改 case / prompt / 闸门来提高通过率。5 次结果仅反映本轮观察，不足以保证以后同样稳定。

详细逐次 stop_reason、耗时、错误与 tracePath 见 `summary.json` 和 `report.md`。
