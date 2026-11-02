model=deepseek/deepseek-flash  pass=19/20  startedAt=2026-11-02T07:32:03.102Z  finishedAt=2026-11-02T07:33:28.189Z
Provider-reported tokens: input=7642, output=2979, cacheRead=28667, cacheWrite=0, total=39288; catalog-estimated USD=$0.006039 (not an invoice).

| case id | chapter | pass / attempts (rate) | flaky | stop_reason distribution | median (ms) |
| --- | --- | --- | --- | --- | ---: |
| read-happy | ch02 | 1/1 (100.00%) | no | success: 1 | 5658 |
| custom-tool-call | ch03 | 1/1 (100.00%) | no | success: 1 | 3372 |
| custom-tool-schema-conflict | ch03 | 0/1 (0.00%) | yes | success: 1 | 5349 |
| max-turns-brake | ch04 | 1/1 (100.00%) | no | max_turns: 1 | 2995 |
| tool-timeout-brake | ch04 | 1/1 (100.00%) | no | tool_timeout: 1 | 6087 |
| allowlist-no-bash | ch05 | 1/1 (100.00%) | no | success: 1 | 3010 |
| path-escape-denied | ch05 | 1/1 (100.00%) | no | path_denied: 1 | 2831 |
| context-budget-brake | ch07 | 1/1 (100.00%) | no | context_budget: 1 | 2536 |
| tool-result-truncate | ch07 | 1/1 (100.00%) | no | success: 1 | 4458 |
| retry-recovers | ch07 | 1/1 (100.00%) | no | success: 1 | 3845 |
| retry-exhausted-brake | ch07 | 1/1 (100.00%) | no | retry_exhausted: 1 | 3109 |
| retry-degrade | ch07 | 1/1 (100.00%) | no | success: 1 | 3847 |
| hitl-approve-write | ch08 | 1/1 (100.00%) | no | success: 1 | 3772 |
| hitl-denied-brake | ch08 | 1/1 (100.00%) | no | human_denied: 1 | 3465 |
| write-outside-writable-denied | ch08 | 1/1 (100.00%) | no | path_denied: 1 | 2691 |
| budget-within-limits | ch09 | 1/1 (100.00%) | no | success: 1 | 3870 |
| cost-budget-brake | ch09 | 1/1 (100.00%) | no | cost_budget: 1 | 2578 |
| latency-budget-brake | ch09 | 1/1 (100.00%) | no | latency_budget: 1 | 5077 |
| capstone-set-clerk | ch10 | 1/1 (100.00%) | no | success: 1 | 12472 |
| capstone-fail-stop | ch10 | 1/1 (100.00%) | no | human_denied: 1 | 4059 |

flaky = pass rate <100%（含 0%；按本实验定义）。耗时包含子进程启动和验收。

SIGN-OFF: BLOCKED（有 FAIL）

每次运行 / Attempts

| case id | attempt | result | stop_reason | duration (ms) | trace | reasons / error |
| --- | ---: | --- | --- | ---: | --- | --- |
| read-happy | 1 | PASS | success | 5658 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/read-happy-1.jsonl |  |
| custom-tool-call | 1 | PASS | success | 3372 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/custom-tool-call-1.jsonl |  |
| custom-tool-schema-conflict | 1 | FAIL | success | 5349 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/custom-tool-schema-conflict-1.jsonl | tool hello never succeeded; arg name is number (123), expected string |
| max-turns-brake | 1 | PASS | max_turns | 2995 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/max-turns-brake-1.jsonl |  |
| tool-timeout-brake | 1 | PASS | tool_timeout | 6087 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/tool-timeout-brake-1.jsonl |  |
| allowlist-no-bash | 1 | PASS | success | 3010 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/allowlist-no-bash-1.jsonl |  |
| path-escape-denied | 1 | PASS | path_denied | 2831 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/path-escape-denied-1.jsonl |  |
| context-budget-brake | 1 | PASS | context_budget | 2536 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/context-budget-brake-1.jsonl |  |
| tool-result-truncate | 1 | PASS | success | 4458 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/tool-result-truncate-1.jsonl |  |
| retry-recovers | 1 | PASS | success | 3845 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/retry-recovers-1.jsonl |  |
| retry-exhausted-brake | 1 | PASS | retry_exhausted | 3109 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/retry-exhausted-brake-1.jsonl |  |
| retry-degrade | 1 | PASS | success | 3847 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/retry-degrade-1.jsonl |  |
| hitl-approve-write | 1 | PASS | success | 3772 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/hitl-approve-write-1.jsonl |  |
| hitl-denied-brake | 1 | PASS | human_denied | 3465 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/hitl-denied-brake-1.jsonl |  |
| write-outside-writable-denied | 1 | PASS | path_denied | 2691 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/write-outside-writable-denied-1.jsonl |  |
| budget-within-limits | 1 | PASS | success | 3870 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/budget-within-limits-1.jsonl |  |
| cost-budget-brake | 1 | PASS | cost_budget | 2578 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/cost-budget-brake-1.jsonl |  |
| latency-budget-brake | 1 | PASS | latency_budget | 5077 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/latency-budget-brake-1.jsonl |  |
| capstone-set-clerk | 1 | PASS | success | 12472 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/capstone-set-clerk-1.jsonl |  |
| capstone-fail-stop | 1 | PASS | human_denied | 4059 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/capstone-fail-stop-1.jsonl |  |

model=deepseek/deepseek-flash  pass=19/20  startedAt=2026-11-02T07:32:03.102Z

case                          result  stop_reason     tools
read-happy                    PASS    success         read
custom-tool-call              PASS    success         hello
custom-tool-schema-conflict   FAIL    success         hello  ← tool hello never succeeded; arg name is number (123), expected string
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
