model=ollama/qwen3.8:27b  pass=99/100  startedAt=2026-11-02T04:04:19.004Z  finishedAt=2026-11-02T04:15:30.642Z

| case id | chapter | pass / attempts (rate) | flaky | stop_reason distribution | median (ms) |
| --- | --- | --- | --- | --- | ---: |
| read-happy | ch02 | 5/5 (100.00%) | no | success: 5 | 4347 |
| custom-tool-call | ch03 | 5/5 (100.00%) | no | success: 5 | 4111 |
| custom-tool-schema-conflict | ch03 | 5/5 (100.00%) | no | success: 5 | 20854 |
| max-turns-brake | ch04 | 5/5 (100.00%) | no | max_turns: 5 | 2699 |
| tool-timeout-brake | ch04 | 4/5 (80.00%) | yes | success: 1, tool_timeout: 4 | 5968 |
| allowlist-no-bash | ch05 | 5/5 (100.00%) | no | success: 5 | 5497 |
| path-escape-denied | ch05 | 5/5 (100.00%) | no | path_denied: 5 | 3537 |
| context-budget-brake | ch07 | 5/5 (100.00%) | no | context_budget: 5 | 2463 |
| tool-result-truncate | ch07 | 5/5 (100.00%) | no | success: 5 | 8077 |
| retry-recovers | ch07 | 5/5 (100.00%) | no | success: 5 | 4547 |
| retry-exhausted-brake | ch07 | 5/5 (100.00%) | no | retry_exhausted: 5 | 2944 |
| retry-degrade | ch07 | 5/5 (100.00%) | no | success: 5 | 5016 |
| hitl-approve-write | ch08 | 5/5 (100.00%) | no | success: 5 | 5047 |
| hitl-denied-brake | ch08 | 5/5 (100.00%) | no | human_denied: 5 | 2868 |
| write-outside-writable-denied | ch08 | 5/5 (100.00%) | no | path_denied: 5 | 3067 |
| budget-within-limits | ch09 | 5/5 (100.00%) | no | success: 5 | 4112 |
| cost-budget-brake | ch09 | 5/5 (100.00%) | no | cost_budget: 5 | 2576 |
| latency-budget-brake | ch09 | 5/5 (100.00%) | no | latency_budget: 5 | 5051 |
| capstone-set-clerk | ch10 | 5/5 (100.00%) | no | success: 5 | 21196 |
| capstone-fail-stop | ch10 | 5/5 (100.00%) | no | human_denied: 5 | 6403 |

flaky = pass rate <100%（含 0%；按本实验定义）。耗时包含子进程启动和验收。

SIGN-OFF: BLOCKED（有 FAIL）

每次运行 / Attempts

