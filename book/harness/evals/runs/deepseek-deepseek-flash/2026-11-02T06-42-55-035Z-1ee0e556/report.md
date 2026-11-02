model=deepseek/deepseek-flash  pass=1/1  startedAt=2026-11-02T06:42:55.035Z  finishedAt=2026-11-02T06:42:58.169Z
Provider-reported tokens: input=1149, output=74, cacheRead=768, cacheWrite=0, total=1991; catalog-estimated USD=$0.000438 (not an invoice).

| case id | chapter | pass / attempts (rate) | flaky | stop_reason distribution | median (ms) |
| --- | --- | --- | --- | --- | ---: |
| read-happy | ch02 | 1/1 (100.00%) | no | success: 1 | 3132 |

flaky = pass rate <100%（含 0%；按本实验定义）。耗时包含子进程启动和验收。

SIGN-OFF: OK（全部 PASS）

每次运行 / Attempts

| case id | attempt | result | stop_reason | duration (ms) | trace | reasons / error |
| --- | ---: | --- | --- | ---: | --- | --- |
| read-happy | 1 | PASS | success | 3132 | evals/runs/deepseek-deepseek-flash/2026-11-02T06-42-55-035Z-1ee0e556/traces/read-happy-1.jsonl |  |

model=deepseek/deepseek-flash  pass=1/1  startedAt=2026-11-02T06:42:55.035Z

case                          result  stop_reason     tools
read-happy                    PASS    success         read

vs previous baseline:
  new       read-happy

SIGN-OFF: OK（全部 PASS，无回归）
