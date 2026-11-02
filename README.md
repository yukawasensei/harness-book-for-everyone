# 写给大家看的 Harness 书 / Harness Book for Everyone

**写给大家看的 Harness 书**——面向大众的 Agent Harness 公开课：用本地样本栈（**pi + Ollama / Qwen**）搞懂工具循环、硬闸门、路径沙箱、上下文预算、重试降级与评测验收。适合产品经理与协作工程师。

> **Harness Book for Everyone** — a public Agent Harness curriculum: learn the tool loop, hard gates, path sandbox, context budget, retry/degrade, HITL confirm gates, cost/latency budgets, and eval sign-off with a local sample stack (**pi + Ollama / Qwen**). Built for PMs and the engineers who ship with them.

## 你学完能拍板什么 / What you can decide

| 中文 | English |
|---|---|
| Prompt 不是护栏 | Prompt is not a guardrail |
| 闸门要看 Trace 里的 `stop_reason` / 工具名 | Gates are proven by Trace `stop_reason` / tool names |
| 白名单 ≠ 路径安全 | Allowlist ≠ path safety |
| 改 Harness 前先跑 evals | Run evals before calling a harness change “done” |

## 快速入口 / Start here

**主线：跟着一个 harness 从零长大**（practice-first）。全书只有一个代码库 [`book/harness/`](./book/harness/)，每章打一个 git tag，`git checkout chNN` 就能看到那一章结束时的代码。

1. **跟做主线** → [`book/harness/README.md`](./book/harness/README.md)（每章加了什么、怎么跑）
2. **PM 验收清单** → [`book/harness/chapters/appendix-pm-checklist.md`](./book/harness/chapters/appendix-pm-checklist.md)
3. **术语表 / Glossary** → [`notes/glossary.md`](./notes/glossary.md)

早期课程资料见 tag `book-v1.3`。

## Quickstart · 克隆到绿基线

