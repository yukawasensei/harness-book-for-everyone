> **旧版参考资料**：已并入第 10 章（[ch10](../../book/harness/chapters/ch10.md)）。

# 第 7 课实验：片场场记 · 评测桩 + 模型适配器 + 流水线 / Lab 07 Set Continuity Clerk

**桩是合同，模型是供应商；单技能绿 ≠ 流水线绿；整链预算 ≠ 单技能上限。** 四个内容生产技能默认用确定性假实现；设 `MODEL=ollama` 时走本地 qwen，但 **schema / path / Trace 评测桩不变**。课 22 增加整链 `case-pipeline`；课 23 增加整链成本/延迟闸门（`eval:budget`）。

公开课虚拟产品；**无真实公司品牌、无账号、无公网发布**。

## 产品经理看什么

| 概念 | 含义 |
|---|---|
| 评测桩 | 验收标准：fixture → `workspace/out/` → schema/path/Trace |
| 模型适配器 | 可替换后端（默认 Ollama/qwen）；换模型不改 case |
| 生产流水线 | 顺序锁死；中段失败 **fail-stop**；整链预算罩整条线 |
| pipeline case | 证明四份产出 + `traces/case-pipeline.jsonl` 完整（不只单技能） |
| 整链预算 | `PIPELINE_MAX_MS` / `PIPELINE_COST_UNITS`；超限独立 `stop_reason`，不并进 `pipeline_fail` |
| 降级回桩 | 解析失败记 Trace，可回 stub，仍须写对路径 |
| FAIL 条件 | schema / path / Trace / 流水线 / 预算闸门任一破坏 → 不过 |

## 四个技能（有序管线）

| 顺序 | 技能 | 产出 | 断言 |
|---:|---|---|---|
| 1 | `pick_topic` | `workspace/out/topic.json` | 必有字段 + 路径 + Trace |
| 2 | `draft_script` | `workspace/out/script.md` | 结构标题 + 路径 + Trace |
| 3 | `draft_board` | `workspace/out/board.json` | cast/props/scenes/shots + 路径 + Trace |
| 4 | `shot_prompts` | `workspace/out/prompts.json` | 每镜一条 prompt + 路径 + Trace |

另有 **`case-pipeline`**：`format: pipeline`，断言上述四路径齐全、`traces/case-pipeline.jsonl` 含四次 write、`stop_reason=success`、步骤顺序正确。

## 工程师跑什么

```bash
cd labs/07-set-clerk

# CI / 无模型（必须全绿：4 单技能 + 1 流水线 = 5/5）
npm test          # = eval:schema：run-pipeline + schema/path/Trace（不设预算 env）
npm run stubs     # 强制 stub 写入整链
npm run pipeline  # 只跑编排（fail-stop + pipeline Trace）

# 课 23：整链预算闸门（与快乐路径分开）
npm run eval:budget
# 成本：PIPELINE_COST_UNITS=2 → 停在 draft_board 前；Trace=pipeline_cost_budget
# 延迟：PIPELINE_MAX_MS=0 → 停在 pick_topic 前；Trace=pipeline_latency_budget

# 可选 live（本机 Ollama；不挡 CI）
NO_PROXY=127.0.0.1,localhost MODEL=ollama npm run eval:live
```

**失败策略（产品默认）**：中段抛错或非 `success` → 停链，Trace `harness_end.stop_reason=pipeline_fail`，进程非 0；不做「半成品降级交卷」。

**整链预算（课 23）**：成本/延迟按整次流水线计。

| 变量 | 含义 | 超限 `stop_reason` |
|---|---|---|
| `PIPELINE_MAX_MS` | 整链墙钟（毫秒）；`0` = 第一步前必停 | `pipeline_latency_budget` |
| `PIPELINE_COST_UNITS` | 教学代理额度；每 **启动** 一技能扣 1；剩余 `<1` 则停 | `pipeline_cost_budget` |

默认 **不设** 这两项，避免拖慢 stub CI。预算事件写在 `traces/case-pipeline.jsonl`（`eventType=pipeline_budget` + 最终 `harness_end`），**不会**折叠成泛化的 `pipeline_fail`。

**其他环境变量**

| 变量 | 含义 | 默认 |
|---|---|---|
| `MODEL` / `SET_CLERK_BACKEND` | `stub` 或 `ollama` | `stub` |
| `OLLAMA_HOST` | Ollama 地址 | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | 本地模型 tag | `qwen3.8:27b` |
| `NO_PROXY` | 避免代理劫持 localhost | live 脚本会强制写入 |

## 目录

```text
fixtures/brief.json     # 输入 fixture
src/skills/*.mjs        # 四技能（stub + 可选模型）
src/model-adapter.mjs   # Ollama 适配器 / JSON 解析 / 降级
src/path-sandbox.mjs    # 只允许 workspace/out
src/trace.mjs           # 最小 JSONL Trace
src/run-all.mjs         # 旧管道（仍可手动跑）
src/run-pipeline.mjs    # 整链编排：fail-stop + 预算闸门 + case-pipeline Trace
src/validate-schema.mjs # cases 断言（含 format=pipeline）
src/eval-budget.mjs     # 课 23：紧预算注入 + Trace/产物断言
src/eval-live.mjs       # 可选 live
cases.json              # 4 单技能 + 1 pipeline
workspace/out/
traces/
```

## 对照笔记

- 课 19 产品：[notes/pm-learning/19-set-clerk-content-production.md](../../notes/pm-learning/19-set-clerk-content-production.md)
- 课 20 评测桩：[notes/pm-learning/20-skill-eval-stubs.md](../../notes/pm-learning/20-skill-eval-stubs.md)
- 课 21 接模型：[notes/pm-learning/21-model-behind-stubs.md](../../notes/pm-learning/21-model-behind-stubs.md)
- 课 22 流水线：[notes/pm-learning/22-production-pipeline.md](../../notes/pm-learning/22-production-pipeline.md)
- 课 23 整链预算：[notes/pm-learning/23-pipeline-budget.md](../../notes/pm-learning/23-pipeline-budget.md)
