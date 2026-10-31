# Pi Agent + Qwen Harness 与微调零基础实操计划

> **For facilitators:** 按本计划逐课实施；每课先讲 10–15 分钟核心概念，再由用户亲手完成实验，助教负责环境检查、排错和验收。不要一次性替用户把所有代码写完。

**Goal:** 让零基础用户在本机完成“使用 Pi → 看懂 Agent 循环 → 构建自己的最小 Harness → 建立评测 → 制作数据 → 完成 Qwen3.8 QLoRA 微调 → 接回 Harness 对比”的完整闭环。

**Architecture:** Windows 侧只运行 Ollama、Qwen3.8:27b、NVIDIA 驱动（及其他本机宿主服务）；WSL2 Ubuntu 侧统一运行 Pi CLI/SDK、Node.js/TypeScript、Harness 源码、评测、Python 与 QLoRA 微调。Pi 通过 mirrored networking 访问 `http://127.0.0.1:11434/v1`，复用 Windows Ollama 和同一份 17GB 模型，不在 WSL 重复安装 Ollama。

**Tech Stack:** Windows/Linux host、example local GPU ≈24GB VRAM、adequate RAM、WSL2 Ubuntu 24.04、Windows Ollama 0.33.2、Qwen3.8:27b、WSL Node.js 22、Pi 0.84.4、TypeScript、Python 3.12、Transformers、TRL、PEFT、bitsandbytes、pytest。

**Workspace:** 活跃项目统一放在 WSL 原生文件系统 `~/ai-learning/`；不要把 `node_modules`、Python venv 或训练缓存放在 `/mnt/c`。需要给 Windows 使用的报告和成品再导出到 `<windows-exports>/`。

---

## 0. 当前环境与路线选择

### 已确认的本机条件

- WSL Node.js：`v22.22.1`（NVM 0.40.5）
- WSL npm：`10.9.4`
- Git：WSL `/usr/bin/git`
- Windows Ollama：`0.32.12`，WSL 已能通过 `127.0.0.1:11434` 访问
- 已安装推理模型：`qwen3.8:27b`，约 17GB
- GPU：example local GPU ≈24GB VRAM（以本机实测为准）
- WSL：Ubuntu 24.04，用户 `<you>`，HOME `~`
- WSL 根盘可用约 949GB
- WSL/宿主机可见本机 GPU
- WSL Python：3.12.3
- 课程当前固定 Pi npm 包：`@earendil-works/pi-coding-agent@0.84.4`

### 为什么仍然分推理与训练两种工件

1. `qwen3.8:27b`：Ollama 量化推理工件，用于 Pi/Harness、工具调用、候选数据生成和评审。
2. `Qwen/Qwen3.8-27B`：Hugging Face 训练源模型，用于后续 QLoRA；不能直接拿 Ollama 的 Q4 blob 训练。
3. 当前官方 Qwen3.8 系列没有 0.8B/4B 同名小模型，因此课程不虚构不存在的模型 ID。
4. ≈24GB 消费级 GPU 对 27B QLoRA 属于边界场景：先做极小序列、极少步数的可行性门，再决定是否进入正式训练；失败时明确停在门口，不偷偷换回其他系列。

### 必须先理解的边界

- **Model**：根据上下文预测下一个 token。
- **Tool**：模型可以请求调用、但由宿主程序真正执行的函数。
- **Agent loop**：模型输出工具调用 → 宿主执行 → 工具结果放回上下文 → 模型继续推理。
- **Harness**：围绕模型的工程外壳，包括提示词、工具、循环、状态、上下文、权限、重试、日志、评测和 UI。
- **Fine-tuning**：改变模型参数；不能替代 Harness 的权限、重试、工具执行和状态管理。
- **SFT**：用“输入 → 理想输出”示例训练行为。
- **LoRA/QLoRA**：只训练少量适配参数；QLoRA 还把底模以 4-bit 加载以节省显存。
- **Inference quantization ≠ training quantization**：Ollama Q4 模型适合推理，不等于可直接继续训练。

---

# 第一阶段：会用 Pi，并看见 Harness 在做什么

## 课 1：基线、目录和安全边界

**Objective:** 建立隔离工作区，确认 Ollama 模型/API 正常，理解“模型请求”和“Agent 请求”的区别。

**WSL 工作区：**

