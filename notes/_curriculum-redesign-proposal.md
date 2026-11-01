# 课表重构提案 · 写给大家看的 Harness 书

> 日期：2026-11-01
> 范围：只写提案，不改代码、不改现有笔记。
> 依据：`README.md`、`notes/pm-learning/README.md`、`notes/course-plan.md`、`labs/01`–`07` 的 README，以及 `notes/pm-learning/19`–`23`；另抽查了 `labs/05-minimal-harness/src/index.ts`（720 行）和 `labs/07-set-clerk/src/model-adapter.mjs`。
> 目标（PM）：写《写给大家看的 Harness 书》，用 **pi + 本地 qwen** 边做边学，不再一课接一课地堆概念。

---

## 1. 诊断

### 1.1 合理的地方（保留）

1. **样本栈对路**：本地 Ollama + qwen，加上 pi CLI / SDK，不依赖付费云 API，开源读者能复现。
2. **核心立场正确，而且有实证**：
   - “Prompt 不是护栏”“闸门写在 Harness 里”“验收看 Trace 的 `stop_reason`，不看回答听起来乖不乖”，这几条是全书的灵魂。
   - `labs/04` 的参数类型冲突实验是很好的教学素材：模型最终口头说“传的是数字”，真实 toolCall 里却是字符串。
3. **闸门有统一的证据格式**：每道闸门对应一个 `stop_reason`、一条 eval case 和一份 trace。`labs/06` 的 `eval:report` 已经把这三者打通。
4. **确定性注入**：用 `EVAL_INJECT_*` 让 timeout、budget、HITL 这些 case 可复现，CI 不依赖模型的随机性。这个工程选择是对的。
5. **成品形式**：图解（中英双语）、要点、产品拍板项、费曼自测。这套“书页格式”适合大众读者。

### 1.2 偏离标题与实操目标的地方

| # | 问题 | 证据 | 为什么偏离 |
|---:|---|---|---|
| 1 | **先讲概念，后动手** | pm 01–10 是十课认知笔记（能力总览、选型、协作、落地……），工程上对应的只有 `labs/01`–`05`；08–10 三课没有任何可跑的东西 | 读者要读完十课才真正“搭”东西，违背“边做边学” |
| 2 | **两套课表并存，互相矛盾** | `course-plan.md` 12 课，重心在微调（课 8–12）；`pm-learning` 23 课，重心在闸门。前者停在课 12 没再更新，Ollama 版本写了 0.33.2 和 0.32.12 两个值，“4B QLoRA 足够”与“没有 4B 模型”冲突 | 读者不知道哪套是主线；书名是 Harness，计划里一半却是微调 |
| 3 | **最小 Harness 一点都不“最小”** | `labs/05` 的 `index.ts` 有 720 行，十道闸门靠十几个 env 开关拼在一个文件里 | 读者拿到的是成品，不是“从零长出来”的过程；没有逐章的代码快照，无法跟着一课一课地搭 |
| 4 | **lab07 已经不是 pi harness** | `labs/07-set-clerk` 用 `fetch` 直接调 `/api/generate`；技能顺序写死，没有工具循环，trace 也是自写的；默认跑 stub | 课 19–23 实际教的是“固定流水线 + 评测桩”，偏离了“pi + qwen 的 Agent Harness” |
| 5 | **主题重复，课数虚胖** | 05 轮数/超时 ≈ 11 硬边界；04 权限/路径 ≈ 12 路径沙箱；06 Trace + 07 Evals ≈ 13 Trace 验收；17 成本延迟 ≈ 23 整链预算；15 重试降级 ≈ 22 的 fail-stop | 同一个概念在“认知版”和“实操版”各讲一遍，23 课里约三分之一是重复 |
| 6 | **编号错位** | `labs/06` README 写“第 6 课”，pm 06 讲的却是 Trace；`labs/07` 写“第 7 课实验”，对应的是 pm 19–23 | 读者无法把“章”和“实验”对上 |
| 7 | **虚拟产品叙事过重** | 课 19 用短视频多平台、选题、分镜做背景，占篇幅，但这些业务细节不产生新的 Harness 能力 | 稀释了主线；对大众读者来说是额外负担 |
| 8 | **历史工件混杂** | `labs/03`、`labs/04` 的证据大量来自 qwen3.6 时期；`labs/01`–`03` 是 Python 脚本，05 起改用 TS SDK | 技术栈前后不一，读者复现时会困惑 |

**结论**：书名和核心立场没有偏，偏的是**结构**——概念先于实践、两套课表并存、成品代替成长、后段换掉了 pi。重构的重点是**重排**和**收敛**，不是重写知识点；现有闸门代码和 eval 资产大多能复用。

---

## 2. 建议主线：Practice-first，一个项目从零长大

### 2.1 原则

