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

## 进度（2026-11-02 12:40）
- 第 1 轮 A/B/C 已验收并提交：45f9f55、d959e10、da35d08；Ch6 稳定性一节：任务 D 第 1 项（提交 hash 见 git log）。
- qwen3.8:27b repeat 5：99/100；唯一 flaky 是 tool-timeout-brake（4/5）。失败那次 activeTools=["slow"]，模型却声称自己只有 bash/read/edit/write，属于对自身工具的幻觉。
- 待办：gemma4:26b 下载完 → 派 task-A2-codex.md → 派 task-D-docs.md 第 2、3 项 → 全量 test/typecheck → push。

## 决策（2026-11-02，用户）
- gemma4:26b 对照暂停：下载在网络不稳时停在约 4.8/16.3 GB，用户决定先不做。task-A2-codex.md 和 task-D-docs.md 第 2、3 项挂起。
- 附录「稳定性与换模型」一节：稳定性那条已填入真实数字；换模型那条如实写明“尚未做”，并给出复现方法。
- Ollama 里留有约 4.8 GB 的 gemma4 未完成下载，是否清理由用户决定（之后重新 pull 会从断点续传）。
