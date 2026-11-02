# 任务 C（agy）：附录「PM 验收清单」

仓库：<repo-root>。先读 `notes/_v1.2/plan.md`。

## 背景
本书主要读者是 PM，要学会向 harness 工程方要什么证据。全书 Ch0–Ch10 在 `book/harness/chapters/`，每章加一道能力；case 在 `book/harness/cases/cases.json`（20 条，带 chapter 字段）；验收看 trace（`book/harness/evals/traces/*.jsonl`）和 `book/harness/src/check-trace.ts`。

## 要达到的效果
新建 `book/harness/chapters/appendix-pm-checklist.md`：
1. 开头说明用法（一页纸，评审/验收会上逐条问）。
2. 按章分组，每条格式统一：**要问的问题** → **合格的证据**（具体到 trace 事件名/字段名，例如 `harness_end.stop_reason`、case id）→ **红旗**（什么样的回答说明没做到）→ 对应章节链接。
3. 证据字段名、case id、stop_reason 取值必须是仓库里真实存在的——在 traces / cases.json / src 里 grep 核对，不得编造。
4. 末尾加一节「稳定性与换模型」：两个问题——“同一套评测跑多次的通过率是多少？”“换一个更弱的模型，刹车和拒绝类 case 还拦得住吗？”证据栏先写“见第 6 章稳定性一节（v1.2 补充）”，具体数字下一轮再补。
5. 在 `book/harness/README.md` 的章节目录后加附录链接。

## 约束 / 不要做
- 中文为主，术语保留英文原词；不画图。
- 只改上面两个文件，不碰 `chapters/ch*.md`、根 `README.md`、src。
- 不 git add / commit，不跑测试或 build。

## 验收
清单至少覆盖 Ch2–Ch10 每章 1–3 条；所有字段名都能在仓库中 grep 到。

## 交回（完成后汇报一次就停下）
文件路径；条目数；你核对过的字段名清单，以及核对时用的 grep 命令。