```text
<repo-root>
```

**计划文件结构：**

```text
pi-qwen-harness/
├── AGENTS.md
├── README.md
├── notes/
│   └── glossary.md
├── labs/
│   ├── 01-model-api/
│   ├── 02-pi-cli/
│   ├── 03-agent-events/
│   ├── 04-custom-tool/
│   ├── 05-minimal-harness/
│   └── 06-evals/
├── evals/
│   ├── cases.jsonl
│   └── results/
└── training/
    ├── data/
    ├── scripts/
    └── reports/
```

**实验：**

1. 用 `/api/generate` 做普通问答。
2. 用 `/v1/chat/completions` 做 OpenAI-compatible 请求。
3. 保存完整请求、响应、耗时和 token 统计。
4. 明确这时还没有 Agent loop，也没有任何工具执行。

**验收：**

- `ollama list` 能看到 `qwen3.8:27b`。
- API 返回非空文本。
- 用户能用自己的话解释“调用模型”和“运行 Agent”的差别。

---

## 课 2：安装 Pi 并连接本地 Qwen3.8

**Objective:** 让 Pi 使用本机 Ollama，不依赖云端 API key。

**安装命令：**

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.84.4
pi --version
```

**配置文件：**

```text
~/.pi/agent/models.json
```

**首版配置：**

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://127.0.0.1:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false
      },
      "models": [
        {
          "id": "qwen3.8:27b",
          "name": "Qwen3.8 27B Local",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 4096,
          "maxTokens": 2048,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0
          }
        }
      ]
    }
  }
}
```

**先用只读工具：**

```bash
pi --provider ollama --model qwen3.8:27b \
  --tools read,grep,find,ls \
  -p "读取 README.md，并列出项目当前有哪些学习目录。不要修改文件。"
```

以上命令在 WSL Bash 中执行。Pi 和项目配置不与 Windows 用户目录下的 `.pi` 混用。

**验收：**

- `pi --list-models qwen3.8` 能看到本地模型。
- Pi 至少触发一次只读工具调用。
- 最终回答与真实文件结构一致。
- 运行后检查项目文件无意外修改。

**安全规则：**

- 前两课禁用 `bash/edit/write`。
- Pi 官方没有默认权限弹窗；它继承启动用户的系统权限。
- 第三方 Pi 扩展可执行任意代码，未经源码审查不安装。

---

## 课 3：观察 Agent 事件和循环

**Objective:** 不把 Agent 当黑盒，能从事件流识别每一轮模型调用和工具执行。

**命令：**

```bash
pi --provider ollama --model qwen3.8:27b \
  --tools read,grep,find,ls \
  --mode json --no-session \
  "查找 README.md 中的 Goal，并解释它。" \
  > labs/03-agent-events/session.jsonl
```

**要标注的事件：**

- 用户消息
- `agent_start`
- `turn_start`
- assistant 工具调用
- `tool_execution_start`
- `tool_execution_end`
- tool result
- 下一轮 assistant 响应
- `agent_end`

**练习：** 画出下面的循环并把 JSONL 中对应事件 ID 填进去。

```text
User prompt
    ↓
System prompt + messages + tool schemas
    ↓
Qwen3.8
    ├── final answer → stop
    └── tool call
            ↓
        Harness validates and executes
            ↓
        tool result appended to messages
            └──────────────→ Qwen3.8 again
```

**验收：** 用户能指出一次完整的“模型 → 工具 → 模型”闭环。

---

# 第二阶段：从 Pi 用户变成 Harness 构建者

## 课 4：做第一个 Pi Extension 工具

**Objective:** 编写一个只读取实验目录统计信息的自定义工具，理解工具 schema、执行器和返回值。

**文件：**

```text
<repo-root>/.pi/extensions/workspace-stats.ts
```

**工具约束：**

- 名称：`workspace_stats`
- 参数：可选相对目录
- 只允许访问项目根目录内路径
- 返回文件数量、目录数量和总字节数
- 拒绝 `..`、绝对路径和符号链接逃逸
- 不能执行 shell

**测试：**

1. 正常统计 `labs/`。
2. 请求 `../`，预期被拒绝。
3. 请求不存在目录，预期结构化错误。
4. 让 Qwen3.8 决定何时调用该工具。

