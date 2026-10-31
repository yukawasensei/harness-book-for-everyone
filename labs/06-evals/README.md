# 第 6 课：最小 Evals

用**固定案例**回答：Harness / Prompt 改动后，是变好还是退化？本课只搭骨架，不跑付费 API，默认不依赖 Ollama。

## 产品经理看什么

| 概念 | 含义 |
|---|---|
| Case | 一条可重复的任务规格：`id`、提示、期望工具 / 终止原因 |
| Baseline | 某次 runner 结果快照；之后对比才能谈「提升」 |
| Pass / Fail | 对照 `expect` 字段，不是「感觉答得对」 |

本目录 **2–3 条种子 case**，覆盖：期望调用 `read`、期望 `stop_reason=max_turns`、schema 合法性。扩展到 ~20 条是后续工作（见 `notes/pm-learning/07-evals-acceptance.md`）。

## 工程师跑什么

```bash
cd <repo-root>/labs/06-evals
npm test          # 校验 cases.json schema（无 Ollama）
# 可选：对照 lab05 产出的 traces/latest.jsonl（需先跑课 5）
# npm run check:trace -- ../05-minimal-harness/traces/latest.jsonl
```

**禁止**：付费云模型 / WaveSpeed 等扣费 API。本地 Ollama 联动留给后续 hook。

## 目录

| 路径 | 作用 |
|---|---|
| `cases.json` | 案例集 |
| `src/validate-cases.mjs` | schema 校验 runner stub |
| `src/check-trace.mjs` | 可选：用期望字段扫一份 JSONL trace（对接 lab05） |

## 与课 5 的关系

课 5 提供 `stop_reason` / tool 事件；本课先保证 **case 可机器读**。真正「跑 agent → 判分」可在 lab05 稳定后把 runner 接到 `createAgentSession`（仍限本地 Ollama）。
