model=ollama/qwen3.8:27b  pass=13/15  startedAt=2026-11-02T07:23:42.766Z  finishedAt=2026-11-02T07:27:48.876Z
Provider-reported tokens: input=9040, output=9664, cacheRead=62077, cacheWrite=0, total=80781; catalog-estimated USD=$0.000000 (not an invoice).

| case id | chapter | pass / attempts (rate) | flaky | stop_reason distribution | median (ms) |
| --- | --- | --- | --- | --- | ---: |
| custom-tool-schema-conflict | ch03 | 4/5 (80.00%) | yes | success: 5 | 10329 |
| tool-timeout-brake | ch04 | 5/5 (100.00%) | no | tool_timeout: 5 | 5878 |
| capstone-set-clerk | ch10 | 4/5 (80.00%) | yes | success: 5 | 24237 |

flaky = pass rate <100%（含 0%；按本实验定义）。耗时包含子进程启动和验收。

SIGN-OFF: BLOCKED（有 FAIL）

每次运行 / Attempts

| case id | attempt | result | stop_reason | duration (ms) | trace | reasons / error |
| --- | ---: | --- | --- | ---: | --- | --- |
| custom-tool-schema-conflict | 1 | PASS | success | 13813 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/custom-tool-schema-conflict-1.jsonl |  |
| custom-tool-schema-conflict | 2 | PASS | success | 10329 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/custom-tool-schema-conflict-2.jsonl |  |
| custom-tool-schema-conflict | 3 | PASS | success | 15478 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/custom-tool-schema-conflict-3.jsonl |  |
| custom-tool-schema-conflict | 4 | FAIL | success | 9119 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/custom-tool-schema-conflict-4.jsonl | tool hello not called (saw: none); tool hello never succeeded |
| custom-tool-schema-conflict | 5 | PASS | success | 7198 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/custom-tool-schema-conflict-5.jsonl |  |
| tool-timeout-brake | 1 | PASS | tool_timeout | 6333 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/tool-timeout-brake-1.jsonl |  |
| tool-timeout-brake | 2 | PASS | tool_timeout | 5878 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/tool-timeout-brake-2.jsonl |  |
| tool-timeout-brake | 3 | PASS | tool_timeout | 5701 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/tool-timeout-brake-3.jsonl |  |
| tool-timeout-brake | 4 | PASS | tool_timeout | 5606 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/tool-timeout-brake-4.jsonl |  |
| tool-timeout-brake | 5 | PASS | tool_timeout | 6025 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/tool-timeout-brake-5.jsonl |  |
| capstone-set-clerk | 1 | PASS | success | 30525 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/capstone-set-clerk-1.jsonl |  |
| capstone-set-clerk | 2 | PASS | success | 24237 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/capstone-set-clerk-2.jsonl |  |
| capstone-set-clerk | 3 | PASS | success | 18573 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/capstone-set-clerk-3.jsonl |  |
| capstone-set-clerk | 4 | PASS | success | 66371 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/capstone-set-clerk-4.jsonl |  |
| capstone-set-clerk | 5 | FAIL | success | 20917 | evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/capstone-set-clerk-5.jsonl | tool write not called (saw: read); tool write never succeeded; event hitl_decision x0, expected >= 3; write order: missing workspace/out/topic.json,workspace/out/script.md,workspace/out/board.json; workspace/out/topic.json missing; workspace/out/script.md missing; workspace/out/board.json missing |

model=ollama/qwen3.8:27b  pass=1/3  startedAt=2026-11-02T07:23:42.766Z

case                          result  stop_reason     tools
custom-tool-schema-conflict   FAIL    success         (none)  ← tool hello not called (saw: none); tool hello never succeeded
tool-timeout-brake            PASS    tool_timeout    slow
capstone-set-clerk            FAIL    success         read  ← tool write not called (saw: read); tool write never succeeded; event hitl_decision x0, expected >= 3; write order: missing workspace/out/topic.json,workspace/out/script.md,workspace/out/board.json; workspace/out/topic.json missing; workspace/out/script.md missing; workspace/out/board.json missing

vs previous baseline:
  regressed custom-tool-schema-conflict  success → success
  regressed capstone-set-clerk  success → success

SIGN-OFF: BLOCKED（有 FAIL 或回归）