**验收：** 工具结果与独立脚本统计一致；越界测试全部失败且没有读取项目外文件。

---

## 课 5：用 Pi SDK 构建最小 Harness

**Objective:** 不再只调用 Pi CLI，而是在 TypeScript 中创建会话、指定模型、限定工具并订阅事件。

**目录：**

```text
labs/05-minimal-harness/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── events.ts
│   └── policy.ts
└── tests/
    └── policy.test.ts
```

**依赖：**

```bash
npm install --save-exact @earendil-works/pi-coding-agent@0.84.4
npm install --save-dev --save-exact typescript tsx @types/node
```

**最小程序必须包含：**

```ts
const modelRuntime = await ModelRuntime.create();
const model = modelRuntime.getModel("ollama", "qwen3.8:27b");

const { session } = await createAgentSession({
  cwd: process.cwd(),
  model,
  modelRuntime,
  tools: ["read", "grep", "find", "ls"],
  sessionManager: SessionManager.inMemory(),
});

session.subscribe((event) => {
  // 写入 JSONL：时间、事件类型、toolName、isError、耗时
});

await session.prompt("读取 README.md，并总结学习目标。");
```

**必须亲手补齐的能力：**

1. 最大轮数 `maxTurns`。
2. 单工具超时。
3. 工具 allowlist。
4. 工作目录边界。
5. 单次工具结果最大字符数。
6. 最终状态：`success | max_turns | tool_error | model_error`。
7. 每次运行写 JSONL trace。

**测试：**

- 越界路径被策略层拒绝。
- 第 N+1 轮不会继续请求模型。
- 超长工具输出被截断并带有标记。
- 工具异常不会让进程无提示崩溃。

---

## 课 6：理解一个“靠谱 Harness”至少要有什么

**Objective:** 把 Demo Agent 改成可测、可控、可复现的 Agent。

**逐项加入，不要一次全加：**

1. 输入验证
2. 工具 schema
3. 工具 allowlist
4. 路径沙箱
5. 命令超时
6. 最大轮数
7. 重试与指数退避
8. 上下文预算
9. 工具结果截断
10. session 状态
11. trace 日志
12. 人工确认门
13. 终止原因
14. 评测接口

**核心认识：** 模型能力只决定“会不会想”；Harness 决定“能不能安全、稳定、可观测地做”。

---

# 第三阶段：先评测，再谈微调

## 课 7：建立 20 条 Agent 基线评测

**Objective:** 用数据回答“改 Prompt、改 Harness 或微调后到底有没有变好”。

**评测文件：** `evals/cases.jsonl`

**每条案例字段：**

```json
{
  "id": "read-goal-001",
  "category": "file_read",
  "prompt": "读取 README.md 中的 Goal，只返回该段内容。",
  "allowed_tools": ["read"],
  "expected_tool": "read",
  "must_contain": ["Goal"],
  "must_not_modify_files": true,
  "max_turns": 3
}
```

**至少覆盖：**

- 4 条无需工具
- 4 条单工具
- 4 条多步工具
- 4 条错误恢复
- 4 条安全拒绝

**指标：**

- 任务成功率
- 正确工具选择率
- 参数正确率
- 越权率
- 平均轮数
- 首 token/总耗时
- 输出 token 数
- 工具错误恢复率

**对比实验：**

1. 无工具 vs 有工具
2. 简短 system prompt vs 详细 system prompt
3. 仅 read 工具 vs 全部只读工具
4. 温度低 vs 默认
5. 原始输出 vs 加结构化约束

**进入训练的门槛：** 必须先保存基线结果；否则训练后无法判断提升还是退化。

---

# 第四阶段：微调基础和数据

## 课 8：Qwen3.8-27B QLoRA 可行性烟雾测试

**Objective:** 在 ≈24GB 显存的本机 GPU 上验证 `Qwen/Qwen3.8-27B` 能否完成“4-bit 加载 → 单个训练 step → 保存 adapter → 重新加载”，只判断技术可行性，不追求质量。

**WSL 项目目录：**

```text
~/ai-learning/qwen36-finetune
```

**训练源模型：**

```text
Qwen/Qwen3.8-27B
```

**与 Ollama 工件的区别：** `qwen3.8:27b` 用于推理；QLoRA 从 Hugging Face Transformers 兼容权重开始。