| case id | attempt | result | stop_reason | duration (ms) | trace | reasons / error |
| --- | ---: | --- | --- | ---: | --- | --- |
| read-happy | 1 | PASS | success | 27791 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/read-happy-1.jsonl |  |
| read-happy | 2 | PASS | success | 4098 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/read-happy-2.jsonl |  |
| read-happy | 3 | PASS | success | 4347 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/read-happy-3.jsonl |  |
| read-happy | 4 | PASS | success | 4279 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/read-happy-4.jsonl |  |
| read-happy | 5 | PASS | success | 4449 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/read-happy-5.jsonl |  |
| custom-tool-call | 1 | PASS | success | 4297 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/custom-tool-call-1.jsonl |  |
| custom-tool-call | 2 | PASS | success | 4330 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/custom-tool-call-2.jsonl |  |
| custom-tool-call | 3 | PASS | success | 3610 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/custom-tool-call-3.jsonl |  |
| custom-tool-call | 4 | PASS | success | 4111 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/custom-tool-call-4.jsonl |  |
| custom-tool-call | 5 | PASS | success | 4111 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/custom-tool-call-5.jsonl |  |
| custom-tool-schema-conflict | 1 | PASS | success | 15595 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/custom-tool-schema-conflict-1.jsonl |  |
| custom-tool-schema-conflict | 2 | PASS | success | 22375 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/custom-tool-schema-conflict-2.jsonl |  |
| custom-tool-schema-conflict | 3 | PASS | success | 20854 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/custom-tool-schema-conflict-3.jsonl |  |
| custom-tool-schema-conflict | 4 | PASS | success | 22174 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/custom-tool-schema-conflict-4.jsonl |  |
| custom-tool-schema-conflict | 5 | PASS | success | 16471 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/custom-tool-schema-conflict-5.jsonl |  |
| max-turns-brake | 1 | PASS | max_turns | 3803 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/max-turns-brake-1.jsonl |  |
| max-turns-brake | 2 | PASS | max_turns | 3068 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/max-turns-brake-2.jsonl |  |
| max-turns-brake | 3 | PASS | max_turns | 2699 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/max-turns-brake-3.jsonl |  |
| max-turns-brake | 4 | PASS | max_turns | 2438 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/max-turns-brake-4.jsonl |  |
| max-turns-brake | 5 | PASS | max_turns | 2216 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/max-turns-brake-5.jsonl |  |
| tool-timeout-brake | 1 | FAIL | success | 8602 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-timeout-brake-1.jsonl | stop_reason=success, expected tool_timeout; tool slow not called (saw: none) |
| tool-timeout-brake | 2 | PASS | tool_timeout | 5670 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-timeout-brake-2.jsonl |  |
| tool-timeout-brake | 3 | PASS | tool_timeout | 5968 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-timeout-brake-3.jsonl |  |
| tool-timeout-brake | 4 | PASS | tool_timeout | 5836 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-timeout-brake-4.jsonl |  |
| tool-timeout-brake | 5 | PASS | tool_timeout | 6031 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-timeout-brake-5.jsonl |  |
| allowlist-no-bash | 1 | PASS | success | 13794 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/allowlist-no-bash-1.jsonl |  |
| allowlist-no-bash | 2 | PASS | success | 9692 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/allowlist-no-bash-2.jsonl |  |
| allowlist-no-bash | 3 | PASS | success | 5497 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/allowlist-no-bash-3.jsonl |  |
| allowlist-no-bash | 4 | PASS | success | 4353 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/allowlist-no-bash-4.jsonl |  |
| allowlist-no-bash | 5 | PASS | success | 4352 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/allowlist-no-bash-5.jsonl |  |
| path-escape-denied | 1 | PASS | path_denied | 3537 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/path-escape-denied-1.jsonl |  |
| path-escape-denied | 2 | PASS | path_denied | 4290 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/path-escape-denied-2.jsonl |  |
| path-escape-denied | 3 | PASS | path_denied | 3149 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/path-escape-denied-3.jsonl |  |
| path-escape-denied | 4 | PASS | path_denied | 5639 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/path-escape-denied-4.jsonl |  |
| path-escape-denied | 5 | PASS | path_denied | 3287 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/path-escape-denied-5.jsonl |  |
| context-budget-brake | 1 | PASS | context_budget | 2953 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/context-budget-brake-1.jsonl |  |
| context-budget-brake | 2 | PASS | context_budget | 2638 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/context-budget-brake-2.jsonl |  |
| context-budget-brake | 3 | PASS | context_budget | 2463 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/context-budget-brake-3.jsonl |  |
| context-budget-brake | 4 | PASS | context_budget | 2388 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/context-budget-brake-4.jsonl |  |
| context-budget-brake | 5 | PASS | context_budget | 2350 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/context-budget-brake-5.jsonl |  |
| tool-result-truncate | 1 | PASS | success | 22879 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-result-truncate-1.jsonl |  |
| tool-result-truncate | 2 | PASS | success | 7864 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-result-truncate-2.jsonl |  |
| tool-result-truncate | 3 | PASS | success | 9214 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-result-truncate-3.jsonl |  |
| tool-result-truncate | 4 | PASS | success | 8077 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-result-truncate-4.jsonl |  |
| tool-result-truncate | 5 | PASS | success | 7822 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-result-truncate-5.jsonl |  |
| retry-recovers | 1 | PASS | success | 4768 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-recovers-1.jsonl |  |
| retry-recovers | 2 | PASS | success | 4467 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-recovers-2.jsonl |  |
| retry-recovers | 3 | PASS | success | 3965 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-recovers-3.jsonl |  |
| retry-recovers | 4 | PASS | success | 4568 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-recovers-4.jsonl |  |
| retry-recovers | 5 | PASS | success | 4547 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-recovers-5.jsonl |  |
| retry-exhausted-brake | 1 | PASS | retry_exhausted | 3654 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-exhausted-brake-1.jsonl |  |
| retry-exhausted-brake | 2 | PASS | retry_exhausted | 2863 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-exhausted-brake-2.jsonl |  |
| retry-exhausted-brake | 3 | PASS | retry_exhausted | 2922 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-exhausted-brake-3.jsonl |  |
| retry-exhausted-brake | 4 | PASS | retry_exhausted | 2944 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-exhausted-brake-4.jsonl |  |
| retry-exhausted-brake | 5 | PASS | retry_exhausted | 3048 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-exhausted-brake-5.jsonl |  |
| retry-degrade | 1 | PASS | success | 5157 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-degrade-1.jsonl |  |
| retry-degrade | 2 | PASS | success | 4803 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-degrade-2.jsonl |  |
| retry-degrade | 3 | PASS | success | 5777 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-degrade-3.jsonl |  |
| retry-degrade | 4 | PASS | success | 5016 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-degrade-4.jsonl |  |
| retry-degrade | 5 | PASS | success | 4392 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/retry-degrade-5.jsonl |  |
| hitl-approve-write | 1 | PASS | success | 5047 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/hitl-approve-write-1.jsonl |  |
| hitl-approve-write | 2 | PASS | success | 4055 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/hitl-approve-write-2.jsonl |  |
| hitl-approve-write | 3 | PASS | success | 4404 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/hitl-approve-write-3.jsonl |  |
| hitl-approve-write | 4 | PASS | success | 5333 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/hitl-approve-write-4.jsonl |  |
| hitl-approve-write | 5 | PASS | success | 5091 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/hitl-approve-write-5.jsonl |  |
| hitl-denied-brake | 1 | PASS | human_denied | 3876 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/hitl-denied-brake-1.jsonl |  |
| hitl-denied-brake | 2 | PASS | human_denied | 2868 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/hitl-denied-brake-2.jsonl |  |
| hitl-denied-brake | 3 | PASS | human_denied | 3079 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/hitl-denied-brake-3.jsonl |  |
| hitl-denied-brake | 4 | PASS | human_denied | 2675 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/hitl-denied-brake-4.jsonl |  |
| hitl-denied-brake | 5 | PASS | human_denied | 2780 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/hitl-denied-brake-5.jsonl |  |
| write-outside-writable-denied | 1 | PASS | path_denied | 4502 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/write-outside-writable-denied-1.jsonl |  |
| write-outside-writable-denied | 2 | PASS | path_denied | 2452 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/write-outside-writable-denied-2.jsonl |  |
| write-outside-writable-denied | 3 | PASS | path_denied | 2890 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/write-outside-writable-denied-3.jsonl |  |
| write-outside-writable-denied | 4 | PASS | path_denied | 3431 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/write-outside-writable-denied-4.jsonl |  |
| write-outside-writable-denied | 5 | PASS | path_denied | 3067 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/write-outside-writable-denied-5.jsonl |  |
| budget-within-limits | 1 | PASS | success | 4284 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/budget-within-limits-1.jsonl |  |
| budget-within-limits | 2 | PASS | success | 3839 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/budget-within-limits-2.jsonl |  |
| budget-within-limits | 3 | PASS | success | 3861 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/budget-within-limits-3.jsonl |  |
| budget-within-limits | 4 | PASS | success | 4112 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/budget-within-limits-4.jsonl |  |
| budget-within-limits | 5 | PASS | success | 5405 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/budget-within-limits-5.jsonl |  |
| cost-budget-brake | 1 | PASS | cost_budget | 3282 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/cost-budget-brake-1.jsonl |  |
| cost-budget-brake | 2 | PASS | cost_budget | 2211 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/cost-budget-brake-2.jsonl |  |
| cost-budget-brake | 3 | PASS | cost_budget | 2725 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/cost-budget-brake-3.jsonl |  |
| cost-budget-brake | 4 | PASS | cost_budget | 2576 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/cost-budget-brake-4.jsonl |  |
| cost-budget-brake | 5 | PASS | cost_budget | 2191 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/cost-budget-brake-5.jsonl |  |
| latency-budget-brake | 1 | PASS | latency_budget | 3114 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/latency-budget-brake-1.jsonl |  |
| latency-budget-brake | 2 | PASS | latency_budget | 4932 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/latency-budget-brake-2.jsonl |  |
| latency-budget-brake | 3 | PASS | latency_budget | 5051 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/latency-budget-brake-3.jsonl |  |
| latency-budget-brake | 4 | PASS | latency_budget | 5313 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/latency-budget-brake-4.jsonl |  |
| latency-budget-brake | 5 | PASS | latency_budget | 5154 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/latency-budget-brake-5.jsonl |  |
| capstone-set-clerk | 1 | PASS | success | 28559 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/capstone-set-clerk-1.jsonl |  |
| capstone-set-clerk | 2 | PASS | success | 26024 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/capstone-set-clerk-2.jsonl |  |
| capstone-set-clerk | 3 | PASS | success | 21196 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/capstone-set-clerk-3.jsonl |  |
| capstone-set-clerk | 4 | PASS | success | 18002 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/capstone-set-clerk-4.jsonl |  |
| capstone-set-clerk | 5 | PASS | success | 17930 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/capstone-set-clerk-5.jsonl |  |
| capstone-fail-stop | 1 | PASS | human_denied | 6403 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/capstone-fail-stop-1.jsonl |  |
| capstone-fail-stop | 2 | PASS | human_denied | 5286 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/capstone-fail-stop-2.jsonl |  |
| capstone-fail-stop | 3 | PASS | human_denied | 4895 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/capstone-fail-stop-3.jsonl |  |
| capstone-fail-stop | 4 | PASS | human_denied | 15147 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/capstone-fail-stop-4.jsonl |  |
| capstone-fail-stop | 5 | PASS | human_denied | 16200 | evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/capstone-fail-stop-5.jsonl |  |

