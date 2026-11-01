# 第 7 课实验：片场场记 · 技能评测桩 / Lab 07 Set Continuity Clerk · Skill Eval Stubs

**先桩后实现（stub first）**：四个内容生产技能先用确定性假实现——读 fixture、写沙箱文件、落 Trace——证明 schema / path / Trace 门禁通了，再换真模型。

公开课虚拟产品「片场场记」的工程桩；**无真实公司品牌、无账号、无公网发布**。

## 产品经理看什么

| 概念 | 含义 |
|---|---|
| 评测桩 | 验收标准的可执行形状：输入 fixture → 输出文件 → 可断言 |
| schema | 产出字段/标题结构是否齐全 |
| path | 是否只写在 `workspace/out/` |
| Trace | JSONL 是否有 `write` + `harness_end.stop_reason` |
| 先桩后实现 | 桩绿了才谈「模型写得好不好」 |

## 四个技能

| 技能 | 产出 | 桩断言 |
|---|---|---|
| `pick_topic` | `workspace/out/topic.json` | 必有字段 + 路径 + Trace |
| `draft_script` | `workspace/out/script.md` | 结构标题 + 路径 + Trace |
| `draft_board` | `workspace/out/board.json` | cast/props/scenes/shots + 路径 + Trace |
| `shot_prompts` | `workspace/out/prompts.json` | 每镜一条 prompt + 路径 + Trace |

## 工程师跑什么

```bash
cd labs/07-set-clerk
npm test          # = eval:schema：跑桩 + 校验 schema/path/Trace
npm run stubs     # 只跑确定性写入
npm run eval:live # 目前 SKIP（无模型）；保留脚本位
```

**不需要 Ollama。** 路径逃逸（`../../`）会在 `run-all` 里被沙箱拒绝。

## 目录

```text
fixtures/brief.json     # 输入 fixture（虚构主题）
src/skills/*.mjs        # 四个确定性桩
src/path-sandbox.mjs    # 只允许 workspace/out
src/trace.mjs           # 最小 JSONL Trace
src/run-all.mjs         # 管道跑通
src/validate-schema.mjs # cases 断言
cases.json              # 四条 case
workspace/out/          # 产出落点
traces/                 # Trace JSONL
```

## 对照笔记

- 课 19 产品与验收：[notes/pm-learning/19-set-clerk-content-production.md](../../notes/pm-learning/19-set-clerk-content-production.md)
- 课 20 评测桩：[notes/pm-learning/20-skill-eval-stubs.md](../../notes/pm-learning/20-skill-eval-stubs.md)
- 评测形状参考：`labs/06-evals`
