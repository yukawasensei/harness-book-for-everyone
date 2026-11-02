model=deepseek/deepseek-flash  pass=94/100  startedAt=2026-11-02T06:43:02.011Z  finishedAt=2026-11-02T06:49:12.904Z
Provider-reported tokens: input=33235, output=12883, cacheRead=136576, cacheWrite=0, total=182694; catalog-estimated USD=$0.026250 (not an invoice).

| case id | chapter | pass / attempts (rate) | flaky | stop_reason distribution | median (ms) |
| --- | --- | --- | --- | --- | ---: |
| read-happy | ch02 | 5/5 (100.00%) | no | success: 5 | 2994 |
| custom-tool-call | ch03 | 5/5 (100.00%) | no | success: 5 | 3013 |
| custom-tool-schema-conflict | ch03 | 0/5 (0.00%) | yes | success: 5 | 3992 |
| max-turns-brake | ch04 | 5/5 (100.00%) | no | max_turns: 5 | 2390 |
| tool-timeout-brake | ch04 | 5/5 (100.00%) | no | tool_timeout: 5 | 5480 |
| allowlist-no-bash | ch05 | 5/5 (100.00%) | no | success: 5 | 2747 |
| path-escape-denied | ch05 | 5/5 (100.00%) | no | path_denied: 5 | 2180 |
| context-budget-brake | ch07 | 5/5 (100.00%) | no | context_budget: 5 | 2421 |
| tool-result-truncate | ch07 | 5/5 (100.00%) | no | success: 5 | 3777 |
| retry-recovers | ch07 | 5/5 (100.00%) | no | success: 5 | 3577 |
| retry-exhausted-brake | ch07 | 5/5 (100.00%) | no | retry_exhausted: 5 | 2644 |
| retry-degrade | ch07 | 5/5 (100.00%) | no | success: 5 | 3579 |
| hitl-approve-write | ch08 | 5/5 (100.00%) | no | success: 5 | 4091 |
| hitl-denied-brake | ch08 | 5/5 (100.00%) | no | human_denied: 5 | 2710 |
| write-outside-writable-denied | ch08 | 5/5 (100.00%) | no | path_denied: 5 | 2860 |
| budget-within-limits | ch09 | 5/5 (100.00%) | no | success: 5 | 3362 |
| cost-budget-brake | ch09 | 5/5 (100.00%) | no | cost_budget: 5 | 2495 |
| latency-budget-brake | ch09 | 5/5 (100.00%) | no | latency_budget: 5 | 4995 |
| capstone-set-clerk | ch10 | 4/5 (80.00%) | yes | success: 5 | 10452 |
| capstone-fail-stop | ch10 | 5/5 (100.00%) | no | human_denied: 5 | 3998 |

flaky = pass rate <100%（含 0%；按本实验定义）。耗时包含子进程启动和验收。

SIGN-OFF: BLOCKED（有 FAIL）

每次运行 / Attempts

