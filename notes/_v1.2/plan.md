# v1.2 迭代总计划 / handoff（2026-11-02）

总控：Claude（w16:p1）。执行：codex（w16:p5）、cursor（w16:p7）、agy-harness（w16:p8）。
子 agent 不 git add / commit；总控验收后统一提交。

## 第 1 轮（并行，文件边界互不重叠）
| 任务 | 执行方 | 范围 |
|---|---|---|
| A 评测稳定性 + 可切换模型 | codex | `book/harness/src/eval/**`、`book/harness/src/*.test.ts`（仅新增 eval 相关测试）、`book/harness/pi-agent/models.json`、`book/harness/package.json` scripts、`book/harness/evals/runs/**`（新） |
| B 旧资料标注 + 根 README + issue 模板 | cursor | `labs/*/README.md`、`notes/pm-learning/*.md`、`notes/course-plan.md`、根 `README.md`、`.github/ISSUE_TEMPLATE/**` |
| C PM 验收清单附录 | agy | `book/harness/chapters/appendix-pm-checklist.md`（新）、`book/harness/README.md` |

## 第 2 轮（依赖 A 完成 + 小模型已 pull）
- codex：对照模型 × repeat 5 真跑，交回对照表。
- 文档方：`ch06.md` 加「稳定性」一节、加「换小模型对照」一节（数字来自 codex 交回的报告）。

## 已定决策
- 旧资料只加标注，不移动、不删除（保住原链接）。
- 对照实验只改模型一个变量；case、prompt、闸门不动。
- `evals/baseline.json` 仍是 qwen3.8:27b 的签收基线；其他模型结果单独存放，不覆盖它。
- 公开仓：不得出现家目录绝对路径、私人品牌、邮箱。

## 对照模型（用户 2026-11-02 选定）
- `gemma4:26b`：Google，MoE，总参数约 25B、激活约 3.8B，原生 tool calling，thinking 默认关闭（保持关闭）。
- 对照变量写作“换模型（家族 + 架构 + 激活参数）”，不写成“只换尺寸”。
- 可选的后续实验：`gemma4:e4b`，用来单独看尺寸的影响。
