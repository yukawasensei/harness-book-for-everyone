# 第二篇 · 织影 / Part II · Reelloom

第一篇用小实验讲 harness 的闸门；第二篇把闸门接成一个短片文本创作工具：**故事 → 剧本 → 设定集 → 分镜板**（`story → script → bible → board`）。程序管理工序、版本与引用，人逐道审阅采用。最终交付分镜板，包含景别、运镜、动作、对白、时长与完整画面提示词，支持复制和 Markdown 导出。

本包与 [`book/harness/`](../harness/) 独立安装。八章共用当前代码，不按章节切换标签；旧六工序版本保留在 `p2-*` 标签中。

| 章 | 入口 | 本章看到的变化 |
|---:|---|---|
| 1 | [先看成品](./chapters/p01.md) | 从想法到分镜板的交稿过程 |
| 2 | [跑出第一份稿](./chapters/p02.md) | 启动工作区，生成故事草稿 |
| 3 | [让人签字把关](./chapters/p03.md) | 采用、丢弃与按意见修改 |
| 4 | [长剧本拆开写](./chapters/p04.md) | 逐场提交，再由程序汇总 |
| 5 | [角色道具先对上号](./chapters/p05.md) | 设定集覆盖与镜头引用检查 |
| 6 | [外貌不用每次重写](./chapters/p06.md) | 程序原样注入固定描述 |
| 7 | [改一处，不用推倒重来](./chapters/p07.md) | 局部修改、来源追踪与重新拼装 |
| 8 | [验好货再交稿](./chapters/p08.md) | 结构评测、人工评分与导出 |
| 附录 | [搬上云端之前](./chapters/appendix-cloud.md) | 鉴权、隔离、配额与托管边界 |

## 第一篇的闸门在织影里变成了什么 / From Part I gates to Reelloom

第一篇通过小实验验证了 Harness 的核心防御闸门；本表梳理这些机制在第二篇「织影」中的具体映射，方便对照原理与实现。

| 第一篇章节 | 那章的机制 | 织影里对应的机制 | 第二篇对应章节 |
|---|---|---|---|
| [第 2 章 · 从零写最小 harness](../harness/chapters/ch02.md) | 统一运行循环、受限工具调用与 `stop_reason` 停机裁决 | 受限执行环境、工序专属交稿工具与 `stage_run_end` 统一停机记录 | [第 2 章 · 跑出第一份稿](./chapters/p02.md) |
| [第 3 章 · 自己造工具 + 隔离本机配置](../harness/chapters/ch03.md) | 自定义工具 TypeBox Schema 强校验，隔离全局环境与私人配置 | 四工序产物契约强校验，关闭全局扩展与本包 `pi-agent/models.json` 受控加载 | [第 1 章 · 先看成品](./chapters/p01.md)、[第 2 章 · 跑出第一份稿](./chapters/p02.md) |
| [第 4 章 · 刹车：轮数与超时](../harness/chapters/ch04.md) | 循环轮数硬刹车（`max_turns`）与工具执行超时 | 每道工序轮数硬上限（超限即停 `max_turns`）与评测单案例超时 | [第 2 章 · 跑出第一份稿](./chapters/p02.md)、[第 8 章 · 验好货再交稿](./chapters/p08.md) |
| [第 5 章 · 边界：白名单与路径沙箱](../harness/chapters/ch05.md) | 工具白名单与工作区外路径越界拦截 | 工序专属工具白名单（仅开放专属写入与上游只读），禁止任意系统读写 | [第 2 章 · 跑出第一份稿](./chapters/p02.md)、[附录 · 搬上云端之前](./chapters/appendix-cloud.md) |
| [第 6 章 · 评测基线与签字](../harness/chapters/ch06.md) | 自动化评测基线与零回归自动化签字（sign-off） | 四工序独立自动化评测（`reelloom-4stage-v1` 基线）与结构放行门禁 | [第 8 章 · 验好货再交稿](./chapters/p08.md) |
| [第 7 章 · 上下文预算与重试降级](../harness/chapters/ch07.md) | 上下文预算刹车、输出截断与工具重试降级 | 长剧本与分镜板逐场拆分提交、暂存区暂存与程序汇总，参数容错解码 | [第 4 章 · 长剧本拆开写](./chapters/p04.md)、[第 8 章 · 验好货再交稿](./chapters/p08.md) |
| [第 8 章 · 人机确认门 + 第一次写入](../harness/chapters/ch08.md) | 关键写入操作人机确认门（HITL）与可写沙箱隔离 | 工序间人工审阅签字门（采用、丢弃、要求修改），草稿不自动覆盖定稿 | [第 3 章 · 让人签字把关](./chapters/p03.md) |
| [第 9 章 · 成本与延迟预算](../harness/chapters/ch09.md) | Token 消耗与全局耗时预算拦截 | 固定外观程序原样注入、零模型调用重新拼装、局部修改只重交单场，减少重复生成开销 | [第 6 章 · 外貌不用每次重写](./chapters/p06.md)、[第 7 章 · 改一处，不用推倒重来](./chapters/p07.md) |
| [第 10 章 · 综合项目：片场场记](../harness/chapters/ch10.md) | 多产物流水线依赖、产物 JSON 结构键值校验与中途异常原子停机（Fail-stop） | 设定集覆盖检查、分镜板镜头引用检查；未汇总场次留存暂存区，非法不污染正式版本 | [第 4 章 · 长剧本拆开写](./chapters/p04.md)、[第 5 章 · 角色道具先对上号](./chapters/p05.md) |
| [第 11 章 · 从失败到修复](../harness/chapters/ch11.md) | Trace 驱动根因修复、拒绝率与完成率分立统计 | 评测中写入/汇总拒绝数与完成率分立看，机器确定性检查与人工评分分层 | [第 8 章 · 验好货再交稿](./chapters/p08.md) |

