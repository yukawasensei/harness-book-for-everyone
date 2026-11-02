# 任务 G（文档方）：书稿补「两种跑法」和「换模型对照」

前提：任务 F 已验收。先读 `notes/_v1.2/plan.md`、`book/harness/src/eval/usage.md`。数字只能取自 `book/harness/evals/runs/compare-qwen3.8-27b-vs-deepseek-flash.md` 和对应的 runs 目录。

## 要达到的效果
1. `book/harness/README.md`：在 Quickstart 附近加一小节「两种跑法 / Two ways to run」，一种是本地 Ollama（qwen，免费、离线），一种是 DeepSeek API（不需要 GPU，按 token 计费，key 写在 `.env`，必须注明“不要提交 .env”）。写出 `MODEL_ID` 的两种取值，大致费用写成“20 条 case 跑 5 次约 $X”，X 取实测值。
2. `book/harness/chapters/ch06.md`：在「一次全过 ≠ 稳定」之后加一节「换一个模型，闸门还在吗 / Swap the model」。要写清楚：
   - 只改了模型这一个变量，thinking 两边都关闭。
   - 按成功类和刹车/拒绝类分组的对照结果。
   - 结论只写数据能支撑的部分。
   - 附 1–2 条失败 trace 的相对路径。
   - 时延不能直接比较，费用要单列。
3. `book/harness/chapters/appendix-pm-checklist.md`：把「稳定性与换模型」里换模型那一条的证据栏，从“尚未做”改成实测结论，并链接到上面这一节。
4. 根 `README.md` 的复现要求里补一句：也可以用 DeepSeek API 代替本地 GPU。

## 约束
中文为主，术语保留英文；只改上面 4 个文件；不 git add/commit；不跑测试。

## 交回（完成后汇报一次就停下）
新增的段落标题，以及引用的每个数字出自哪个文件；还有哪些地方的数据不足以下结论。

## 总控补充：已核实的解读（必须写进 Ch6 那一节）
- `custom-tool-schema-conflict`：DeepSeek 0/5。原因是 prompt 要求“把 name 作为数字 123 提交”，与 schema（string）冲突。DeepSeek 照用户的话传了数字 `123`（见 `tool_execution_start.args`），qwen 则遵守 schema，传了 `"123"`。5 次的 `tool_execution_end.details.receivedType` 都是 `string`，说明 pi 的校验层在 executor 之前做了转换，宿主代码收到的始终是合法参数。结论：模型在“用户指令和工具契约冲突”时怎么选，因模型而异；harness 的校验层这道防线没有被突破。这一点要和第 3 章呼应。
- `capstone-set-clerk` 4/5：一次产出的 JSON 里有未转义的引号，被产物验收拦下。属于模型输出错误，被 harness 抓到了。
- qwen 唯一的失败（`tool-timeout-brake`）和 DeepSeek 的失败不在同一类，可以对比着写：不同模型，失败的形态不同。
