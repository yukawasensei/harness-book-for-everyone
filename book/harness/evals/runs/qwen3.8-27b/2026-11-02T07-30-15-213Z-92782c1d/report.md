model=ollama/qwen3.8:27b  pass=20/20  startedAt=2026-11-02T07:30:15.213Z  finishedAt=2026-11-02T07:32:02.740Z
Provider-reported tokens: input=11379, output=3082, cacheRead=22703, cacheWrite=0, total=37164; catalog-estimated USD=$0.000000 (not an invoice).

| case id | chapter | pass / attempts (rate) | flaky | stop_reason distribution | median (ms) |
| --- | --- | --- | --- | --- | ---: |
| read-happy | ch02 | 1/1 (100.00%) | no | success: 1 | 4799 |
| custom-tool-call | ch03 | 1/1 (100.00%) | no | success: 1 | 3877 |
| custom-tool-schema-conflict | ch03 | 1/1 (100.00%) | no | success: 1 | 7909 |
| max-turns-brake | ch04 | 1/1 (100.00%) | no | max_turns: 1 | 3448 |
| tool-timeout-brake | ch04 | 1/1 (100.00%) | no | tool_timeout: 1 | 6143 |
| allowlist-no-bash | ch05 | 1/1 (100.00%) | no | success: 1 | 4483 |
| path-escape-denied | ch05 | 1/1 (100.00%) | no | path_denied: 1 | 4236 |
| context-budget-brake | ch07 | 1/1 (100.00%) | no | context_budget: 1 | 3168 |
| tool-result-truncate | ch07 | 1/1 (100.00%) | no | success: 1 | 6356 |
| retry-recovers | ch07 | 1/1 (100.00%) | no | success: 1 | 4524 |
| retry-exhausted-brake | ch07 | 1/1 (100.00%) | no | retry_exhausted: 1 | 3023 |
| retry-degrade | ch07 | 1/1 (100.00%) | no | success: 1 | 4722 |
| hitl-approve-write | ch08 | 1/1 (100.00%) | no | success: 1 | 6283 |
| hitl-denied-brake | ch08 | 1/1 (100.00%) | no | human_denied: 1 | 3136 |
| write-outside-writable-denied | ch08 | 1/1 (100.00%) | no | path_denied: 1 | 3076 |
| budget-within-limits | ch09 | 1/1 (100.00%) | no | success: 1 | 4553 |
| cost-budget-brake | ch09 | 1/1 (100.00%) | no | cost_budget: 1 | 3019 |
| latency-budget-brake | ch09 | 1/1 (100.00%) | no | latency_budget: 1 | 3277 |
| capstone-set-clerk | ch10 | 1/1 (100.00%) | no | success: 1 | 20432 |
| capstone-fail-stop | ch10 | 1/1 (100.00%) | no | human_denied: 1 | 7058 |

flaky = pass rate <100%（含 0%；按本实验定义）。耗时包含子进程启动和验收。

SIGN-OFF: OK（全部 PASS）

每次运行 / Attempts

| case id | attempt | result | stop_reason | duration (ms) | trace | reasons / error |
| --- | ---: | --- | --- | ---: | --- | --- |
| read-happy | 1 | PASS | success | 4799 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/read-happy-1.jsonl |  |
| custom-tool-call | 1 | PASS | success | 3877 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/custom-tool-call-1.jsonl |  |
| custom-tool-schema-conflict | 1 | PASS | success | 7909 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/custom-tool-schema-conflict-1.jsonl |  |
| max-turns-brake | 1 | PASS | max_turns | 3448 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/max-turns-brake-1.jsonl |  |
| tool-timeout-brake | 1 | PASS | tool_timeout | 6143 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/tool-timeout-brake-1.jsonl |  |
| allowlist-no-bash | 1 | PASS | success | 4483 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/allowlist-no-bash-1.jsonl |  |
| path-escape-denied | 1 | PASS | path_denied | 4236 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/path-escape-denied-1.jsonl |  |
| context-budget-brake | 1 | PASS | context_budget | 3168 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/context-budget-brake-1.jsonl |  |
| tool-result-truncate | 1 | PASS | success | 6356 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/tool-result-truncate-1.jsonl |  |
| retry-recovers | 1 | PASS | success | 4524 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/retry-recovers-1.jsonl |  |
| retry-exhausted-brake | 1 | PASS | retry_exhausted | 3023 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/retry-exhausted-brake-1.jsonl |  |
| retry-degrade | 1 | PASS | success | 4722 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/retry-degrade-1.jsonl |  |
| hitl-approve-write | 1 | PASS | success | 6283 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/hitl-approve-write-1.jsonl |  |
| hitl-denied-brake | 1 | PASS | human_denied | 3136 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/hitl-denied-brake-1.jsonl |  |
| write-outside-writable-denied | 1 | PASS | path_denied | 3076 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/write-outside-writable-denied-1.jsonl |  |
| budget-within-limits | 1 | PASS | success | 4553 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/budget-within-limits-1.jsonl |  |
| cost-budget-brake | 1 | PASS | cost_budget | 3019 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/cost-budget-brake-1.jsonl |  |
| latency-budget-brake | 1 | PASS | latency_budget | 3277 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/latency-budget-brake-1.jsonl |  |
| capstone-set-clerk | 1 | PASS | success | 20432 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/capstone-set-clerk-1.jsonl |  |
| capstone-fail-stop | 1 | PASS | human_denied | 7058 | evals/runs/qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/traces/capstone-fail-stop-1.jsonl |  |

model=ollama/qwen3.8:27b  pass=20/20  startedAt=2026-11-02T07:30:15.213Z

case                          result  stop_reason     tools
read-happy                    PASS    success         read
custom-tool-call              PASS    success         hello
custom-tool-schema-conflict   PASS    success         hello
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
capstone-set-clerk            PASS    success         read,write,write,write
capstone-fail-stop            PASS    human_denied    read,write

vs previous baseline: no change

SIGN-OFF: OK（全部 PASS，无回归）
