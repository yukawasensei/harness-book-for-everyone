# 05 · 轮数与超时

> 视角：产品经理（PM）· 图解 + 费曼  
> 日期：2026-10-31（Asia/Shanghai）  
> 对照：课 5 `labs/05-minimal-harness` 加固 — `maxTurns` + `tools: ["read"]`

## 一句话定义

**轮数与超时**是给 Agent loop 装的刹车：最多转几圈、单次工具最多跑多久、超时或触顶时如何结束并告诉用户「为什么停」。

## 图解

> 配图：**中英文配套**（CN + EN labels）。
![轮数与超时 / Turns & Timeouts](./assets/harness-turns-timeout.jpg)

![maxTurns + 工具白名单 / maxTurns + Tool Allowlist](./assets/harness-maxturns-allowlist.jpg)

## 要点

1. **无限循环是默认风险**：模型可反复 toolCall；没有 `maxTurns` 就会烧时间/钱/机器。  
2. **Turn ≠ 用户句**：一轮常是「模型一次输出」；一次用户任务往往 2+ turns（toolCall + final）。  
3. **单工具超时**：卡死的 shell/网络不能拖死整次会话（**已落地** `TOOL_TIMEOUT_MS` + 演示工具 `slow`；见课 11）。  
4. **终止原因要产品化**：`success | max_turns | tool_timeout | tool_error | model_error`——客服与评测都靠它。  
5. **课 5 工程状态（2026-10-31）**：`maxTurns` **已落地**；`TOOL_TIMEOUT_MS` **已落地**（演示工具 `slow`）；默认工具仍以 `read` 为主，可用 `EVAL_ALLOWED_TOOLS` 切换；路径沙箱仍延后。

## 产品拍板 vs 工程师实现

| 维度 | 产品拍板 | 工程师实现 |
|---|---|---|
| 最大轮数 | 普通任务几轮？复杂任务是否可申请加码？ | `MAX_TURNS` + `shouldStopAfterTurn`、触顶写 `stop_reason=max_turns` |
| 工具边界 | 这课只读文件够不够？ | `tools: ["read"]` allowlist（已有） |
| 单工具超时 | 读文件 3s？跑命令 30s？评测演示几毫秒？ | `TOOL_TIMEOUT_MS` + `withToolTimeout`；超时写 `stop_reason=tool_timeout` |
| 用户感知 | 「思考中」多久后提示？能否手动停？ | 进度 UI、cancel、终止文案 |
| 评测 | 触顶算失败还是部分成功？ | cases 里 `max_turns` 字段与指标 |

## 对照课 5 加固

- 实现位置：`labs/05-minimal-harness/src/max-turns.ts` + `src/index.ts`。  
- 官方钩子：`session.agent.shouldStopAfterTurn`（pi-agent-core）；无单独 `createAgentSession({ maxTurns })` API。  
- Trace：`turn_guard`（每轮计数）、触顶时 `harness_stop` / 收尾 `harness_end` 带 `stop_reason`。  
- 单元测试：`npm test`（不依赖 Ollama）。  
- 触顶演示：`MAX_TURNS=1 NO_PROXY=127.0.0.1,localhost npm start`（需本机 Ollama）。

## 费曼题

**如果没有最大轮数，用户会遇到什么？产品应如何向用户解释「被刹车停住」？**

### PM 的回答

没有上限会**无限循环**：模型反复 toolCall，空转烧**成本**/配额；工具卡住还会变成**死循环**，拖死会话。产品应说「触达安全轮数上限被刹车」，不是「模型坏了」，并给下一步：缩小任务 / 提高限额 / 人工接手。

### 小哈补充

对：无限循环、成本、死循环是同一护栏的三面——轮数顶防空转烧钱，单工具超时防卡死。文案要可审计（终止原因 `max_turns` / `tool_timeout`），别把护栏伪装成模型故障。

### 加固后费曼（2026-10-31）

**maxTurns 与工具 allowlist 各防什么？缺一不可吗？**

- **maxTurns**：防「转太久」——即使工具都合法，也能空转烧钱。  
- **allowlist**：防「碰不该碰的」——即使轮数很少，也不能 bash/写盘。  
- 缺一不可：只有 allowlist 仍可能合法工具死循环；只有 maxTurns 仍可能一轮内干坏事。二者是正交护栏。

### 产品硬约束（PM · 2026-10-31）

**提示词有可能不被遵循，从而失效。一定要在 harness 里强制执行。**

maxTurns、工具 allowlist、路径边界——凡是安全/成本红线，都不能只写在 system prompt 里指望模型「听话」。Prompt 是软建议；Harness 代码与钩子才是硬闸门。

### 小哈补充

对：把「请不要超过 N 轮」写进提示词不算护栏——模型随时可忽略。验收口径应是 *代码路径是否拦住*（如 `shouldStopAfterTurn` / allowlist），而不是 *模型有没有看起来听话*。

## 下一步

- 工程：硬边界评测见 [11 · 硬边界评测](./11-hard-boundaries.md)（`tool-timeout-brake` / `allowlist-no-bash`）。路径沙箱仍可延后。  
- 下一课笔记：[06 · 可观测与 Trace](./06-observability-trace.md) · 上一课：[04 · 权限与路径](./04-permissions-paths.md)
