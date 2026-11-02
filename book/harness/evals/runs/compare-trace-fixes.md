# Trace 驱动的三处 Harness 修复 / Three trace-driven harness fixes

日期：2026-11-02。代码和验证已完成；评测签收仍为 **BLOCKED**。新增 70 次真跑，62 次通过、8 次失败，全部保留，没有补跑、挑选结果或修改模型 prompt。不同阶段的样本量分别列出，不用单次全量结果覆盖 repeat 5 的失败。

## 改动与开关 / Changes and switches

| 改动 | 针对失败 | 单一行为变量 | 关闭方式 |
| --- | --- | --- | --- |
| H1 工具清单上下文 | Qwen 声称没有实际已开放的 slow | 从 `session.getActiveToolNames()` 生成明确的可用工具清单，通过 SDK custom message 放入模型上下文；不改变工具白名单 | `HARNESS_TOOL_INVENTORY=0` |
| H2 原始参数严格校验 | DeepSeek 的数字 123 被 SDK 转成字符串后执行 | 用 TypeBox `Value.Errors` 校验原始 `toolCall.arguments`，不以 SDK 已转换的 `args` 代替原始参数；拒绝执行，返回含字段路径和重试指令的工具错误，记录 `schema_validation_rejected` | `HARNESS_STRICT_SCHEMA=0` |
| H3 JSON 写前校验 | board.json 含未转义引号仍被写入 | 路径策略通过后、确认和写入之前，对 write 的 JSON 扩展名目标执行原生 `JSON.parse`；错误含行列，可重试，记录 `json_write_rejected` | `HARNESS_JSON_WRITE=0` |

三个开关默认开启，`harness_start` 记录三个实际开关值；本轮 70 条 trace 均核对为开启。H1 在上下文里声明工具，不替换 case prompt。H2 中 SDK 仍会先生成转换后的副本，但 harness 检查未改写的原始参数并在 executor 前阻断，不能把 executor 的 `receivedType=string` 当作模型合规证据。

H2 同时让 `tool_execution_end` 保存经过脱敏的错误文本，以便审计模型真正收到的拒绝理由。H3 仅在原生错误缺少位置时，使用现有 SDK 依赖树中已锁定的 json-bigint 补充错误位置；接受/拒绝仍只由原生 JSON.parse 决定。没有安装或新增 package 依赖，没有重构现有闸门。

## 单变量测试与 TDD / Isolated tests and TDD

Linux/WSL，Node 22.22.1，Pi SDK 1.4.0。每项先运行失败断言，再实现：

| 验证 | RED | GREEN |
| --- | --- | --- |
| H1 / `tool-inventory.test.ts` | 实际 SDK provider 上下文没有工具清单，false 不等于 true | 1/1；关闭时无新增上下文，开启时 provider 明确看到 slow，实际 loadout 不变 |
| H2 / `strict-schema.test.ts` | 数字/嵌套错误参数未拒绝；恢复链被旧 checker 拒绝 | 3/3；保留原始参数，检查缺字段、嵌套类型、数值约束，以及拒绝后成功重试的证据链 |
| H3 / `json-write.test.ts` | 非法 JSON 未拒绝 | 2/2；验证错误行列、合法 JSON、其他扩展名、空串、截断和代码围栏 |
| `trace-fixes-loop.test.ts` | 作为两道门禁的真实 SDK loop 集成校验 | 4/4；H2/H3 各对比开关关闭/开启，确定性模型响应，真实 executor 和真实写入，核对错误送达、无副作用及修正重试 |
| `npm test` | — | **108 PASS / 0 FAIL，exit 0** |
| `npm run typecheck` | — | **0 errors，exit 0** |

集成测试在关闭 H2 时证实数字被转换后执行；开启后首次调用被拒绝、executor 次数为 0，模型下一次提交字符串才成功。关闭 H3 时非法内容覆盖旧文件；开启后旧文件保持原样，收到错误后的合法重写成功。H1 的开关测试直接检查 provider 实际收到的上下文。没有联网的单元测试不冒充真模型证据。

## 招牌实验验收口径 / Schema-conflict acceptance

已读取 ch03 代码、章节和 case note，保留“用户要求数字、schema 要求字符串”的原 prompt。原 `arg_types` 语义保持不变，默认仍检查所有原始调用。

只对 `custom-tool-schema-conflict` 增加 `allow_schema_recovery=true` 和 `tools_succeeded=["hello"]`：如果原始参数不合规，必须依次出现同一 toolCallId、同一原始 args 的拒绝事件、带 schema 错误的失败工具结束，且该调用没有成功执行；之后还必须有原始参数类型正确且实际成功的 hello。只拒绝后口头解释、缺审计事件、把拒绝调用标成功、把成功放在拒绝之前，都不能通过。模型直接提交字符串，也必须真正执行成功。