1. **一本书，一个代码库**：全书只维护一个逐章增长的 harness，例如 `book/harness/`，或直接重构 `labs/05`。每章结束打一个 git tag（`ch02` … `ch10`），读者可以 `git checkout ch04` 对照。
2. **每章 = 一个可跑的增量**：第 N 章的代码只比第 N−1 章多一道能力，控制在 50–150 行；概念只讲当章用得到的部分。
3. **每章固定四件套**：
   - 加一个能力；
   - 加至少一条 eval case；
   - 产出一份真实 trace；
   - 一页书稿（一张双语图 + 产品拍板 + 费曼题）。
4. **评测从第 2 章就开始**：首个 case 就是“read 一次且 `stop_reason=success`”，之后每章往里加。评测不再是中途才出现的独立一课。
5. **全程走 pi + qwen**：工具循环一律通过 pi SDK；只有为了 CI 确定性才用注入或 stub，并在书中写明这一点。
6. **先只读，后写入**：写类工具（`write`/`edit`）推迟到 HITL 那一章才开放，让“确认门”有真实的用武之地。

### 2.2 三段式结构

```text
第一部分 跑起来（Ch0–2）   看见循环 → 从零写出最小 harness，有 trace、有 stop_reason
第二部分 刹得住（Ch3–6）   自定义工具 → 停机 → 权限/沙箱 → 评测基线
第三部分 能上线（Ch7–10）  预算与降级 → HITL + 写入 → 成本/延迟 → 综合项目 + 验收签字
附录                      选型/协作/落地（PM 收尾）· 微调（延后，见第 5 节）
```

---

## 3. 与现有资产的映射

### 3.1 labs

| 现有 | 处理 | 去向 / 说明 |
|---|---|---|
| `labs/01-model-api` | **合并** | 并入 Ch0“没有工具的模型”，只保留一个对比实验（A 无工具 vs C 用 Agent read）；Python 脚本可改写成一条 `curl` 或 Node 脚本 |
| `labs/02-pi-cli` | **合并** | 并入 Ch0：pi CLI + 只读 allowlist 跑通 |
| `labs/03-agent-events` | **保留** | Ch1 主实验；trace 用 qwen3.8 重新录一份，qwen3.6 的旧 trace 移到 `archive/` |
| `labs/04-custom-tool` | **保留并迁移** | Ch3；工具改为在 SDK harness 中注册；schema 冲突实验原样保留，是招牌案例 |
| `labs/05-minimal-harness` | **拆分重构** | 现有 720 行按闸门拆成 Ch2–Ch9 的增量（逐章 tag）；各闸门的 `*.ts` 和 `*.test.ts` 直接复用 |
| `labs/06-evals` | **保留，前移** | runner 和 report 从 Ch2 开始使用；Ch6 讲“基线与签字”；16 条 case 按章节归属 |
| `labs/07-set-clerk` | **改造或归档** | 推荐：保留“沙箱写文件 + schema 校验”的思路，改成 Ch10 综合项目，用 **pi agent + 自定义写工具** 实现，不再走固定的 `fetch` 流水线；不改造就整体移入 `archive/` |

### 3.2 pm 笔记 01–23

| 笔记 | 处理 | 新位置 |
|---|---|---|
| 01 能力总览 | **改写缩短** | 序章：一页地图，指向各章 |
| 02 工具循环 | 保留 | Ch1 |
| 03 会话与上下文 | 拆分 | 会话部分 → Ch2；上下文部分并入 Ch7 |
| 04 权限路径 + 12 路径沙箱 | **合并** | Ch5 |
| 05 轮数超时 + 11 硬边界 | **合并** | Ch4 |
| 06 Trace + 07 Evals + 13 Trace 验收 | **合并** | Trace 散在 Ch1/Ch2；评测与签字放 Ch6 |
| 08 选型 / 09 协作 / 10 落地 | **延后** | 附录 A“PM 拍板手册” |
| 14 上下文预算 + 15 重试降级 | 保留 | Ch7 |
| 16 HITL | 保留 | Ch8（同时开放写工具） |
| 17 成本延迟 + 23 整链预算 | **合并** | Ch9（单次预算 + 多步累计） |
| 18 开源上手 | 保留 | 附录 B / 根 README Quickstart |
| 19 片场场记 | **压缩** | Ch10 背景只留一段，删去平台、分镜等业务细节 |
| 20 评测桩 / 21 接模型 / 22 流水线 | **合并** | Ch10 的三个小节：先桩后模型、fail-stop、整体验收 |
| 23 整链预算 | 合并 | 已并入 Ch9 |

**处理方式**：旧笔记**不删除**，统一移入 `notes/archive/pm-learning-v1/`，首行注明“已并入第 X 章”，保留历史链接；新书稿另放在 `book/` 或 `notes/book/` 下。

### 3.3 `course-plan.md`

**整体归档**到 `notes/archive/course-plan-v1.md`。理由：它和新主线不一致，其中微调部分不属于本书主线（见第 5 节）。课 1–7 的有效内容已被新的 Ch0–Ch6 吸收。

---

## 4. 新课表大纲（主线 11 章：Ch0–Ch10）

