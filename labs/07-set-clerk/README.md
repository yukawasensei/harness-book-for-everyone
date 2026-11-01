# 第 7 课实验：片场场记 · 评测桩 + 模型适配器 / Lab 07 Set Continuity Clerk

**桩是合同，模型是供应商。** 四个内容生产技能默认用确定性假实现；设 `MODEL=ollama` 时走本地 qwen，但 **schema / path / Trace 评测桩不变**——文案再好看，桩红也不过。

公开课虚拟产品；**无真实公司品牌、无账号、无公网发布**。

## 产品经理看什么

| 概念 | 含义 |
|---|---|
| 评测桩 | 验收标准：fixture → `workspace/out/` → schema/path/Trace |
| 模型适配器 | 可替换后端（默认 Ollama/qwen）；换模型不改 case |
| 降级回桩 | 解析失败记 Trace，可回 stub，仍须写对路径 |
| FAIL 条件 | schema / path / Trace 任一破坏 → 不过（即使散文好看） |

## 四个技能

| 技能 | 产出 | 断言 |
|---|---|---|
| `pick_topic` | `workspace/out/topic.json` | 必有字段 + 路径 + Trace |
| `draft_script` | `workspace/out/script.md` | 结构标题 + 路径 + Trace |
| `draft_board` | `workspace/out/board.json` | cast/props/scenes/shots + 路径 + Trace |
| `shot_prompts` | `workspace/out/prompts.json` | 每镜一条 prompt + 路径 + Trace |

## 工程师跑什么

```bash
cd labs/07-set-clerk

# CI / 无模型（必须全绿）
npm test          # = eval:schema：stub 管道 + schema/path/Trace
npm run stubs     # 强制 stub 写入

# 可选 live（本机 Ollama）
NO_PROXY=127.0.0.1,localhost MODEL=ollama npm run eval:live
# 若 Ollama 未起或模型未拉：SKIP（exit 0），不挡 CI
```

**环境变量**

| 变量 | 含义 | 默认 |
|---|---|---|
| `MODEL` / `SET_CLERK_BACKEND` | `stub` 或 `ollama` | `stub` |
| `OLLAMA_HOST` | Ollama 地址 | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | 本地模型 tag | `qwen3.8:27b` |
| `NO_PROXY` | 避免代理劫持 localhost | live 脚本会强制写入 |

## 目录

```text
fixtures/brief.json     # 输入 fixture
src/skills/*.mjs        # 四技能（stub + 可选模型）
src/model-adapter.mjs   # Ollama 适配器 / JSON 解析 / 降级
src/path-sandbox.mjs    # 只允许 workspace/out
src/trace.mjs           # 最小 JSONL Trace
src/run-all.mjs         # 管道
src/validate-schema.mjs # cases 断言（与后端无关）
src/eval-live.mjs       # 可选 live
cases.json
workspace/out/
traces/
```

## 对照笔记

- 课 19 产品：[notes/pm-learning/19-set-clerk-content-production.md](../../notes/pm-learning/19-set-clerk-content-production.md)
- 课 20 评测桩：[notes/pm-learning/20-skill-eval-stubs.md](../../notes/pm-learning/20-skill-eval-stubs.md)
- 课 21 接模型：[notes/pm-learning/21-model-behind-stubs.md](../../notes/pm-learning/21-model-behind-stubs.md)
