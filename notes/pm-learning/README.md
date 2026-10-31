# PM Learning Notes

产品经理视角的 Agent Harness 学习记录（可开源课程笔记）。

- 每课：**一张图解** + **要点** + **产品拍板项** + **费曼自测**
- 工程实验在 `labs/`；这里沉淀「能讲清、能拍板」的认知，不写实现细节堆砌
- 配图放在 `assets/`，正文用相对路径引用
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

对照仓库主线：`notes/course-plan.md`、`notes/glossary.md`，以及 `labs/01`–`labs/06`。