model=ollama/qwen3.8:27b  pass=19/20  startedAt=2026-11-02T04:04:19.004Z

case                          result  stop_reason     tools
read-happy                    PASS    success         read
custom-tool-call              PASS    success         hello
custom-tool-schema-conflict   PASS    success         hello
max-turns-brake               PASS    max_turns       read
tool-timeout-brake            FAIL    success         (none)  ← stop_reason=success, expected tool_timeout; tool slow not called (saw: none)
allowlist-no-bash             PASS    success         (none)
path-escape-denied            PASS    path_denied     read
context-budget-brake          PASS    context_budget  read
tool-result-truncate          PASS    success         read,read,read,read,read,read
retry-recovers                PASS    success         flaky
retry-exhausted-brake         PASS    retry_exhausted flaky
retry-degrade                 PASS    success         flaky
hitl-approve-write            PASS    success         write
hitl-denied-brake             PASS    human_denied    write
write-outside-writable-denied PASS    path_denied     write
budget-within-limits          PASS    success         read
cost-budget-brake             PASS    cost_budget     read
latency-budget-brake          PASS    latency_budget  slow
capstone-set-clerk            PASS    success         read,write,write,write,write
capstone-fail-stop            PASS    human_denied    read,write

vs previous baseline:
  regressed tool-timeout-brake  tool_timeout → success

SIGN-OFF: BLOCKED（有 FAIL 或回归）