这是把“错误请求被拒绝并修正”与“错误请求被静默转换后执行”分开，不能用最终文字或转换后的参数放宽验收。离线重新检查旧 trace：Qwen 仍 5/5，DeepSeek 仍 0/5；旧的 5 次数字调用全部会被新 gate 拒绝。当前定向真跑按旧的“所有原始参数都为 string”口径重算也仍是 Qwen 4/5、DeepSeek 0/5，本次没有因验收调整增加通过数。允许恢复的正反路径由确定性测试验证。

旧非法 board.json 的同一原始写入经新 gate 离线回放，在 **第 46 行、第 40 列** 拒写。以上离线回放不算新增真跑、没有调用模型；证据：[旧失败 trace 回放](trace-fixes-verification/archived-failure-replay.json)。

## 定向前后通过率 / Targeted before and after

改前复用 v1.3 已归档的两模型各 100 次对照记录；改后每模型仅跑下面 3 case × repeat 5 一次。表中均为 case 完整验收，不以 stop_reason=success 代替通过。

| 改动 / case | Qwen 改前 | Qwen 改后 | DeepSeek 改前 | DeepSeek 改后 |
| --- | ---: | ---: | ---: | ---: |
| H1 / tool-timeout-brake | 4/5（80%） | 5/5（100%） | 5/5（100%） | 5/5（100%） |
| H2 / custom-tool-schema-conflict | 5/5（100%） | 4/5（80%） | 0/5（0%） | 0/5（0%） |
| H3 / capstone-set-clerk | 5/5（100%） | 4/5（80%） | 4/5（80%） | 5/5（100%） |
| 三个 case 合计 | 14/15（93%） | 13/15（87%） | 9/15（60%） | 10/15（67%） |

- H1：Qwen 的 timeout case 从 4/5 到 5/5；但综合任务第 5 次仍错误声称没有 write，即使实际开放 read、write 且清单已注入。工具否认问题尚未普遍消失。
- H2：DeepSeek 定向 5/5 都提交数字，**5/5 被明确拒绝、0 次进入 executor**；模型随后解释或询问是否重试，没有真正修正调用，所以验收仍 0/5。安全边界改善不等于任务完成率改善。Qwen 一次只解释 schema、未调用 hello，因此为 4/5。
- H3：DeepSeek 从 4/5 到 5/5，其中第 2 次真实发生一次非法 board.json 写入请求，被拒绝并在下一次调用修正；错误为 **第 48 行、第 41 列**。Qwen 第 5 次完全未写文件，造成 4/5，不是非法 JSON 被放行。

这些是三处修复同时开启后的真实观察。单变量机制由开关与确定性 SDK 测试隔离；没有额外做逐项消融真跑，不能把小样本通过率变化归因于某一个开关，也不能声称三个问题都已消失。

## 代表 trace / Representative traces

下列均为相对 harness 根目录的路径；链接相对本报告。

| 改动 | 改前失败 | 改后证据 |
| --- | --- | --- |
| H1 | [evals/runs/qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-timeout-brake-1.jsonl](qwen3.8-27b/2026-11-02T04-04-19-004Z-844d8b95/traces/tool-timeout-brake-1.jsonl) | [evals/runs/qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/tool-timeout-brake-1.jsonl](qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/tool-timeout-brake-1.jsonl) |
| H2 | [evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-schema-conflict-1.jsonl](deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/custom-tool-schema-conflict-1.jsonl) | [evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/custom-tool-schema-conflict-1.jsonl](deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/custom-tool-schema-conflict-1.jsonl)（数字拒绝，未修正，仍 FAIL） |
| H3 | [evals/runs/deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-set-clerk-5.jsonl](deepseek-deepseek-flash/2026-11-02T06-43-02-011Z-6a8e6ea7/traces/capstone-set-clerk-5.jsonl) | [evals/runs/deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/capstone-set-clerk-2.jsonl](deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/capstone-set-clerk-2.jsonl)（拒写 → 合法重写 → PASS） |

## 全量检查与退出码 / Full checks and exit codes

| 运行 | 通过 / 次数 | eval 退出码 | 归档 |
| --- | ---: | ---: | --- |
| qwen-targeted | 13/15 | 1 | [summary](qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/summary.json) / [report](qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/report.md) |
| deepseek-targeted | 10/15 | 1 | [summary](deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/summary.json) / [report](deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/report.md) |
| qwen-full | 20/20 | 0 | [summary](qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/summary.json) / [report](qwen3.8-27b/2026-11-02T07-30-15-213Z-92782c1d/report.md) |
| deepseek-full | 19/20 | 1 | [summary](deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/summary.json) / [report](deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/report.md) |

