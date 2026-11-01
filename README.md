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
2. **课表与设计** → [`notes/_curriculum-redesign-proposal.md`](./notes/_curriculum-redesign-proposal.md)
3. **旧版资料（参考）** → `notes/pm-learning/`（23 课图解笔记）、`labs/01`–`07`（逐课实验）

## Quickstart · 克隆到绿基线

**需要**：Git · Node.js 20+（LTS）· Linux 或 WSL2。**可选**：本机 [Ollama](https://ollama.com) + `qwen3.8:27b`（真跑才需要）。

```bash
git clone https://github.com/yukawasensei/harness-book-for-everyone.git
cd harness-book-for-everyone/book/harness
npm install
npm test            # 离线全绿，不需要 Ollama
npm run typecheck

# 有 Ollama 时：跑全部 case，写基线并签字
npm run eval
```

| 命令 | 需要 Ollama？ | 证明什么 |
|---|---|---|
| `npm test` | 否 | 闸门、验收器、隔离配置的单测全绿 |
| `npm run eval` | **是** | 每条 case 端到端 PASS，且相对上一份基线无回归 |
| `npm run report` | 否 | 读已提交的 `evals/baseline.json` |

harness 只读仓库里的 `book/harness/pi-agent/models.json`，**不**加载你本机 `~/.pi` 的扩展、技能或凭据（见 Ch3）。**禁止**：付费云模型 / 把密钥写进仓库。

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

### 主线：book/harness（Ch0–Ch10）

| 章 | 主题 | 状态 |
|---:|---|---|
| 0 | 跑通本地栈（Ollama + pi CLI） | 用 `labs/01`、`labs/02` |
| 1 | 看见循环（`pi --mode json` 事件链） | 用 `labs/03` |
| 2 | 从零写最小 harness | tag `ch02` |
| 3 | 自己造工具 + 隔离 `~/.pi` | tag `ch03` |
| 4 | 刹车：轮数与超时 | tag `ch04` |
| 5 | 边界：白名单与路径沙箱 | tag `ch05` |
| 6 | 评测基线与签字 | tag `ch06` |
| 7 | 上下文预算与重试降级 | 进行中 |
| 8 | 人机确认门 + 第一次写入 | 进行中 |
| 9 | 成本与延迟预算 | 进行中 |
| 10 | 综合项目：片场场记（精简版） | 进行中 |

### 旧版资料（保留，供参考）

- [`notes/pm-learning/`](./notes/pm-learning/)：23 课 PM 图解 + 费曼笔记，已按主题并入上面各章（对照表见[重构提案](./notes/_curriculum-redesign-proposal.md)第 3 节）。
- `labs/01`–`07`：逐课实验。`labs/05-minimal-harness` 是闸门“成品版”，`labs/06-evals` 是它的评测；`labs/07-set-clerk` 是固定流水线 + 评测桩。

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

