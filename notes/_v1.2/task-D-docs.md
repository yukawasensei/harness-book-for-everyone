# 任务 D（文档方，第 2 轮）：Ch6 补「稳定性」和「换模型对照」两节

前提：任务 A（repeat 5）和 A2（gemma4:26b 对照）已验收。先读 `notes/_v1.2/plan.md`。

## 输入（数字只能从这些文件里取，不得估算或编造）
- qwen3.8:27b repeat 5 的结果：`book/harness/evals/runs/` 下对应的 slug 目录
- gemma4:26b repeat 5 的结果，以及对照表 `book/harness/evals/runs/compare-qwen3.8-27b-vs-gemma4-26b.md`
- 用法说明：`book/harness/src/eval/usage.md`

## 要达到的效果
1. `book/harness/chapters/ch06.md` 末尾新增一节「一次全过 ≠ 稳定 / Pass once ≠ stable」：为什么要跑多次；`--repeat` 的命令；qwen 的结果表（只列 flaky case 和汇总即可）；flaky 的原因；PM 该问什么。
2. 再新增一节「换一个模型，闸门还在吗 / Swap the model」：只改模型这一个变量（写清楚 gemma4:26b 是不同家族的 MoE 模型，总参数约 25B、激活约 3.8B，所以这是“换模型”，不是“只换尺寸”）；按成功类和刹车/拒绝类分组的对照；结论只写数据能支撑的部分；附 1–2 条失败 trace 的相对路径；怎样复现。
3. `book/harness/chapters/appendix-pm-checklist.md` 最后一节「稳定性与换模型」的证据栏，换成真实数字，并链接到上面两节。

## 约束
- 中文为主，术语保留英文；不画图；数字必须与 runs 目录中的文件一致。
- 只改 `ch06.md` 和附录这两个文件；不 git add/commit；不跑测试。

## 交回（完成后汇报一次就停下）
新增两节的标题、引用了哪些数字（各自来自哪个文件），以及有没有数据不足以下结论的地方。
