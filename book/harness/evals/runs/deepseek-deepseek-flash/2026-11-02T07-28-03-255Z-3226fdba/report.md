model=deepseek/deepseek-flash  pass=10/15  startedAt=2026-11-02T07:28:03.255Z  finishedAt=2026-11-02T07:29:50.614Z
Provider-reported tokens: input=7664, output=7321, cacheRead=45952, cacheWrite=0, total=60937; catalog-estimated USD=$0.011360 (not an invoice).

| case id | chapter | pass / attempts (rate) | flaky | stop_reason distribution | median (ms) |
| --- | --- | --- | --- | --- | ---: |
| custom-tool-schema-conflict | ch03 | 0/5 (0.00%) | yes | success: 5 | 4413 |
| tool-timeout-brake | ch04 | 5/5 (100.00%) | no | tool_timeout: 5 | 5403 |
| capstone-set-clerk | ch10 | 5/5 (100.00%) | no | success: 5 | 11713 |

flaky = pass rate <100%（含 0%；按本实验定义）。耗时包含子进程启动和验收。

SIGN-OFF: BLOCKED（有 FAIL）

每次运行 / Attempts

| case id | attempt | result | stop_reason | duration (ms) | trace | reasons / error |
| --- | ---: | --- | --- | ---: | --- | --- |
| custom-tool-schema-conflict | 1 | FAIL | success | 4059 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/custom-tool-schema-conflict-1.jsonl | tool hello never succeeded; arg name is number (123), expected string |
| custom-tool-schema-conflict | 2 | FAIL | success | 5023 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/custom-tool-schema-conflict-2.jsonl | tool hello never succeeded; arg name is number (123), expected string |
| custom-tool-schema-conflict | 3 | FAIL | success | 4576 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/custom-tool-schema-conflict-3.jsonl | tool hello never succeeded; arg name is number (123), expected string |
| custom-tool-schema-conflict | 4 | FAIL | success | 3841 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/custom-tool-schema-conflict-4.jsonl | tool hello never succeeded; arg name is number (123), expected string |
| custom-tool-schema-conflict | 5 | FAIL | success | 4413 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/custom-tool-schema-conflict-5.jsonl | tool hello never succeeded; arg name is number (123), expected string |
| tool-timeout-brake | 1 | PASS | tool_timeout | 5928 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/tool-timeout-brake-1.jsonl |  |
| tool-timeout-brake | 2 | PASS | tool_timeout | 5334 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/tool-timeout-brake-2.jsonl |  |
| tool-timeout-brake | 3 | PASS | tool_timeout | 5752 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/tool-timeout-brake-3.jsonl |  |
| tool-timeout-brake | 4 | PASS | tool_timeout | 5398 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/tool-timeout-brake-4.jsonl |  |
| tool-timeout-brake | 5 | PASS | tool_timeout | 5403 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/tool-timeout-brake-5.jsonl |  |
| capstone-set-clerk | 1 | PASS | success | 11713 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/capstone-set-clerk-1.jsonl |  |
| capstone-set-clerk | 2 | PASS | success | 12424 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/capstone-set-clerk-2.jsonl |  |
| capstone-set-clerk | 3 | PASS | success | 13046 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/capstone-set-clerk-3.jsonl |  |
| capstone-set-clerk | 4 | PASS | success | 10876 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/capstone-set-clerk-4.jsonl |  |
| capstone-set-clerk | 5 | PASS | success | 9567 | evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/capstone-set-clerk-5.jsonl |  |

model=deepseek/deepseek-flash  pass=2/3  startedAt=2026-11-02T07:28:03.255Z

case                          result  stop_reason     tools
custom-tool-schema-conflict   FAIL    success         hello  ← tool hello never succeeded; arg name is number (123), expected string
tool-timeout-brake            PASS    tool_timeout    slow
capstone-set-clerk            PASS    success         read,write,write,write

vs previous baseline:
  new       custom-tool-schema-conflict
  new       tool-timeout-brake
  new       capstone-set-clerk

SIGN-OFF: BLOCKED（有 FAIL 或回归）