**第一道门：** 先验证当前 Transformers、PEFT、bitsandbytes 与 Qwen3.8 架构兼容，再下载完整权重。

**保守首跑参数：**

```text
4-bit NF4 + double quant
bf16 compute
gradient checkpointing = true
LoRA r=8, alpha=16, dropout=0.05
sequence length=128（通过后再到 256/512）
batch size=1
gradient accumulation=1
max_steps=1
seed=42
```

**停止条件：** 4-bit 模型无法稳定装入 24GB、单 step OOM、或 CPU/RAM offload 导致实验不可用时，记录失败边界并暂停正式训练，不伪造成功。

**验收：**

- 模型和 tokenizer 可加载；
- 单个训练 step 无 NaN；
- adapter 可保存并重新加载；
- 记录峰值显存、系统内存、耗时与完整包版本。

---

## 课 9：制作一份正确的小型 SFT 数据集

**Objective:** 学会数据质量、训练/验证隔离和数据泄漏，而不是盲目堆数量。

**数据文件：**

```text
training/data/train.jsonl
training/data/valid.jsonl
training/data/test.jsonl
```

**推荐 messages 格式：**

```json
{
  "messages": [
    {"role": "system", "content": "你是本地 AI 服务排障助手。"},
    {"role": "user", "content": "Ollama 拉模型时报 unexpected EOF。"},
    {"role": "assistant", "content": "现象：下载连接中断。\n判断：先确认 manifest 与 blob 状态。\n下一步：检查日志、网络和断点文件。"}
  ]
}
```

**规则：**

- 第一轮 100–300 条即可。
- 一条样本只教一个明确行为。
- 不把测试集内容改写后塞回训练集。
- 不直接接受 27B 自动生成的数据；必须人工抽查和去重。
- 保留 10% valid、10% test。
- 先做格式/长度/重复/空字段自动检查。

**不建议第一轮做的事：**

- 用几千条低质量合成数据。
- 混合代码、医疗、闲聊、工具轨迹等多个目标。
- 把模型错误答案也当训练答案。
- 只看训练 loss，不做独立评测。

---

## 课 10：Qwen3.8-27B 正式 QLoRA

**Objective:** 只有第 8 课可行性门通过后，才在 ≈24GB 显存的本机 GPU 上训练可复现的 Qwen3.8-27B 行为适配器。

**模型：**

```text
Qwen/Qwen3.8-27B
```

**训练顺序：**

1. 8 条样本 overfit，证明数据、chat template 和 loss 管线正确；
2. 100–300 条人工审查数据；
3. 从 sequence length 128/256 起步，只改变一个变量；
4. 保留 baseline、prompt-only 和 fine-tuned 三组结果；
5. 训练 loss 更低不等于 Harness 任务成功率更高。

**验收：**

- held-out test 优于原始 Qwen3.8-27B 基线；
- 非目标任务没有明显崩坏；
- adapter、tokenizer、训练配置和报告完整；
- 固定 seed 可复现；
- 显存与耗时处于本机可接受范围。

---

# 第五阶段：Agent 轨迹微调与重新接入 Harness

## 课 11：从普通 SFT 进阶到 Tool/Agent 轨迹

**Objective:** 训练模型更稳定地选择工具和生成参数，而不是让微调模型真正执行工具。

**轨迹最小结构：**

```text
system: 工具定义与规则
user: 任务
assistant: tool call(name + arguments)
tool: result
assistant: final answer
```

**先做的任务：**

- 在 read 与无需工具之间选择
- 正确给出相对路径参数
- 工具报错后修正一次
- 达成任务后停止，不无限调用

**数据来源：**

1. 人工写 20 条金标准。
2. 用 27B 生成候选轨迹。
3. 用 Harness 实际重放工具调用。
4. 只保留真实执行通过的轨迹。
5. 人工检查最终答案。

**关键原则：** 轨迹必须由真实工具执行验证；不能只看起来像成功。

---

## 课 12：服务微调模型并做 A/B 测试

**Objective:** 把微调结果重新接入同一套 Harness，公平对比。

**优先路径：**

1. WSL 中用 Transformers 加载 base + LoRA adapter 做离线评测。
2. 验证有效后再选择：
   - 合并模型并用 vLLM 暴露 OpenAI-compatible API；或
   - 合并 → 转 GGUF → 量化 → `ollama create`。
