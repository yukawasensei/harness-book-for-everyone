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

1. **产品经理课表（图解 + 费曼）** → [`notes/pm-learning/README.md`](./notes/pm-learning/README.md)  
2. **工程实验** → `labs/01` … `labs/07`（最小 harness + evals + 片场场记评测桩）  
3. **验收报表** → 在 `labs/06-evals` 运行 `npm run eval:report`（读取 `results/baseline-latest.json`）

## Quickstart · 克隆到绿基线

给第一次打开仓库的读者。详细图解见 [`notes/pm-learning/18-getting-started.md`](./notes/pm-learning/18-getting-started.md)。

**需要**：Git · Node.js 20+（LTS）· Linux 或 WSL2。**可选**：本机 [Ollama](https://ollama.com) + 课程所用本地模型（仅 `eval:live`）。

```bash
git clone https://github.com/yukawasensei/harness-book-for-everyone.git
cd harness-book-for-everyone   # 本地目录名也可仍为历史 pi-qwen-harness

cd labs/05-minimal-harness && npm install && npm test && cd -
cd labs/06-evals && npm install && npm run eval:schema && cd -

# 有 Ollama 时再跑 live（务必设 NO_PROXY，避免代理劫持 localhost）
cd labs/06-evals
NO_PROXY=127.0.0.1,localhost npm run eval:live
npm run eval:report
```

| 命令 | 需要 Ollama？ | 证明什么 |
|---|---|---|
| `labs/05… npm test` | 否 | 闸门单测绿 |
| `labs/06… npm run eval:schema` | 否 | 案例规格合法 |
| `labs/06… npm run eval:live` | **是** | 端到端基线绿 |

**笔记入口**：[`notes/pm-learning/`](./notes/pm-learning/)（图解课表）。**禁止**：付费云模型 / 把密钥写进仓库。

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

### PM 笔记（推荐主线）

见 [`notes/pm-learning/`](./notes/pm-learning/)：能力总览 → 工具循环 → 会话 → 权限/路径 → 轮数超时 → Trace → Evals → 选型/协作/落地 → **硬边界** → **路径沙箱** → **Trace 验收签字** → **上下文预算** → **重试与降级** → **人机确认（HITL）** → **成本与延迟预算** → **[开源读者上手](./notes/pm-learning/18-getting-started.md)**（克隆到绿基线）。加深弧课 14–18 **已完成**。落地实操弧：[课 19 片场场记](./notes/pm-learning/19-set-clerk-content-production.md) → [课 20 技能评测桩](./notes/pm-learning/20-skill-eval-stubs.md) → [课 21 接模型写稿](./notes/pm-learning/21-model-behind-stubs.md)（`labs/07-set-clerk` · stub/`MODEL=ollama`）。

### Labs

| Lab | 主题 |
|---|---|
| `labs/01-model-api` | 无工具 vs 注入上下文 vs Agent read |
| `labs/02-pi-cli` | 只读工具 allowlist |
| `labs/03-agent-events` | JSONL 事件与循环 |
| `labs/04-custom-tool` | 自定义工具 |
| `labs/05-minimal-harness` | maxTurns / timeout / allowlist / path sandbox |
| `labs/06-evals` | cases + live baseline + `eval:schema` / `eval:live` / `eval:report` |
| `labs/07-set-clerk` | 片场场记四技能：评测桩 + 可选 Ollama/qwen 适配器（schema/path/Trace 不变） |

克隆后怎么证明还在工作？见 [课 18 上手指南](./notes/pm-learning/18-getting-started.md)。

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

