# 第二篇 · 分镜工坊 / Part II · Storyboard Studio

第一篇用小实验讲 harness 的闸门；第二篇把闸门接成一个文本内容生产工具。本包与 `book/harness/` 独立安装：P00 定义产物契约，P01 搭建状态机、版本存储与受限会话骨架，P02 接上本地 Web 的事件与指令，P03 加上选题与梗概的版本审阅和修改运行，P04 用逐场提交与程序拼装管理剧本输出预算，P05 从采用剧本抽取带来源场的设定集并执行覆盖检查，P06 以引用闸门保证分镜与采用上游一致，P07 由模型写单镜部分、程序原样注入固定设定。

入口：[P00 · 拆流水线](./chapters/p00.md) → [P01 · 搭骨架](./chapters/p01.md) → [P02 · 接上 Web](./chapters/p02.md) → [P03 · 选题与梗概](./chapters/p03.md) → [P04 · 剧本与输出预算](./chapters/p04.md) → [P05 · 从剧本抽取设定集](./chapters/p05.md) → [P06 · 分镜与引用一致性](./chapters/p06.md) → [P07 · 模型写镜头，程序注入设定](./chapters/p07.md)。

## 安装与离线验证

需要 Git、Node.js **22.19+**、npm，运行环境为 Linux / WSL。Ollama 可在宿主机运行。依赖固定为 pi SDK 1.4.0、TypeBox 1.3.27、TypeScript 5.9.3、Vite 7.3.7、React 19.2.0；请使用本包命令。

```bash
cd "$(git rev-parse --show-toplevel)/book/build"
npm install
npm test
npm run typecheck
```

`npm test` 是离线测试：假模型替换 `session.agent.streamFunction`，覆盖六阶段样例和坏数据、非法推进、工具与系统提示隔离、草稿写入、人工采用、会话落盘、CLI、临时 HTTP/SSE、并发保护、中断、三种审阅决定、修改提示原文、审计、旧项目兼容与页面的断线轮询逻辑。它不证明模型创作质量，也不请求 Ollama 或 DeepSeek。`npm run typecheck` 同时检查服务端与网页；`npm run build` 输出 `web/dist/`，该目录不提交。

## 打开 Web 工作区

仍在 `book/build`，先用离线演示看清事件路径：

```bash
HARNESS_DEMO=1 npm run dev
```

浏览器访问 **http://127.0.0.1:5173**。命令同时启动 Vite（5173）和 API（3001），都只监听 `127.0.0.1`；Vite 把 `/api` 代理到 **http://127.0.0.1:3001**，网页使用相对地址。端口占用会报错并停止这两个子进程，不自动换端口。按 Ctrl+C 结束自己的两个服务及未完成运行，不影响其他进程。

填新项目标题 → 点“新建项目” → 保持“选题” → 可填补充要求 → 点“运行阶段”。几秒内左侧出现文本与 `read_upstream`、`write_draft` 卡片；假模型先交一份不合规草稿，再修正，故可同时看到错误和成功。右侧选 v1 查看 JSON → “要求修改”填意见 → “按意见修改 v1” → v2 出现后选中并采用 → 梗概变 `ready` → 切到梗概运行并采用。再切到剧本运行：先看到漏填台词角色的单场错误与修正重交，随后 S02、S03 暂存，最后汇总为待审阅 v1；再要求修改，使用预填的“只修改 S02”意见并启动修改，只重交 S02 后生成 v2，汇总卡片显示重交与沿用场号。截图可覆盖逐场工具、错误与修正、汇总及右侧剧本预览。另建项目运行选题后可点“丢弃”，版本保留且不能再采用。运行中可点“中断”；想截运行中的界面，在卡片出现时截取。想再跑一次，采用前可生成新版本，或另建项目。

采用剧本后切到“设定集”运行：先漏掉陆岑，被覆盖检查拒绝；补齐后出现待审阅 v1，右侧按角色／道具／场景分组展示固定描述与来源场。预览区域可滚动查看各组；采用后分镜依赖满足，导航显示“可运行”。截图可覆盖拒绝卡片、三组设定预览与采用后的分镜状态。旧设定集缺少 `appears_in` 时明确拒绝读取与采用，不自动迁移或覆盖，须从采用剧本重新抽取；已采用的旧设定集需在新项目重新建立上游。详见 [P05](./chapters/p05.md)。