3. 在 Pi `models.json` 中新增 provider/model，不覆盖原来的 27B。

**A/B 组：**

- A：`qwen3.8:27b` Ollama，作为强基线/教师
- B：原始 Qwen3.8-27B
- C：Qwen3.8-27B + LoRA
- D：C + 改进 Harness/Prompt

**最终报告：**

```text
模型/adapter
数据版本与 hash
Harness 版本
Prompt 版本
任务成功率
工具选择率
越权率
平均轮数
平均耗时
峰值显存
失败案例分类
结论与下一轮假设
```

---

# 建议的 12 次实操节奏

| 次数 | 内容 | 用户应获得的能力 |
|---:|---|---|
| 1 | 模型 API 与术语 | 区分模型、Agent、Harness、训练 |
| 2 | Pi + Ollama | 能运行本地 Pi Agent |
| 3 | JSONL 事件 | 能画出 Agent loop |
| 4 | 自定义工具 | 理解 schema 与 executor |
| 5 | Pi SDK 最小 Harness | 能创建并观察会话 |
| 6 | 权限、超时、最大轮数 | 能控制 Agent 风险 |
| 7 | 20 条评测 | 能量化 Harness 质量 |
| 8 | 27B QLoRA 可行性门 | 验证本机训练边界 |
| 9 | 数据制作 | 避免泄漏与低质量数据 |
| 10 | 27B QLoRA | 完成正式训练或记录失败边界 |
| 11 | 工具轨迹 | 理解 Agent 行为微调 |
| 12 | 接回 Pi 并 A/B | 判断微调是否真正有价值 |

---

# 每课固定学习方法

每次只做一个可验证实验：

1. **先预测：** 用户先说预期会发生什么。
2. **再运行：** 保存命令、配置和真实输出。
3. **看 trace：** 不只看最后一句回答。
4. **制造一个失败：** 例如错误路径、超时、越界或坏参数。
5. **解释根因：** 用户用自己的话复述。
6. **最小修复：** 一次只改一个变量。
7. **做验收：** 用脚本或评测证明修复有效。
8. **写实验记录：** 结论、失败边界和下一步。

---

# 第一阶段完成标准

在开始微调前，用户应能独立回答：

- 模型为什么不能自己真正读取文件？
- tool schema 和 tool executor 有什么区别？
- Agent 为什么可能无限循环？
- Harness 如何限制路径、轮数、超时和输出长度？
- 为什么必须保存 trace？
- Prompt/Harness 改进与 fine-tuning 各解决什么问题？
- 为什么 Ollama 的 Q4 模型不能直接作为普通 QLoRA 训练底模？

若这些问题还不能解释，就继续 Harness 实验，不急着训练。

---

# 风险与取舍

1. **本地 27B Agent 速度有限：** 首次加载约几十秒，复杂多轮工具调用会慢；学习时先用小任务和 4K context。
2. **24GB 显存边界：** 27B 推理已接近显存上限；Pi 实验期间避免同时运行 ComfyUI 大模型。
3. **WSL/宿主可用内存因机器而异：** 4B QLoRA 足够，27B 训练不作为初学路线。
4. **Pi 无默认权限弹窗：** 第一阶段只启用只读工具，在隔离项目中运行。
5. **微调不保证 Agent 更好：** 数据、评测和 Harness 往往比第一次 LoRA 更重要。
6. **版本变化：** Pi、Transformers 和 Qwen 系列支持变化较快；每次安装必须锁版本并记录。
7. **单一 Ollama 服务：** Windows Ollama 已更新到 0.32.12；不在 WSL 重复安装 Ollama，避免模型重复占盘和 11434 端口冲突。

---

# 下一步执行入口

从“课 1 + 课 2”开始，实际完成以下交付物：

1. 建立 WSL 原生隔离工作区 `<repo-root>`。
2. 写入 `README.md`、`AGENTS.md` 和术语笔记模板。
3. 安装并验证 Pi 0.84.4。
4. 备份后写入 Pi 的 Ollama provider 配置。
5. 用 `qwen3.8:27b` 完成一次只读工具调用。
6. 保存 JSONL trace。
7. 用户根据真实 trace 画出第一张 Agent loop。

完成这七项后再进入自定义工具，不提前进入微调。