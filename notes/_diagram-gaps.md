# 书稿配图缺口清单 / Diagram gaps (book/harness/chapters)

> 风格锁定见 [`skills/harness-diagram/SKILL.md`](../skills/harness-diagram/SKILL.md)：纯白底 `#FFFFFF`、16:9（1280×720）、扁平教材矢量、每个框都要中英双语；蓝 = 工具/输入，紫 = 闸门/控制，绿 = 评测/成功。
> 画好后放到 `book/harness/assets/`，按下面的文件名保存，再把对应章节的图片链接换掉（或去掉临时说明）。

## 现状

| 章 | 当前用图 | 状态 |
|---:|---|---|
| 0 | `harness-getting-started.jpg` | 可用 |
| 1 | `harness-tool-loop.jpg` | 可用 |
| 2 | `harness-capability-map.jpg` | 可用（通用总览图；有专属图更好，见缺口 1） |
| 3 | 书稿里的文字示意图 | **缺**（缺口 2） |
| 4 | `harness-hard-boundaries.jpg` | 能用但有错：`max_tums` 笔误；用的是 lab05 的变量名 `TOOL_TIMEOUT_MS`；部分标签只有英文（缺口 3） |
| 5 | `harness-path-sandbox.jpg` | 可用 |
| 6 | `harness-trace-acceptance.jpg` | 可用（有专属图更好，见缺口 4） |
| 7 | `harness-context-budget.jpg` + `harness-retry-degrade.jpg` | 可用 |
| 8 | `harness-hitl-gate.jpg` | 可用 |
| 9 | `harness-cost-latency.jpg` + `harness-pipeline-budget.jpg` | 可用（图 2 画的是旧流水线，书稿里已注明） |
| 10 | `harness-set-clerk.jpg` | 能用但不准：画的是 4 个技能和旧流水线（缺口 5） |

未采用的暖黄/米色旧图（不符合纯白风格）：`harness-turns-timeout.jpg`、`harness-evals-acceptance.jpg`、`harness-maxturns-allowlist.jpg`、`harness-permissions-paths.jpg`、`harness-observability-trace.jpg`、`harness-session-context.jpg`、`harness-selection.jpg`、`harness-collaboration.jpg`。

## 缺口 1 · Ch2 最小 harness 骨架 → `harness-minimal-skeleton.jpg`

- 标题：最小 Harness 的四件事 / Four Jobs of a Minimal Harness
- 布局：从左到右四个阶段，下方是 trace 条
  1. 蓝：选模型 / Pick the model（`ollama/qwen3.8:27b`）
  2. 紫：限定工具 / Allowlist tools（写在 case，不写在 prompt · in the case, not the prompt）
  3. 蓝：跑一次会话 / Run one session（内存会话 · in-memory session）
  4. 绿：写 trace / Write the trace（每个事件一行 JSONL · one JSONL row per event）
- 底部条：`harness_end.stop_reason` = success | model_error
- 绿色成功横幅：验收器读 trace 判 PASS / The checker reads the trace and decides PASS

## 缺口 2 · Ch3 Schema vs Executor + 隔离 → `harness-schema-executor.jpg`

- 标题：自己造工具 / Your Own Tool
- 左半（蓝）：Schema 给模型看的合同 / Schema: the contract the model sees（`hello(name: string)`）
- 中间（紫）：pi 校验与类型转换 / pi validation & coercion（`123` → `"123"`）
- 右半（蓝）：Executor 宿主运行的代码 / Executor: code the host runs（模型碰不到 · the model never sees it）
- 三个证据标签（绿）：① 原始参数 Raw args `tool_execution_start.args` ② 执行收到 Received `details.receivedType` ③ 口头陈述 Claimed `text`；只有 ① 用于验收 / Only ① counts
- 下方虚线框：隔离 `~/.pi` / Isolated from `~/.pi`：不加载扩展、技能、AGENTS.md、本机凭据 / no extensions, skills, AGENTS.md, local credentials；只读 `pi-agent/models.json`

## 缺口 3 · Ch4 刹车（替换 hard-boundaries 用法）→ `harness-brakes.jpg`

- 标题：刹车：轮数与超时 / Brakes: Max Turns and Tool Timeout
- 框 1（紫）：最大轮数 / Max turns：`shouldStopAfterTurn` → `turn_guard` → `stop_reason=max_turns`（case 字段 `max_turns`）
- 框 2（紫）：工具超时 / Tool timeout：harness 给所有工具套计时器 / one timer wraps every tool → `stop_reason=tool_timeout`（case 字段 `tool_timeout_ms`）
- 框 3（绿）：退出码 / Exit codes：0 成功 success · 2 闸门刹车 gate brake · 1 出错 error
- 弯曲虚线：Prompt 里的“请耐心等”被忽略 / “Please be patient” in the prompt is ignored
- 底部：以 trace 字段验收，不以模型口头保证 / Accept via trace fields, not model promises

## 缺口 4 · Ch6 评测基线与签字（可选）→ `harness-eval-baseline.jpg`

- 标题：评测基线与签字 / Eval Baseline & Sign-off
- 流程：全部 case / All cases → 逐条跑 harness / Run each → 归档 trace（抹路径）/ Archive scrubbed traces → baseline.json → 对比上一份 / Compare with previous
- 对比结果四个标签：regressed 回归（红）· fixed 修复 · new 新增 · removed 移除
- 绿色横幅：全部 PASS 且无回归才签字 / Sign off only if all PASS and no regression

## 缺口 5 · Ch10 综合项目 → 替换 `harness-set-clerk.jpg` 或新建 `harness-capstone.jpg`

- 标题：片场场记 · 综合项目 / Set Continuity Clerk · Capstone
- 左（蓝）：输入 brief.json / Input brief → 同一个 pi agent / One pi agent
- 中（紫）：同时打开的闸门 / All gates on：白名单 allowlist · 路径沙箱 path sandbox · 只写 workspace/out writable dir · 写前确认 HITL · 轮数 turns · 预算 budgets
- 右（绿）：三份产物 / Three artifacts：topic.json 选题 → script.md 脚本 → board.json 分镜（≥3 shots）
- 绿色横幅：trace 全绿 + 产物全绿 = 完成 / Green trace + green artifacts = done
- 虚线框：fail-stop：任何一步被拒就停，不留半成品 / Any denial stops the run, no half-finished files
