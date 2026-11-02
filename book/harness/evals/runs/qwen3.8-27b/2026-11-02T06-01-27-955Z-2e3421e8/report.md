model=ollama/qwen3.8:27b  pass=1/1  startedAt=2026-11-02T06:01:27.955Z  finishedAt=2026-11-02T06:02:02.015Z
Provider-reported tokens: input=956, output=101, cacheRead=964, cacheWrite=0, total=2021; catalog-estimated USD=$0.000000 (not an invoice).

| case id | chapter | pass / attempts (rate) | flaky | stop_reason distribution | median (ms) |
| --- | --- | --- | --- | --- | ---: |
| read-happy | ch02 | 1/1 (100.00%) | no | success: 1 | 34058 |

flaky = pass rate <100%（含 0%；按本实验定义）。耗时包含子进程启动和验收。

SIGN-OFF: OK（全部 PASS）

每次运行 / Attempts

| case id | attempt | result | stop_reason | duration (ms) | trace | reasons / error |
| --- | ---: | --- | --- | ---: | --- | --- |
| read-happy | 1 | PASS | success | 34058 | evals/runs/qwen3.8-27b/2026-11-02T06-01-27-955Z-2e3421e8/traces/read-happy-1.jsonl |  |

model=ollama/qwen3.8:27b  pass=1/1  startedAt=2026-11-02T06:01:27.955Z

case                          result  stop_reason     tools
read-happy                    PASS    success         read

vs previous baseline: no change

SIGN-OFF: OK（全部 PASS，无回归）