**需要**：Git · Node.js 22.19+ · Linux 或 WSL2。**可选**：本机 [Ollama](https://ollama.com) + `qwen3.8:27b`（真跑才需要）；也可以用 DeepSeek API 代替本地 GPU（`MODEL_ID=deepseek/deepseek-flash`，key 放 `book/harness/.env`，勿提交）。

```bash
git clone https://github.com/yukawasensei/harness-book-for-everyone.git
cd harness-book-for-everyone/book/harness
npm install
npm test            # 离线全绿，不需要 Ollama
npm run typecheck

# 有 Ollama 时：全量跑（默认只写 evals/runs/local/，不改签收基线）
NO_PROXY=127.0.0.1,localhost npm run eval

# 显式更新签收基线（须未设 CASES、repeat=1、全部通过；失败保留旧基线）
# UPDATE_BASELINE=1 MODEL_ID=ollama/qwen3.8:27b npm run eval

# DeepSeek：cp .env.example .env（填 DEEPSEEK_API_KEY，勿提交）后
# MODEL_ID=deepseek/deepseek-flash npm run eval
```

| 命令 | 需要 Ollama？ | 证明什么 |
|---|---|---|
| `npm test` | 否 | 闸门、验收器、隔离配置的单测全绿 |
| `npm run eval` | **是**（或改用 DeepSeek API） | 每条 case 端到端 PASS，且相对已提交基线无回归（默认不改 `evals/baseline.json`） |
| `npm run report` | 否 | 读已提交的 `evals/baseline.json` |

harness 只读仓库里的 `book/harness/pi-agent/models.json`，**不**加载你本机 `~/.pi` 的扩展、技能或凭据（见 Ch3）。**禁止**：把密钥写进仓库（`.env` 勿提交）。两种跑法见 [`book/harness/README.md`](./book/harness/README.md#两种跑法--two-ways-to-run)。

## 样本架构（可替换） / Sample architecture

```text
WSL / Linux  ·  pi harness · Node · evals
        |
        |  OpenAI-compatible API
        v
http://127.0.0.1:11434/v1
        |
        v
Host Ollama  ·  local qwen (e.g. qwen3.8:27b)
```

- 仓库路径请用你自己的 clone 根目录（下文写作 `<repo-root>` / `workspaceRoot`）。  
- Use your own clone path (`<repo-root>` / `workspaceRoot`); do not copy another machine’s absolute home path.
- 默认 **NO_PROXY=127.0.0.1,localhost**，避免代理劫持本机 Ollama。

## 课表速览 / Curriculum map

### 主线：book/harness（Ch0–Ch11）

| 章 | 主题 | 状态 |
|---:|---|---|
| 0 | [跑通本地栈（Ollama + pi CLI）](./book/harness/chapters/ch00.md) | 书内步骤 |
| 1 | [看见循环（`pi --mode json` 事件链）](./book/harness/chapters/ch01.md) | 书内步骤 |
| 2 | [从零写最小 harness](./book/harness/chapters/ch02.md) | tag `ch02` |
| 3 | [自己造工具 + 隔离 `~/.pi`](./book/harness/chapters/ch03.md) | tag `ch03` |
| 4 | [刹车：轮数与超时](./book/harness/chapters/ch04.md) | tag `ch04` |
| 5 | [边界：白名单与路径沙箱](./book/harness/chapters/ch05.md) | tag `ch05` |
| 6 | [评测基线与签字](./book/harness/chapters/ch06.md) | tag `ch06` |
| 7 | [上下文预算与重试降级](./book/harness/chapters/ch07.md) | tag `ch07` |
| 8 | [人机确认门 + 第一次写入](./book/harness/chapters/ch08.md) | tag `ch08` |
| 9 | [成本与延迟预算](./book/harness/chapters/ch09.md) | tag `ch09` |
| 10 | [综合项目：片场场记（精简版）](./book/harness/chapters/ch10.md) | tag `ch10` |
| 11 | [从失败到修复](./book/harness/chapters/ch11.md) | tag `ch11` |

### 第二篇（实操，连载中）：book/build · 分镜工坊

用 pi SDK 做一个真正能用的文本内容生产 harness：选题 → 梗概 → 剧本 → 设定集 → 分镜 → 分镜提示词。外层由程序状态机管阶段，内层由受限 agent 写草稿，人决定采用哪一版。入口：[`book/build/README.md`](./book/build/README.md)。

| 章 | 主题 | 状态 |
|---:|---|---|
| P00 | [拆流水线：先定产物，再请模型](./book/build/chapters/p00.md) | tag `p2-01` |
| P01 | [搭骨架：程序管阶段，模型写草稿](./book/build/chapters/p01.md) | tag `p2-01` |
| P02 | [接上 Web：事件流与指令](./book/build/chapters/p02.md) | tag `p2-02` |
| P03 | [选题与梗概：采用之前的审阅门](./book/build/chapters/p03.md) | tag `p2-03` |
| P04 | [剧本：把输出预算变成产品规则](./book/build/chapters/p04.md) | tag `p2-04` |
| P05 | [从剧本抽取设定集](./book/build/chapters/p05.md) | tag `p2-05` |
| P06 | [分镜脚本与引用一致性](./book/build/chapters/p06.md) | tag `p2-06` |
| P07 | [模型写镜头，程序注入设定](./book/build/chapters/p07.md) | tag `p2-07` |
| P08 | [版本与返工：改上游，下游怎么办](./book/build/chapters/p08.md) | tag `p2-08` |

## 安全基线 / Safety baseline

- 早期实验默认只读工具；危险工具必须由 **Harness allowlist** 排除，而不是靠模型“答应不用”。  
- 文件工具必须落在 **workspaceRoot** 内（路径沙箱）；越界应产生可审计的 `path_denied`。  
- 验收看 Trace / baseline，不看最终回复是否“听起来乖”。

## 开源说明 / Open source notes

- 课程与图解按 **可公开** 内容维护（无公司品牌、无私人邮箱、无本机绝对家目录）。  
- 训练 / 本机硬件细节若需保留，请放在未跟踪的私有笔记（见 [`OPEN_SOURCE.md`](./OPEN_SOURCE.md)）。  
- Diagrams: **中英文配套**（CN + EN labels）。

## License

MIT — see [`LICENSE`](./LICENSE). Copyright (c) 2026 harness-book-for-everyone contributors.
