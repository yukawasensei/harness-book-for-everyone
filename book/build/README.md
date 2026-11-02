# 第二篇 · 分镜工坊 / Part II · Storyboard Studio

第一篇用小实验讲 harness 的闸门；第二篇把闸门接成一个文本内容生产工具。本包与 `book/harness/` 独立安装：P00 定义产物契约，P01 搭建状态机、版本存储与受限会话骨架。

入口：[P00 · 拆流水线](./chapters/p00.md) → [P01 · 搭骨架](./chapters/p01.md)。

## 安装与离线验证

需要 Git、Node.js **22.19+**、npm，运行环境为 Linux / WSL。Ollama 可在宿主机运行。依赖固定为 pi SDK 1.4.0、TypeBox 1.3.27、TypeScript 5.9.3；请使用本包命令。

```bash
cd "$(git rev-parse --show-toplevel)/book/build"
npm install
npm test
npm run typecheck
```

`npm test` 是离线测试：假模型替换 `session.agent.streamFunction`，覆盖六阶段样例和坏数据、非法推进、工具与系统提示隔离、草稿写入、人工采用、会话落盘、CLI。它不证明模型创作质量，也不请求 Ollama 或 DeepSeek。

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

跑出合规草稿后为 `pending_review`；人工 `adopt` 后才是 `adopted`，同时 `synopsis` 变为 `ready`。到 P01 为止，只有 topic 的系统提示模板可用，运行其他阶段会明确报“模板尚未实现”。状态机、版本存储与 schema 已覆盖全部六阶段。

可选 DeepSeek：复制 `.env.example` 为本包 `.env`，仅在本机填入 `DEEPSEEK_API_KEY`（勿提交、勿打印），再执行：

```bash
MODEL_ID=deepseek/deepseek-flash npm start -- run "$PROJECT_ID" topic
```

在采用之前选择模型；P8 之前，已经采用的阶段不允许再次运行。已有环境变量优先于 `.env`；不加载第一篇的 `.env`。`MODEL_ID` 支持 `provider/model`，裸模型 ID 按 `ollama` 解释。只读本包 `pi-agent/models.json`，不读本机全局 pi 扩展、技能、上下文或凭据。

## 产物与运行证据

```text
book/build/
  src/contracts/             六阶段 TypeBox schema
  src/workflow/              固定顺序与推进规则
  src/project/               版本存储与采用版本
  src/agent/                 阶段提示、两工具会话、运行摘要
  src/cli.ts                 new / status / run / adopt
  examples/sample-project/   原创静态样例（六份 JSON）
  projects/<id>/             本机产物，git 忽略
    project.json
    artifacts/<stage>/v1.json
    sessions/*.jsonl
```

运行输出 `stop_reason=draft_written` 只表示草稿已保存。模型只回复文字是 `no_draft`；连续工具调用最多八轮，超限为 `max_turns`；模型出错、取消与运行异常分别记录 `model_error`、`aborted`、`runtime_error`，CLI 返回非零。失败时已保存的草稿保留供检查，不自动采用。

SessionManager 保存会话；自定义 `stage_run_start` / `stage_run_end` 条目记录模型、用户与系统提示、工具表、上下文说明、耗时、错误、`stop_reason`。SDK 会话元数据可能保留本地 cwd，尽管发给模型的系统提示已去掉 cwd；`projects/` 不提交，也不要直接当作公开 trace 发布。

当前是单进程本地文件骨架，没有并发锁、崩溃事务恢复、多用户隔离或 Web 确认门。ID 正则检查格式；跨产物 ID 存在性、从剧本抽取完整设定、运行时固定描述原样注入留给 P5–P7；返工与下游失效留给 P8。静态样例的引用与拼装文本有单独测试，不能据此声称这些运行闸门已实现。

