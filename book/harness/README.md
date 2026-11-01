# 书中的 Harness · Ch2 最小骨架 / Book Harness · Ch2 skeleton

《写给大家看的 Harness 书》全书只维护这一个 harness，逐章增长；每章结束打 git tag（`ch02`、`ch03`…），用 `git checkout chNN` 对照。

## Ch2 做了什么 / What Ch2 adds

| 能力 | 文件 |
|---|---|
| 选模型：`ollama/qwen3.8:27b`（`MODEL_ID` 可覆盖） | `src/index.ts` |
| 工具白名单写在 harness 里（本章只开 `read`） | `src/index.ts` + `cases/cases.json` |
| 内存会话，不落 pi 会话文件 | `src/index.ts` |
| 事件压成 JSONL trace + `harness_end.stop_reason` | `src/trace.ts` |
| 用 trace 验收 case（工具名 + `stop_reason` + 白名单外工具） | `src/check-trace.ts` |

`stop_reason` 本章只有 `success | model_error`；后续章节逐个加入 `max_turns`、`tool_timeout`、`path_denied`……

## 运行 / Run

```bash
cd book/harness
npm install
npm test            # 离线：case 规格 + trace 映射 + 验收器（不需要 Ollama）
npm run typecheck

# 有本机 Ollama 时
NO_PROXY=127.0.0.1,localhost npm start   # 写 traces/latest.jsonl
npm run check                             # PASS read-happy
```

## 本章 case

| id | 允许工具 | 期望 |
|---|---|---|
| `read-happy` | `read` | 调用 `read`，`stop_reason=success` |

设计来源：[`notes/_curriculum-redesign-proposal.md`](../../notes/_curriculum-redesign-proposal.md)。