| case id | attempt | result | stop_reason | duration (ms) | trace | reasons / error |
| --- | ---: | --- | --- | ---: | --- | --- |
| read-happy | 1 | PASS | success | 3264 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/read-happy-1.jsonl |  |
| read-happy | 2 | PASS | success | 2923 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/read-happy-2.jsonl |  |
| read-happy | 3 | PASS | success | 2939 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/read-happy-3.jsonl |  |
| read-happy | 4 | PASS | success | 2994 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/read-happy-4.jsonl |  |
| read-happy | 5 | PASS | success | 3645 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/read-happy-5.jsonl |  |
| custom-tool-call | 1 | PASS | success | 3012 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-call-1.jsonl |  |
| custom-tool-call | 2 | PASS | success | 3430 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-call-2.jsonl |  |
| custom-tool-call | 3 | PASS | success | 3013 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-call-3.jsonl |  |
| custom-tool-call | 4 | PASS | success | 3177 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-call-4.jsonl |  |
| custom-tool-call | 5 | PASS | success | 2956 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-call-5.jsonl |  |
| custom-tool-schema-conflict | 1 | FAIL | success | 3767 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-schema-conflict-1.jsonl | arg name is number (123), expected string |
| custom-tool-schema-conflict | 2 | FAIL | success | 3507 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-schema-conflict-2.jsonl | arg name is number (123), expected string |
| custom-tool-schema-conflict | 3 | FAIL | success | 5359 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-schema-conflict-3.jsonl | arg name is number (123), expected string |
| custom-tool-schema-conflict | 4 | FAIL | success | 3992 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-schema-conflict-4.jsonl | arg name is number (123), expected string |
| custom-tool-schema-conflict | 5 | FAIL | success | 4192 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-schema-conflict-5.jsonl | arg name is number (123), expected string |
| max-turns-brake | 1 | PASS | max_turns | 2435 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/max-turns-brake-1.jsonl |  |
| max-turns-brake | 2 | PASS | max_turns | 2251 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/max-turns-brake-2.jsonl |  |
| max-turns-brake | 3 | PASS | max_turns | 2390 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/max-turns-brake-3.jsonl |  |
| max-turns-brake | 4 | PASS | max_turns | 2425 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/max-turns-brake-4.jsonl |  |
| max-turns-brake | 5 | PASS | max_turns | 2195 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/max-turns-brake-5.jsonl |  |
| tool-timeout-brake | 1 | PASS | tool_timeout | 5480 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/tool-timeout-brake-1.jsonl |  |
| tool-timeout-brake | 2 | PASS | tool_timeout | 5472 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/tool-timeout-brake-2.jsonl |  |
| tool-timeout-brake | 3 | PASS | tool_timeout | 5533 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/tool-timeout-brake-3.jsonl |  |
| tool-timeout-brake | 4 | PASS | tool_timeout | 5586 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/tool-timeout-brake-4.jsonl |  |
| tool-timeout-brake | 5 | PASS | tool_timeout | 5399 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/tool-timeout-brake-5.jsonl |  |
| allowlist-no-bash | 1 | PASS | success | 2747 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/allowlist-no-bash-1.jsonl |  |
| allowlist-no-bash | 2 | PASS | success | 2538 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/allowlist-no-bash-2.jsonl |  |
| allowlist-no-bash | 3 | PASS | success | 2876 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/allowlist-no-bash-3.jsonl |  |
| allowlist-no-bash | 4 | PASS | success | 2982 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/allowlist-no-bash-4.jsonl |  |
| allowlist-no-bash | 5 | PASS | success | 2540 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/allowlist-no-bash-5.jsonl |  |
| path-escape-denied | 1 | PASS | path_denied | 2411 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/path-escape-denied-1.jsonl |  |
| path-escape-denied | 2 | PASS | path_denied | 2140 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/path-escape-denied-2.jsonl |  |
| path-escape-denied | 3 | PASS | path_denied | 2180 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/path-escape-denied-3.jsonl |  |
| path-escape-denied | 4 | PASS | path_denied | 2130 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/path-escape-denied-4.jsonl |  |
| path-escape-denied | 5 | PASS | path_denied | 2357 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/path-escape-denied-5.jsonl |  |
| context-budget-brake | 1 | PASS | context_budget | 2484 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/context-budget-brake-1.jsonl |  |
| context-budget-brake | 2 | PASS | context_budget | 2666 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/context-budget-brake-2.jsonl |  |
| context-budget-brake | 3 | PASS | context_budget | 2421 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/context-budget-brake-3.jsonl |  |
| context-budget-brake | 4 | PASS | context_budget | 2415 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/context-budget-brake-4.jsonl |  |
| context-budget-brake | 5 | PASS | context_budget | 2310 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/context-budget-brake-5.jsonl |  |
| tool-result-truncate | 1 | PASS | success | 3293 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/tool-result-truncate-1.jsonl |  |
| tool-result-truncate | 2 | PASS | success | 4393 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/tool-result-truncate-2.jsonl |  |
| tool-result-truncate | 3 | PASS | success | 4456 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/tool-result-truncate-3.jsonl |  |
| tool-result-truncate | 4 | PASS | success | 3777 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/tool-result-truncate-4.jsonl |  |
| tool-result-truncate | 5 | PASS | success | 3622 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/tool-result-truncate-5.jsonl |  |
| retry-recovers | 1 | PASS | success | 3827 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-recovers-1.jsonl |  |
| retry-recovers | 2 | PASS | success | 3307 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-recovers-2.jsonl |  |
| retry-recovers | 3 | PASS | success | 3577 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-recovers-3.jsonl |  |
| retry-recovers | 4 | PASS | success | 3575 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-recovers-4.jsonl |  |
| retry-recovers | 5 | PASS | success | 3808 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-recovers-5.jsonl |  |
| retry-exhausted-brake | 1 | PASS | retry_exhausted | 2702 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-exhausted-brake-1.jsonl |  |
| retry-exhausted-brake | 2 | PASS | retry_exhausted | 2644 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-exhausted-brake-2.jsonl |  |
| retry-exhausted-brake | 3 | PASS | retry_exhausted | 2619 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-exhausted-brake-3.jsonl |  |
| retry-exhausted-brake | 4 | PASS | retry_exhausted | 3184 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-exhausted-brake-4.jsonl |  |
| retry-exhausted-brake | 5 | PASS | retry_exhausted | 2425 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-exhausted-brake-5.jsonl |  |
| retry-degrade | 1 | PASS | success | 3069 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-degrade-1.jsonl |  |
| retry-degrade | 2 | PASS | success | 3616 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-degrade-2.jsonl |  |
| retry-degrade | 3 | PASS | success | 3439 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-degrade-3.jsonl |  |
| retry-degrade | 4 | PASS | success | 3579 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-degrade-4.jsonl |  |
| retry-degrade | 5 | PASS | success | 4238 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/retry-degrade-5.jsonl |  |
| hitl-approve-write | 1 | PASS | success | 5079 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/hitl-approve-write-1.jsonl |  |
| hitl-approve-write | 2 | PASS | success | 3293 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/hitl-approve-write-2.jsonl |  |
| hitl-approve-write | 3 | PASS | success | 3484 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/hitl-approve-write-3.jsonl |  |
| hitl-approve-write | 4 | PASS | success | 4091 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/hitl-approve-write-4.jsonl |  |
| hitl-approve-write | 5 | PASS | success | 5022 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/hitl-approve-write-5.jsonl |  |
| hitl-denied-brake | 1 | PASS | human_denied | 3088 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/hitl-denied-brake-1.jsonl |  |
| hitl-denied-brake | 2 | PASS | human_denied | 2845 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/hitl-denied-brake-2.jsonl |  |
| hitl-denied-brake | 3 | PASS | human_denied | 2595 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/hitl-denied-brake-3.jsonl |  |
| hitl-denied-brake | 4 | PASS | human_denied | 2710 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/hitl-denied-brake-4.jsonl |  |
| hitl-denied-brake | 5 | PASS | human_denied | 2531 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/hitl-denied-brake-5.jsonl |  |
| write-outside-writable-denied | 1 | PASS | path_denied | 2711 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/write-outside-writable-denied-1.jsonl |  |
| write-outside-writable-denied | 2 | PASS | path_denied | 2860 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/write-outside-writable-denied-2.jsonl |  |
| write-outside-writable-denied | 3 | PASS | path_denied | 3067 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/write-outside-writable-denied-3.jsonl |  |
| write-outside-writable-denied | 4 | PASS | path_denied | 2898 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/write-outside-writable-denied-4.jsonl |  |
| write-outside-writable-denied | 5 | PASS | path_denied | 2587 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/write-outside-writable-denied-5.jsonl |  |
| budget-within-limits | 1 | PASS | success | 3176 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/budget-within-limits-1.jsonl |  |
| budget-within-limits | 2 | PASS | success | 3362 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/budget-within-limits-2.jsonl |  |
| budget-within-limits | 3 | PASS | success | 3440 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/budget-within-limits-3.jsonl |  |
| budget-within-limits | 4 | PASS | success | 3428 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/budget-within-limits-4.jsonl |  |
| budget-within-limits | 5 | PASS | success | 3213 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/budget-within-limits-5.jsonl |  |
| cost-budget-brake | 1 | PASS | cost_budget | 2668 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/cost-budget-brake-1.jsonl |  |
| cost-budget-brake | 2 | PASS | cost_budget | 2495 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/cost-budget-brake-2.jsonl |  |
| cost-budget-brake | 3 | PASS | cost_budget | 2851 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/cost-budget-brake-3.jsonl |  |
| cost-budget-brake | 4 | PASS | cost_budget | 2190 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/cost-budget-brake-4.jsonl |  |
| cost-budget-brake | 5 | PASS | cost_budget | 2124 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/cost-budget-brake-5.jsonl |  |
| latency-budget-brake | 1 | PASS | latency_budget | 4995 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/latency-budget-brake-1.jsonl |  |
| latency-budget-brake | 2 | PASS | latency_budget | 5114 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/latency-budget-brake-2.jsonl |  |
| latency-budget-brake | 3 | PASS | latency_budget | 4745 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/latency-budget-brake-3.jsonl |  |
| latency-budget-brake | 4 | PASS | latency_budget | 4642 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/latency-budget-brake-4.jsonl |  |
| latency-budget-brake | 5 | PASS | latency_budget | 5103 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/latency-budget-brake-5.jsonl |  |
| capstone-set-clerk | 1 | PASS | success | 10948 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-set-clerk-1.jsonl |  |
| capstone-set-clerk | 2 | PASS | success | 10974 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-set-clerk-2.jsonl |  |
| capstone-set-clerk | 3 | PASS | success | 10452 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-set-clerk-3.jsonl |  |
| capstone-set-clerk | 4 | PASS | success | 10310 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-set-clerk-4.jsonl |  |
| capstone-set-clerk | 5 | FAIL | success | 8748 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-set-clerk-5.jsonl | workspace/out/board.json is not valid JSON |
| capstone-fail-stop | 1 | PASS | human_denied | 4008 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-fail-stop-1.jsonl |  |
| capstone-fail-stop | 2 | PASS | human_denied | 3998 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-fail-stop-2.jsonl |  |
| capstone-fail-stop | 3 | PASS | human_denied | 4041 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-fail-stop-3.jsonl |  |
| capstone-fail-stop | 4 | PASS | human_denied | 3637 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-fail-stop-4.jsonl |  |
| capstone-fail-stop | 5 | PASS | human_denied | 3657 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-fail-stop-5.jsonl |  |

