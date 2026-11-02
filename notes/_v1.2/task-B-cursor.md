# 任务 B（cursor）：旧资料标注 + 根 README + GitHub issue 模板

仓库：<repo-root>。先读 `notes/_v1.2/plan.md`。

## 背景
新主线是 `book/harness`（Ch0–Ch10，已发布 book-v1.1.1）。旧资料 `labs/01`–`07` 和 `notes/pm-learning/01`–`23` 仍在原处，新读者容易误入。决策：**只加标注，不移动、不删除**，保住原有链接。新旧对照表在 `notes/_curriculum-redesign-proposal.md` 第 3 节；各章内容见 `book/harness/chapters/ch00.md`–`ch10.md`。

## 要达到的效果
1. `labs/*/README.md`、`notes/pm-learning/01`–`23*.md`、`notes/pm-learning/README.md`、`notes/course-plan.md`：每个文件开头加一行统一格式的引用块，写明“旧版参考资料，已并入第 X 章（链接到对应 `book/harness/chapters/chNN.md`）”。无法对应到某章的，写“未纳入主线，仅作参考”。映射以提案第 3 节为准，拿不准的列进汇报。相对链接要能在 GitHub 上点开。
2. 根 `README.md`：入口第一屏只指向 `book/harness`；旧资料一节写明“仅作参考，已并入各章”。另加一行链接到附录 `book/harness/chapters/appendix-pm-checklist.md`（PM 验收清单，由另一个 agent 同时编写，你只加链接）。
3. `.github/ISSUE_TEMPLATE/`：两个 YAML issue form——「复现失败 / Repro failure」（字段：章节/tag、操作系统与 WSL、Node 版本、pi 版本、Ollama 模型、执行的命令、实际输出或 trace 片段、是否设了 `NO_PROXY=127.0.0.1,localhost`）和「书稿勘误 / Erratum」（章节、原文、建议、理由）；加 `config.yml`。标题和字段标签中英双语。

## 约束 / 不要做
- 不改 `book/harness/**`，不改 labs 的代码，不移动或删除任何文件。
- 不出现家目录绝对路径、私人邮箱、私人品牌。
- 不 git add / commit，不跑 build 或测试。

## 验收
- 所有标注里的相对链接都指向存在的文件（用脚本或 grep 自查）。
- `git grep -n "/home/"` 无新增命中。

## 交回（完成后汇报一次就停下）
改动文件清单；旧文件→章节的映射表；拿不准的映射；链接自查结果。
