# 写给大家看的 Harness 书 · PM 课表 / Harness Book for Everyone · PM Notes

产品经理视角的 Agent Harness 公开课笔记（**写给大家看的 Harness 书**）。

- 每课：**一张图解** + **要点** + **产品拍板项** + **费曼自测**
- 工程实验在 `labs/`；这里沉淀「能讲清、能拍板」的认知，不写实现细节堆砌
- 配图放在 `assets/`，正文用相对路径引用；**图解中英文配套（CN + EN）**
- 样本栈：本地 **pi + Ollama / qwen**；不依赖付费云 API

## 课表

| 序号 | 文件 | 主题 | 状态 |
|---:|---|---|---|
| 01 | [01-capability-overview.md](./01-capability-overview.md) | Harness 能力总览 | 已完成 |
| 02 | [02-tool-loop.md](./02-tool-loop.md) | 工具循环（Schema / toolCall / Executor） | 已完成 |
| 03 | [03-session-context.md](./03-session-context.md) | 会话与上下文 | 已完成 |
| 04 | [04-permissions-paths.md](./04-permissions-paths.md) | 权限与路径 | 已完成 |
| 05 | [05-turns-timeout.md](./05-turns-timeout.md) | 轮数与超时（maxTurns + 工具超时） | 已完成 |
| 06 | [06-observability-trace.md](./06-observability-trace.md) | 可观测与 Trace | 已完成 |
| 07 | [07-evals-acceptance.md](./07-evals-acceptance.md) | 评测与验收 | 已完成 |
| 08 | [08-selection.md](./08-selection.md) | 选型（买 / 自建 / 组合） | 已完成 |
| 09 | [09-collaboration.md](./09-collaboration.md) | 协作（产品 × 工程） | 已完成 |
| 10 | [10-landing.md](./10-landing.md) | 落地（样本 → 产品） | 已完成 |
| 11 | [11-hard-boundaries.md](./11-hard-boundaries.md) | 硬边界评测（超时 + 权限拒绝） | 已完成 |
| 12 | [12-path-sandbox.md](./12-path-sandbox.md) | 路径沙箱（Workspace Path Policy） | 已完成 |
| 13 | [13-trace-acceptance.md](./13-trace-acceptance.md) | Trace 作为验收证据（签字放行） | 已完成 |
| 14 | [14-context-budget.md](./14-context-budget.md) | 上下文预算（Session / Context Window） | 已完成 |
| 15 | [15-retry-degrade.md](./15-retry-degrade.md) | 失败重试与降级（Retry & Degrade） | 已完成 |
| 16 | [16-hitl-gate.md](./16-hitl-gate.md) | 人机确认闸门（HITL Confirm Gate） | 已完成 |
| 17 | [17-cost-latency.md](./17-cost-latency.md) | 成本与延迟预算（Cost & Latency Budget） | 已完成 |
| 18 | [18-getting-started.md](./18-getting-started.md) | 开源读者上手（Clone → green baseline） | 已完成 |
| 19 | [19-set-clerk-content-production.md](./19-set-clerk-content-production.md) | 虚拟产品：片场场记 · 内容生产（Set Continuity Clerk） | 已完成 |

对照仓库主线：根目录 [`README.md`](../../README.md)、[`OPEN_SOURCE.md`](../../OPEN_SOURCE.md)、`notes/course-plan.md`、`notes/glossary.md`，以及 `labs/01`–`labs/06`。

开源入口：先读仓库根 README（**写给大家看的 Harness 书**）；本目录是 **PM 图解课表**。
> **加深弧 14–18**：上下文预算 → 重试降级 → HITL → 成本/延迟 → **开源上手文档**。到课 18，读者应能独立把基线跑绿。
>
> **落地实操弧·内容生产（从课 19）**：虚拟产品「片场场记」先钉内容生产四技能与验收口径；技能桩与 lab 实现从课 20 起。图解风格锁定见 [`skills/harness-diagram/`](../../skills/harness-diagram/SKILL.md)（纯白底、中英双语、16:9 扁平教材矢量）。