采用设定集后切到“分镜脚本”运行：先引用不存在的 P99 被拒，再引用来源不含 S01 的 C03 被拒；修正后按场暂存，汇总为待审阅 v1。右侧按场展示六张镜头卡，引用以名称和编号显示。保持未采用，点“要求修改”并确认预填的只修改 S02 意见，再点“按意见修改 v1”；只重交 S02，v2 的修改记录显示沿用 S01、S03。采用 v2 后提示词可运行。详见 [P06](./chapters/p06.md)。

采用分镜后切“分镜提示词”运行：首镜提到未引用的陆岑被粗筛拒绝，修正后逐镜提交，程序汇总并原样注入固定设定。右侧蓝色为模型镜头部分，绿色为程序注入部分，每镜可复制完整提示词。未采用时可要求只修改 S02-01，重交一镜生成 v2，其余五镜原样沿用；采用后六阶段均已采用，并显示“全流程已完成”。详见 [P07](./chapters/p07.md)。`npm run context:compare` 可离线复现上下文字符数与估算 token 对比。

顶部明确标出**离线演示 / 假模型**。它用原创静态样例替代模型回答，真实 SDK、工具、schema、版本保存与采用仍照常执行；补充要求进入用户提示，但演示回答不随要求改变。六阶段模板均可用；演示的修改答案也是固定原创文本，不会理解任意修改意见；设定集的预设修改只把程禾外套改为深灰色。提示词修改的预设答案只改变 S02-01 的停顿与构图。按钮说明使用中文阶段名。

使用真实模型时，先结束演示命令，再按下文准备本包模型配置，运行：

```bash
NO_PROXY=127.0.0.1,localhost npm run dev
# 可选 DeepSeek（需先在本机配置本包密钥）：
# MODEL_ID=deepseek/deepseek-flash npm run dev
```

不设 `HARNESS_DEMO=1` 才会请求真实模型，而且只在点击“运行阶段”后请求。此时新增项目，在选题填写要求并运行；左侧显示实际文本和工具结果，右侧出现版本后再审阅采用。模型只回复文字、出错或中断时，页面显示实际 `stop_reason`，不把它当作成功交付。

断线后页面每两秒轮询项目详情，继续显示阶段、版本、当前运行和最近运行结论，EventSource 同时自动重连。重连先收项目快照；缺失文本不会补造。切换项目或重开网页不回放历史对话，但版本产物仍可读取；项目和该项目最近选择的阶段都在浏览器本地记忆，刷新后恢复，存储不可用时从选题开始。运行状态和最近结论保留在服务内存中，重启后清空；完整运行审计仍在项目 `sessions/`。

这是没有鉴权的本机开发入口，不提供云端或多用户访问。API 只有项目业务路由，不接收任意文件路径。已有 CLI 可继续使用，但 Web 运行时不要在 CLI 修改同一项目；进程内的 409 锁不覆盖另一个进程。

## 先建项目，再跑一个阶段

```bash
npm start -- new 示例
# 输出项目 UUID，复制到变量（不要输入尖括号占位符）
PROJECT_ID=把上一步输出的项目ID粘贴到这里
npm start -- status "$PROJECT_ID"
```

此时 `topic: ready`，其余阶段为 `locked`，版本列表与采用版本为空。以上命令不读密钥、不连模型。

只有下一条需要真实模型：默认地址为 `http://127.0.0.1:11434/v1`，模型为 `ollama/qwen3.8:27b`。请先按第一篇准备好 Ollama 和对应模型。

```bash
NO_PROXY=127.0.0.1,localhost npm start -- run "$PROJECT_ID" topic
npm start -- status "$PROJECT_ID"
# 查看项目产物，确认 v1 的内容后，再手动采用（若生成了多个版本，选你审过的编号）
cat "projects/$PROJECT_ID/artifacts/topic/v1.json"
npm start -- adopt "$PROJECT_ID" topic 1
npm start -- status "$PROJECT_ID"
```

跑出合规草稿后为 `pending_review`；人工 `adopt` 后才是 `adopted`，同时 `synopsis` 变为 `ready`。六阶段均可运行，依赖须先采用。状态机、版本存储与 schema 已覆盖全部六阶段。