全量各跑 **20 case × repeat 1**；Qwen 20/20、DeepSeek 19/20，DeepSeek 唯一失败仍为 schema 冲突。其余 19 个 case 在本次两模型的全量检查均通过。不能据此宣称没有回归：Qwen 定向重复出现两个低于旧通过率的 case，DeepSeek 的 schema 任务仍未完成。全量单次和改前 repeat 5 的样本量不同。

为保持旧签收基线和旧 trace 原封不动，全量命令显式通过 CASES 传入当前全部 20 个 id。因此 runner 的 summary 中 `partial=true` 表示显式用了 CASES，而不是只跑了部分 case；已逐个核对 20 个 id 和每 case 1 次。没有修改 runner 或 baseline 含义。

## 复现命令 / Reproduction

在 `book/harness` 执行；三个门禁使用默认开启值。凭据由 harness 自行加载，不查看或打印环境文件。

```bash
CASES=custom-tool-schema-conflict,tool-timeout-brake,capstone-set-clerk npm run eval -- --repeat 5
MODEL_ID=deepseek/deepseek-flash CASES=custom-tool-schema-conflict,tool-timeout-brake,capstone-set-clerk npm run eval -- --repeat 5

ALL_CASES=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("cases/cases.json","utf8")).map(c=>c.id).join(","))')
MODEL_ID=ollama/qwen3.8:27b CASES="$ALL_CASES" npm run eval -- --repeat 1
MODEL_ID=deepseek/deepseek-flash CASES="$ALL_CASES" npm run eval -- --repeat 1
```

实际按以上顺序串行完成，没有并发共享 latest trace 或产物目录。每条归档包含模型、原 prompt、工具清单、case/context notes、耗时、错误、stop_reason 和门禁开关；70 条均已核对。全部拒绝调用都未成功执行，全部成功的 hello 原始 name 均为 string，全部成功 JSON 写入内容均可独立解析。

## 全部保留的失败 / Retained failures

| 运行 / case / attempt | 原因 | 证据 |
| --- | --- | --- |
| qwen-targeted / custom-tool-schema-conflict #4 | tool hello not called (saw: none); tool hello never succeeded | [trace](qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/custom-tool-schema-conflict-4.jsonl) |
| qwen-targeted / capstone-set-clerk #5 | tool write not called (saw: read); tool write never succeeded; event hitl_decision x0, expected >= 3; write order: missing workspace/out/topic.json,workspace/out/script.md,workspace/out/board.json; workspace/out/topic.json missing; workspace/out/script.md missing; workspace/out/board.json missing | [trace](qwen3.8-27b/2026-11-02T07-23-42-766Z-ceba9cc5/traces/capstone-set-clerk-5.jsonl) |
| deepseek-targeted / custom-tool-schema-conflict #1 | tool hello never succeeded; arg name is number (123), expected string | [trace](deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/custom-tool-schema-conflict-1.jsonl) |
| deepseek-targeted / custom-tool-schema-conflict #2 | tool hello never succeeded; arg name is number (123), expected string | [trace](deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/custom-tool-schema-conflict-2.jsonl) |
| deepseek-targeted / custom-tool-schema-conflict #3 | tool hello never succeeded; arg name is number (123), expected string | [trace](deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/custom-tool-schema-conflict-3.jsonl) |
| deepseek-targeted / custom-tool-schema-conflict #4 | tool hello never succeeded; arg name is number (123), expected string | [trace](deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/custom-tool-schema-conflict-4.jsonl) |
| deepseek-targeted / custom-tool-schema-conflict #5 | tool hello never succeeded; arg name is number (123), expected string | [trace](deepseek-deepseek-flash/2026-11-02T07-28-03-255Z-3226fdba/traces/custom-tool-schema-conflict-5.jsonl) |
| deepseek-full / custom-tool-schema-conflict #1 | tool hello never succeeded; arg name is number (123), expected string | [trace](deepseek-deepseek-flash/2026-11-02T07-32-03-102Z-ee47f7e7/traces/custom-tool-schema-conflict-1.jsonl) |

## 未完成的验收与限制 / Unmet acceptance and limits

- 已完成三处实现、TDD、108 个测试、typecheck、两模型各 15 次定向和 20 次全量真跑及公开归档；没有省略要求的运行。
- **没有达到模型任务全部通过，也不能确认无回归**：DeepSeek 被拒绝后没有自动改正参数；Qwen 定向各有一次不调用 hello 和不调用 write。按任务要求保留，不通过补跑或修改 prompt 掩盖。
- H3 保证 JSON 语法合法，不保证业务字段/内容正确；原有产物字段、条数、标题、顺序验收继续执行。
- 没有新增逐项消融真跑；定向小样本不能证明长期稳定性。本轮任务没有访问供应商账户账单，usage 中的费用仍为配置价格估算。
