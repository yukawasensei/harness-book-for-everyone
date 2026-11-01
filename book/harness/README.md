# 书中的 Harness / Book Harness

《写给大家看的 Harness 书》全书只维护这一个 harness，逐章增长；每章结束打 git tag（`ch02`、`ch03`…），用 `git checkout chNN` 对照。

## 各章增量 / What each chapter adds

### Ch2 · 从零写最小 harness

| 能力 | 文件 |
|---|---|
| 选模型：`ollama/qwen3.8:27b`（`MODEL_ID` 可覆盖） | `src/index.ts` |
| 工具白名单写在 harness 里，按 case 的 `allowed_tools` 开放 | `src/index.ts` + `cases/cases.json` |
| 内存会话，不落 pi 会话文件 | `src/index.ts` |
| 事件压成 JSONL trace + `harness_end.stop_reason` | `src/trace.ts` |
| 用 trace 验收 case（工具名 + `stop_reason` + 白名单外工具） | `src/check-trace.ts` |

### Ch3 · 自己造工具 + 隔离本机 pi 配置

| 能力 | 文件 |
|---|---|
| 自定义工具 `hello`：**Schema**（`parameters`，给模型看的合同）与 **Executor**（`execute`，真正运行的代码）分开 | `src/tools/hello.ts` |
| 自定义工具也受白名单约束：不在 `allowed_tools` 里就不注册 | `src/index.ts` |
| Trace 增记：模型原始参数 `tool_execution_start.args`、executor 收到的 `tool_execution_end.details`、助手最终回答 `text` | `src/trace.ts` |
| 验收可断言参数真实类型 `expect.arg_types` | `src/check-trace.ts` |
| **隔离 `~/.pi`**：只用仓库里的 `pi-agent/models.json`；不加载全局扩展、技能、提示模板、主题、AGENTS.md；凭据只在内存 | `src/isolated-pi.ts` |
| 开跑前留证：`harness_start.extensions`（应为 0）与 `activeTools` | `src/index.ts` |

### Ch4 · 刹车：轮数与超时

| 能力 | 文件 |
|---|---|
| 停机原因只记一处：`run.stop(reason)`，第一次生效，写 `harness_stop` | `src/run-state.ts` |
| 轮数上限：pi 钩子 `session.agent.shouldStopAfterTurn`，每轮写 `turn_guard`，到 `max_turns` 停 | `src/gates/max-turns.ts` |
| 工具超时：harness 给**所有**自定义工具统一套计时器，不靠工具自己守时 | `src/gates/tool-timeout.ts` |
| 闸门咬住后用 pi 钩子 `afterToolCall` 返回 `terminate: true`，结束本批工具 | `src/index.ts` |
| 演示工具 `slow`（自己没有任何超时逻辑） | `src/tools/slow.ts` |
| 闸门参数写在 case 里（`max_turns`、`tool_timeout_ms`），不写在 prompt 里 | `cases/cases.json` |
| 退出码：`0` success · `2` 闸门刹车 · `1` 模型错误 | `src/index.ts` |

`stop_reason`：`success | max_turns | tool_timeout | model_error`。

## 为什么要隔离 `~/.pi`

pi 默认会读 `~/.pi/agent/` 下的扩展、技能、全局 AGENTS.md、模型清单和凭据。每台机器都不一样：同一份代码，在作者机器上可能多出扩展工具、多一段系统提示，trace 也就对不上。书里的 harness 用 pi SDK 的三处开关把它们关掉：

```ts
ModelRuntime.create({ credentials: new InMemoryCredentialStore(), modelsPath: "pi-agent/models.json", refreshOnCreate: false })
SettingsManager.inMemory(...)
new DefaultResourceLoader({ agentDir: "pi-agent", noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true })
```

再把同一个 `agentDir` / `settingsManager` / `resourceLoader` 传给 `createAgentSession`。

## 招牌实验：参数类型冲突

case `custom-tool-schema-conflict`：prompt 要求“把 name 作为数字 123 提交”，schema 要求字符串。看三处证据：

1. `tool_execution_start.args`：模型**原始**发出的参数（在 pi 校验之前发出，不会被改写）。
2. `tool_execution_end.details.receivedType`：executor **实际收到**的类型。注意 pi 会在 executor 之前按 schema 做类型转换（数字 `123` → 字符串 `"123"`），所以这一项总是 `string`，**不能**用来证明模型守规矩。
3. 助手最终的 `text`：模型**嘴上说**自己传了什么。实测同一 prompt 两次运行，一次谎称“传的是数字”，一次如实说“字符串”。

验收只认第 1 项：`expect.arg_types = { "name": "string" }`。

## 运行 / Run

```bash
cd book/harness
npm install
npm test            # 离线：case 规格、trace 映射、验收器、schema/executor、类型转换、隔离（不需要 Ollama）
npm run typecheck

# 有本机 Ollama 时（CASE_ID 选 case，默认 read-happy）
NO_PROXY=127.0.0.1,localhost CASE_ID=custom-tool-call npm start
npm run check -- traces/latest.jsonl custom-tool-call    # PASS custom-tool-call
```

## Case

| id | 章 | 允许工具 | 期望 |
|---|---|---|---|
| `read-happy` | ch02 | `read` | 调用 `read`，`stop_reason=success` |
| `custom-tool-call` | ch03 | `hello` | 调用 `hello`，`name` 为字符串，`success` |
| `custom-tool-schema-conflict` | ch03（实验） | `hello` | 同上；对照模型口头陈述 |
| `max-turns-brake` | ch04 | `read`（`max_turns=1`） | `stop_reason=max_turns` |
| `tool-timeout-brake` | ch04 | `slow`（`tool_timeout_ms=400`） | 调用 `slow`，`stop_reason=tool_timeout` |

设计来源：[`notes/_curriculum-redesign-proposal.md`](../../notes/_curriculum-redesign-proposal.md)。