可选 DeepSeek：复制 `.env.example` 为本包 `.env`，仅在本机填入 `DEEPSEEK_API_KEY`（勿提交、勿打印），再执行：

```bash
MODEL_ID=deepseek/deepseek-flash npm start -- run "$PROJECT_ID" topic
```

在采用之前选择模型；已经采用的阶段当前不允许再次运行。已有环境变量优先于 `.env`；不加载第一篇的 `.env`。`MODEL_ID` 支持 `provider/model`，裸模型 ID 按 `ollama` 解释。只读本包 `pi-agent/models.json`，不读本机全局 pi 扩展、技能、上下文或凭据。

## 产物与运行证据

```text
book/build/
  src/contracts/             六阶段 TypeBox schema
  src/workflow/              固定顺序与推进规则
  src/project/               版本存储与采用版本
  src/agent/                 阶段提示、工具白名单、分场暂存与运行摘要
  src/server/                本地 REST、SSE、单项目运行锁
  src/cli.ts                 new / status / run / adopt
  web/                       Vite + React 工作区
  scripts/dev.mjs            同时启动 API 与网页
  examples/sample-project/   原创静态样例（六份 JSON）
  projects/<id>/             本机产物，git 忽略
    project.json              阶段及各版本审阅状态
    audit.jsonl               本地采用 / 丢弃 / 要求修改记录
    artifacts/<stage>/v1.json
    sessions/*.jsonl
```

运行输出 `stop_reason=draft_written` 只表示草稿已保存。模型只回复文字是 `no_draft`；选题与梗概最多八轮模型响应，剧本最多二十轮、分镜最多二十四轮、提示词最多三十二轮，超限为 `max_turns`；模型出错、取消与运行异常分别记录 `model_error`、`aborted`、`runtime_error`，CLI 返回非零。失败时已保存的版本保留供检查，不自动采用。剧本的 `write_scene` 只暂存单场，`finalize_draft` 排序并校验后才生成版本；未汇总不出版本，已暂存的场可在会话工具记录与结束条目的 `in_progress` 快照中查看，普通运行不继承；按意见修改则预装指定原稿，只重交受影响的场，删场用 `remove_scene`，摘要记录重交、沿用与删除的场号。详见 [P04](./chapters/p04.md)。

SessionManager 保存会话；自定义 `stage_run_start` / `stage_run_end` 条目记录模型、用户与系统提示、工具表、上下文说明、耗时、错误、`stop_reason`。SDK 会话元数据可能保留本地 cwd，尽管发给模型的系统提示已去掉 cwd；`projects/` 不提交，也不要直接当作公开 trace 发布。

当前是单进程本地文件骨架。Web 对同一项目的运行与三种审阅操作做 409 互斥，尚无跨进程锁、崩溃事务恢复或多用户隔离。草稿只追加，不挂起写入；网页确认门在采用之前，对外发布等副作用的执行前确认尚未接入。ID 正则检查格式；设定集已检查台词角色覆盖、来源场存在性与每场地点覆盖，并对固定描述做长度、场号与剧情词粗筛，仍需人审。分镜在写入、读取与采用时复核镜号、场次覆盖、设定引用、角色与地点来源、台词说话人；时长偏差超过 20% 只警告。提示词按镜暂存，汇总时原样注入固定描述，写入、读取与采用均复核模板、引用及全覆盖；模型没有读取整份设定集的工具。已采用阶段返工与下游失效尚未实现。


## 版本审阅与修改

新版本为 `pending`，人可采用、丢弃或填写必填意见要求修改。丢弃与要求修改都保留原文件，不能重复审阅；要求修改的版本旁可点“按意见修改”，程序把该版本 JSON 原文与意见送入新运行，新版本重新待审。所有依赖采用后才解锁下游，已采用阶段禁止重跑。旧项目不需手动迁移。

API 在既有 adopt 路由之外增加 `POST /api/projects/:id/stages/:stage/discard`（`version`、可选 `note`）和 `request-changes`（`version`、必填 `note`）；运行请求可带 `revise_from`。每个有效决定追加 `audit.jsonl`，actor 固定为 `local`，不代表已鉴权的身份。状态与审计无跨文件事务保证。详细原理与离线操作见 [P03](./chapters/p03.md)。