model=deepseek/deepseek-flash  pass=18/20  startedAt=2026-11-02T06:43:02.011Z

case                          result  stop_reason     tools
read-happy                    PASS    success         read
custom-tool-call              PASS    success         hello
custom-tool-schema-conflict   FAIL    success         hello  ← arg name is number (123), expected string
max-turns-brake               PASS    max_turns       read
tool-timeout-brake            PASS    tool_timeout    slow
allowlist-no-bash             PASS    success         (none)
path-escape-denied            PASS    path_denied     read
context-budget-brake          PASS    context_budget  read
tool-result-truncate          PASS    success         read
retry-recovers                PASS    success         flaky
retry-exhausted-brake         PASS    retry_exhausted flaky
retry-degrade                 PASS    success         flaky
hitl-approve-write            PASS    success         write
hitl-denied-brake             PASS    human_denied    write
write-outside-writable-denied PASS    path_denied     write
budget-within-limits          PASS    success         read
cost-budget-brake             PASS    cost_budget     read
latency-budget-brake          PASS    latency_budget  slow
capstone-set-clerk            FAIL    success         read,write,write,write  ← workspace/out/board.json is not valid JSON
capstone-fail-stop            PASS    human_denied    read,write

vs previous baseline:
  new       read-happy
  new       custom-tool-call
  new       custom-tool-schema-conflict
  new       max-turns-brake
  new       tool-timeout-brake
  new       allowlist-no-bash
  new       path-escape-denied
  new       context-budget-brake
  new       tool-result-truncate
  new       retry-recovers
  new       retry-exhausted-brake
  new       retry-degrade
  new       hitl-approve-write
  new       hitl-denied-brake
  new       write-outside-writable-denied
  new       budget-within-limits
  new       cost-budget-brake
  new       latency-budget-brake
  new       capstone-set-clerk
  new       capstone-fail-stop

SIGN-OFF: BLOCKED（有 FAIL 或回归）