| 章 | 标题 | 动手增量（代码） | 新增 eval case | 证据 `stop_reason` / trace | 来源 |
|---:|---|---|---|---|---|
| 0 | 跑通本地栈 | Ollama + pi CLI，只读 allowlist；对比“裸模型”和“Agent read” | — | pi JSON 输出 | labs/01、02 |
| 1 | 看见循环 | `pi --mode json` 录一份 trace，用分析器串起 toolCall → exec → result | — | 事件链 | labs/03，pm 02 |
| 2 | 从零写最小 harness | pi SDK：`createAgentSession` + 只开 `read` + 内存会话 + JSONL trace + `harness_end`（约 80 行） | `read-happy` | `success` | labs/05 骨架，pm 03 |
| 3 | 自己造工具 | 注册一个只读自定义工具，区分 schema 与 executor；做参数冲突实验 | `custom-tool-call` | toolCall 参数 vs 口头陈述 | labs/04 |
| 4 | 刹车：轮数与超时 | `maxTurns`（`shouldStopAfterTurn`）+ 单工具超时 + `slow` 演示工具 | `max-turns-brake`、`tool-timeout-brake` | `max_turns`、`tool_timeout` | pm 05/11 |
| 5 | 边界：白名单与路径沙箱 | allowlist + sandboxed read（`..`/绝对路径/符号链接） | `allowlist-no-bash`、`path-escape-denied` | `path_denied` | pm 04/12 |
| 6 | 评测基线与签字 | runner + `baseline-latest.json` + `eval:report`；用 Prompt 改动做一次回归对比 | 汇总前面所有 case | report 全绿 | labs/06，pm 06/07/13 |
| 7 | 上下文预算与重试降级 | `CONTEXT_BUDGET_CHARS`、`MAX_RETRIES` + 降级策略 | `context-budget-brake`、`retry-exhausted-brake` | `context_budget`、`retry_exhausted` | pm 14/15 |
| 8 | 人机确认门 + 第一次写入 | 开放沙箱内 `write`；写操作必须经过 HITL | `hitl-denied-brake` | `human_denied` | pm 16 |
| 9 | 成本与延迟预算 | 单次预算，以及多步任务累计预算 | `cost-budget-brake`、`latency-budget-brake` | `cost_budget`、`latency_budget` | pm 17/23 |
| 10 | 综合项目：小产品端到端 | 用前面的 harness 让 qwen 完成一个多步写作任务（片场场记精简版：选题 → 脚本 → 分镜三份文件），校验 schema 和路径 | `capstone-e2e` | `success` + 产物校验；中途失败为 fail-stop | labs/07，pm 19–22 |
| 附 A | PM 拍板手册 | 选型 / 协作 / 落地 checklist | — | — | pm 08–10 |
| 附 B | 克隆到绿基线 | Quickstart | — | — | pm 18 |

主线 11 章（Ch0–Ch10），落在 8–12 课的要求以内；如需更紧，可把 Ch0 和 Ch1 合并为 10 章。

**每章验收**：`git checkout chNN` 之后 `npm test` 全绿（不需要 Ollama）；有 Ollama 时 `eval:live` 中该章 case 为 PASS；书稿页包含一张双语图和一道费曼题。

---

## 5. 微调 / QLoRA：明确延后

**决定：移出本书主线，延后处理。**

理由：

1. **书名是 Harness**。`course-plan.md` 自己就写着“微调不能替代 Harness 的权限、重试、工具执行和状态管理”。主线讲微调会冲淡这个核心立场。
2. **复现门槛高**。27B QLoRA 在约 24GB 显存上属于边界场景，大众读者大多无法复现，违背“写给大家看”。
3. **前置条件尚未满足**。没有稳定的 harness eval 基线，就无法判断微调是否有效；而这条基线正是本书主线 Ch6 要交付的东西。

处理：

- `course-plan.md` 课 8–12 归档；若要保留，作为**续篇或附录 C**“什么时候才该考虑微调”。这一节只讲判断标准（有基线、harness 已收敛、失败集中在工具选择或参数上），不带训练实操。
- 训练与硬件细节按 `OPEN_SOURCE.md` 的约定放进未跟踪的私有笔记。

---

## 6. 需要 PM 拍板的事项

1. **代码组织**：新建 `book/harness/` 逐章增长（推荐，旧 labs 原样归档），还是原地重构 `labs/05`？
2. **章节快照**：用 git tag（推荐，仓库更干净），还是 `chapters/chNN/` 目录拷贝（读者更直观，但会重复代码）？
3. **综合项目**：保留片场场记的精简版做 Ch10（推荐，复用 lab07 的校验资产），还是换一个更通用的小任务？
4. **旧笔记**：同意统一移入 `notes/archive/`、不删除吗？
5. **执行顺序**（建议）：先定第 1、2 项 → 搭 Ch2 骨架并打 tag → 按章把 lab05 的闸门迁入 → 最后改写书稿与图解。
