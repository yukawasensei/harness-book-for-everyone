# 第 5 课：最小 Harness

这一课不再通过 `pi` CLI 启动 Agent，而是直接使用 Pi SDK 创建和控制会话。

## 本课观察的控制点

1. Harness 显式选择 `ollama/qwen3.8:27b`。
2. Harness 只开放 `read` 工具（allowlist）。
3. Harness 使用内存会话，不产生 Pi 会话历史文件。
4. Harness 订阅并记录 Agent 事件。
5. Harness 用 `try/finally` 保证订阅和会话被释放。
6. **maxTurns**：通过 `session.agent.shouldStopAfterTurn`（pi-agent-core 官方钩子）在完成 N 轮后刹车；trace 写入 `turn_guard` / `harness_stop`（`stop_reason=max_turns`）与 `harness_end`。

已加入：单工具超时（TOOL_TIMEOUT_MS + demo slow）。仍延后：路径策略深化。

数据流：

```text
prompt → model → toolCall → Harness 执行（allowlist + 可选超时）
       → toolResult / tool_timeout → model → … → shouldStopAfterTurn? → final / max_turns / tool_timeout
```

## 运行

```bash
cd labs/05-minimal-harness
# 单元测试（不依赖 Ollama）
npm test
npm run typecheck
# 正常跑（默认 MAX_TURNS=8）
NO_PROXY=127.0.0.1,localhost npm start
npm run analyze

# 强制触顶演示（第 1 轮结束后刹车；需本机 Ollama）
NO_PROXY=127.0.0.1,localhost MAX_TURNS=1 npm start
```

`src/index.ts`、`src/analyze-trace.ts`、`src/max-turns*.ts` 都会拒绝在 Windows Node 下运行（分析器与 harness）。运行结果写入 `traces/latest.jsonl`。

Ollama 未启动时：`npm test` 仍应通过；`npm start` 可跳过。

## Hard boundaries (tool timeout + allowlist)

Env knobs used by evals (public lab API):

| Env | Meaning |
|---|---|
| `MAX_TURNS` | Stop after N completed turns (`stop_reason=max_turns`) |
| `TOOL_TIMEOUT_MS` | Per-tool harness timeout; `0`/unset = off (`stop_reason=tool_timeout`) |
| `EVAL_ALLOWED_TOOLS` | Comma list, e.g. `read` or `slow` |
| `EVAL_PROMPT` | Override user prompt for live evals |

Demo tool `slow` sleeps for `delay_ms` and is registered only when allowlisted. It exists so timeout evals are deterministic.