## 安装与离线检查

需要 Git、Node.js **22.19+**、npm，运行环境为 Linux / WSL。Ollama 可在宿主机运行。核心依赖版本见 [`package.json`](./package.json)：pi SDK 1.4.0、TypeBox 1.3.27、TypeScript 5.9.3、Vite 7.3.7、React 19.2.0。

以下命令均在 `book/build` 执行：

```bash
cd "$(git rev-parse --show-toplevel)/book/build"
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

`npm test` 执行 `src/*.test.ts` 与 `web/tests/*.test.tsx`。离线测试以假模型替换模型响应，覆盖四工序契约、非法运行、依赖与工具隔离、逐场暂存、审阅与返工、分镜板拼装与导出、HTTP/SSE、会话恢复及 hosted 隔离和配额；不请求 Ollama 或 DeepSeek。它检查结构和业务机制，创作质量仍需人审，网页视觉与交互需另做浏览器检查。

`npm run typecheck` 检查服务端与网页，`npm run lint` 检查 `web/src/`，`npm run build` 输出 `web/dist/`。构建目录不提交。

## 打开 Web 工作区

先使用不请求模型的演示模式：

```bash
HARNESS_DEMO=1 npm run dev
```

浏览器访问 **http://127.0.0.1:5173**。命令同时启动 Vite（5173）和 API（3001），默认只监听 `127.0.0.1`；Vite 将 `/api` 代理到 **http://127.0.0.1:3001**，网页使用相对地址。端口占用会报错并停止该命令的两个子进程，不另选端口。可改端口，例如 `WEB_PORT=5273 API_PORT=3101 HARNESS_DEMO=1 npm run dev`，浏览器改为访问 **http://127.0.0.1:5273**。Ctrl+C 结束该命令启动的服务及未完成运行。

页面标出**离线演示 / 假模型**。静态原创样例替代模型回答，SDK、工具、schema、版本保存与人工采用仍照常执行。输入内容会进入提示，但演示只展示固定答案，不理解任意创作或修改要求。

1. 在首页输入短片想法并发送，或点“新任务”后发送想法，开始生成故事。中栏显示文本、工具结果和拒绝后的修正，右栏显示片名、核心冲突与四幕脉络。
2. 审阅故事，点“采用并开始写剧本”。首次采用会启动下一道；剧本逐场提交，演示先漏填台词角色，再修正并汇总为待审稿。每次交稿都等待人审阅。采用后右栏可能仍显示故事，点击工序条的『2. 剧本』或剧本交稿卡的『查看并审阅』查看新稿。
3. 点“要求修改”，填写意见后点“按意见修改”，即可生成新版本。剧本的固定修改示例只重交 S02，沿用 S01、S03；修改记录列出重交、沿用和删除的场号。审阅后点“采用并开始整理设定集”。
4. 设定集先因漏掉陆岑被覆盖检查拒绝，补齐后按角色、道具、场景展示固定外观与来源场。点“采用并开始制作分镜板”。
5. 分镜板先后演示不存在的 P99、出场范围不符的 C03，以及镜头描写提到本镜未引用角色的拒绝；修正后按场汇总。右栏按场展示镜头，蓝色是模型镜头描写，绿色是程序原样带入的固定外观。每镜可复制完整提示词，“导出分镜板”下载当前所选版本的 Markdown。
6. 分镜板也可要求只修改 S02；演示重交该场，其余场沿用。审阅后点“采用并完成”，四道工序均采用后显示“全流程已完成”。

故事的固定修改示例把孩子换成老站长；设定集的固定修改只把程禾外套从浅灰改为深灰。可在右栏版本列表切换历史稿；丢弃保留原稿，已丢弃版本不能采用。运行中可中断，已采用工序再次运行或切换采用版本需要确认。

使用真实模型时，先结束演示命令，按下文准备模型配置，再运行：

```bash
NO_PROXY=127.0.0.1,localhost npm run dev
# 可选 DeepSeek（需先配置本包密钥）：
# MODEL_ID=deepseek/deepseek-flash npm run dev
```

未设 `HARNESS_DEMO=1` 时，发送创作或修改消息、启动工序，以及首次采用后开始下一道，都会请求真实模型。只打开页面不请求模型。模型只回复文字、出错或中断时，运行记录保留实际 `stop_reason`。

断线后页面每两秒轮询项目详情和时间线，SSE 同时重连；重开网页可读取已保存的对话与版本。项目及右栏最近选择的工序保存在浏览器本地。服务重启会将残留运行标记为 `interrupted`，不会自行请求模型。

默认 local 是无鉴权的本机开发入口。hosted 的鉴权与部署说明见[附录](./chapters/appendix-cloud.md)。Web 运行时不要用 CLI 修改同一项目；进程内运行锁不覆盖其他进程。

## 用 CLI 跑一道工序

```bash
npm start -- new 示例
# 将输出的项目 UUID 粘贴到变量中
PROJECT_ID=把上一步输出的项目ID粘贴到这里
npm start -- status "$PROJECT_ID"
```

此时 `story: ready`，其余工序为 `locked`，版本和采用记录为空。上述命令不连模型。

默认模型是 `ollama/qwen3.8:27b`，地址为 `http://127.0.0.1:11434/v1`。先按第一篇准备 Ollama 和模型，再运行：

```bash
NO_PROXY=127.0.0.1,localhost npm start -- run "$PROJECT_ID" story
npm start -- status "$PROJECT_ID"
# 审阅生成的版本，再采用对应编号
cat "projects/$PROJECT_ID/artifacts/story/v1.json"
npm start -- adopt "$PROJECT_ID" story 1
npm start -- status "$PROJECT_ID"
```

合规草稿进入 `pending_review`，人工采用后为 `adopted`，剧本变为 `ready`。CLI 的 `adopt` 只记录采用；下一道须显式执行 `run`。可用工序键为 `story`、`script`、`bible`、`board`。

可选 DeepSeek：复制 `.env.example` 为本包 `.env`，仅在本机填入 `DEEPSEEK_API_KEY`，勿提交或打印：

```bash
MODEL_ID=deepseek/deepseek-flash npm start -- run "$PROJECT_ID" story
```

已有环境变量优先于 `.env`，不加载第一篇的 `.env`。`MODEL_ID` 支持 `provider/model`，裸模型 ID 按 `ollama` 解释。模型配置来自本包 `pi-agent/models.json`，不加载本机全局 pi 扩展、技能、上下文或凭据。返工时可更换模型。

## 产物与运行证据

```text
book/build/
  src/contracts/             四工序 schema、分镜板拼装与 Markdown 渲染
  src/workflow/              依赖关系、状态与审阅规则
  src/project/               版本、来源、暂存、评分与存储
  src/agent/                 提示、工具、逐场提交与运行摘要
  src/server/                REST、SSE、对话时间线、运行锁与 hosted 隔离
  src/cli.ts                 new / status / run / adopt
  web/src/app/               React 应用入口与布局
  web/src/features/          会话、对话、产物审阅与鉴权
  web/src/components/        通用组件与 UI 基础组件
  web/src/lib/               API、事件与格式化
  scripts/dev.mjs            同时启动 API 与网页
  examples/sample-project/   story/script/bible/board.json 为当前四工序样例
  evals/cases.json            四个固定上游评测案例
  evals/baselines/4stage-v1.json
  projects/<id>/             本机产物，git 忽略
    project.json              工序、审阅与各版本 based_on 来源
    conversation.jsonl        保存的对话时间线
    audit.jsonl               审阅、返工等操作记录
    artifacts/<stage>/v1.json
    staging/<stage>.json      逐场暂存与来源
    run-lock.json             运行标记
    sessions/*.jsonl          SDK 会话与运行摘要
```

`stop_reason=draft_written` 只表示草稿已保存。模型只回复文字为 `no_draft`；故事与设定集最多各 **8** 轮模型响应，剧本 **20** 轮，分镜板 **24** 轮，超限为 `max_turns`。模型错误、取消和运行异常分别为 `model_error`、`aborted`、`runtime_error`；CLI 未完成运行返回非零。

剧本以 `write_scene` 暂存单场，分镜板以 `write_scene_shots` 提交单场全部镜头及 `shot_part`。两者都需 `finalize_draft` 汇总才生成版本。分镜板的 `final_prompt` 与 `injected_ids` 由程序生成，不由模型提交。故事和设定集使用 `write_draft`。`read_upstream` 仅允许读取显式依赖的采用版本；分镜板可读取故事、剧本和设定集原文。

SessionManager 保存 SDK 会话；`stage_run_start` / `stage_run_end` 记录模型、提示、工具表、上下文说明、耗时、错误、usage 与 `stop_reason`。SDK 元数据可能含本地 cwd；`projects/` 不提交，也不要直接作为公开 trace 发布。

当前项目格式为 `format_version: 2`；缺少版本号或使用过渡格式的旧项目会被拒读，需要新建项目。当前样例和评测只读取四工序文件，保留的历史样例不参与当前运行。

## 审阅、局部修改与恢复

新版本等待审阅，人可采用、丢弃或填写意见要求修改。按意见修改会把所选原稿与意见送入新运行，追加版本，保留原稿。剧本和分镜板预装原稿，只重交受影响的场，删场分别用 `remove_scene`、`remove_scene_shots`，未重交的场由程序沿用。原理见[第三章](./chapters/p03.md)、[第四章](./chapters/p04.md)和[第七章](./chapters/p07.md)。

各版本记录上游来源。切换上游采用版本后，下游沿依赖标为“待更新”。可检查影响后返工，或在内容仍有效时填写理由确认。仅设定集固定描述（`appearance` / `description`）变化、故事和剧本采用版本未变时，待更新的最新分镜板可“重新拼装”：保留镜头部分，程序注入最新外观，**模型调用为 0**。新版本仍需人工采用。

可用离线演示走一遍：完成四工序 → 回到设定集要求修改 → 采用外套改为深灰的 v2 → 分镜板显示待更新 → 点“重新拼装”并确认 → 审阅新版本并确认切换采用。若人物编号、来源场或故事／剧本版本改变，应按页面提示返工。

未汇总的场会保存到 `staging/`。同工序再次运行可选择继续或重新开始；来源变化时拒绝继续。CLI 的 `run` / `adopt` 支持 `--confirm`，`run` 另支持 `--resume` / `--restart`，应在人明确审阅后使用。

Web 对同项目的运行与审阅互斥，冲突返回 409。当前文件存储不提供跨进程锁或跨文件事务。结构检查包含设定集覆盖、镜号与场次、引用和说话人、镜头描写与固定描述拼装；时长偏差超过目标的 20% 只警告。语义、节奏与视觉质量仍需人审。

## 结构评测与人工评分

四个案例分别评测 `story`、`script`、`bible`、`board`，各自新建项目，并为后续工序装入固定的已采用上游。它们不是一次连续创作的质量测试。离线重复检查：

```bash
EVAL_FAKE=1 npm run eval -- --repeat 3
npm run context:compare
```

四个案例各重复三次，共 **12** 次观察；fake token 为合成值，不参与真实模型基线签收。上下文脚本只做当前分镜板输入、保存及按场提交的静态字符与 token 估算，不证明成本收益。

真实评测：

```bash
MODEL_ID=ollama/qwen3.8:27b NO_PROXY=127.0.0.1,localhost npm run eval
```

每个案例默认超时 **600000 ms（10 分钟）**，可通过 `EVAL_TIMEOUT_MS` 调整；重复次数用 `-- --repeat N`。结果写入忽略的 `evals/runs/local/<model>/<run-id>/`，含逐次 JSON、summary、report 与项目会话。失败保留，不自动补跑；不支持 `CASES` 子集选择。

当前系列为 `reelloom-4stage-v1`，基线见 [`evals/baselines/4stage-v1.json`](./evals/baselines/4stage-v1.json)，记录一次真实 `ollama/qwen3.8:27b` 全量运行：

| 指标 | 基线记录 |
|---|---:|
| 结构通过 | 4/4 |
| 完成率 | 100% |
| 写入／汇总拒绝数 ÷ 全部工具执行数 | 3/19（15.8%） |
| 参数容错解码 `coerced_args` | 11 |
| 总 token | 90188 |
| 估算 USD | 0（本地 Ollama 配置值，非账单） |

拒绝后修正仍可通过；参数容错解码次数包含随后被闸门拒绝的提交，不代表创作质量提升。普通评测不修改基线。`UPDATE_BASELINE=1` 仅允许真实默认 Qwen、全量、repeat=1、全部正常完成且无回归时更新；fake、其他模型与重复评测不得更新。旧 `evals/baseline.json` 仅供历史查阅，不参与当前系列比较。具体规则见 [`src/eval/report.ts`](./src/eval/report.ts)。

2026-11-04 另用 `ollama/qwen3.8:27b` 与 `deepseek/deepseek-flash` 各真实运行一次，均为 4/4 结构通过，逐工序拒绝原因、耗时与 token 见 [四工序 Qwen 与 DeepSeek 真实评测对照](./evals/runs/compare-4stage-qwen-vs-deepseek.md)。

右栏“评分（可选）”按[五档锚点](./evals/rubric.md)记录人工评分，绑定具体版本，刷新保留；“导出评分汇总”包含逐版本评分及各指标均分。评分不改变采用状态，也不参与结构放行。原理见[第八章](./chapters/p08.md)。

## 多用户与云端边界

默认 `HARNESS_MODE=local` 只提供本机无鉴权入口。`hosted` 要求通过 `HARNESS_ACCESS_TOKENS` 或 `HARNESS_ACCESS_TOKENS_FILE` 配置用户到随机令牌的 JSON 映射，项目按 `projects/<user>/<id>/` 分区。业务 REST/SSE 校验 Authorization，跨用户读写与订阅返回 404。网页令牌保存在 sessionStorage，存储不可用时留在内存。

每用户默认并发 **1**、UTC 每日启动 **20** 次，分别由 `HARNESS_MAX_CONCURRENT`、`HARNESS_DAILY_RUNS` 调整。超额返回 429 并记录审计，失败和中断仍占日次数；`GET /api/quota` 查看本人计数与各工序用量。

hosted 可用 `HARNESS_HOST` 改监听地址、`HARNESS_ORIGIN` 指定网页完整源。正式托管需 HTTPS 反向代理，只发布 `web/dist/`，不公开项目、会话或令牌文件。仍限单 API 实例，不提供原始会话下载。当前没有任意代码执行工具；引入代码、浏览器或不可信媒体处理时需重新评估执行沙盒。双用户离线演示与部署边界见[附录：搬上云端之前](./chapters/appendix-cloud.md)。
