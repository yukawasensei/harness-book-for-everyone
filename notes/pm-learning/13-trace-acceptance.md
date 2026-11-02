> **旧版参考资料**：已并入第 6 章（[ch06](../../book/harness/chapters/ch06.md)）。

# 13 · Trace 作为验收证据

> 视角：产品经理（PM）· 图解 + 费曼  
> 日期：2026-10-31（Asia/Shanghai）  
> 对照：课 [06 · 可观测](./06-observability-trace.md)（什么是 Trace）· [07 · 评测与验收](./07-evals-acceptance.md)（为什么要 cases）· [11](./11-hard-boundaries.md)/[12](./12-path-sandbox.md)（闸门已落地）  
> 本课不重复「怎么记事件」——只教 **如何用已有 baseline / stop_reason 签字放行**

## 一句话定义

**Trace 作为验收证据**：Harness 改动算「做完」，不是因为模型口头更听话，而是因为 `baseline-latest.json`（及对应 JSONL）里出现了**可核对的** `stop_reason` / 工具名——与期望闸门一一对应。

## 图解

> 配图：**中英文配套**（CN + EN labels）。

![Trace as Acceptance Evidence](./assets/harness-trace-acceptance.jpg)

```mermaid
flowchart LR
  subgraph gates [Harness gates]
    A[maxTurns]
    B[tool timeout]
    C[allowlist]
    D[path sandbox]
  end
  subgraph evidence [Acceptance evidence]
    E["baseline-latest.json"]
    F["stop_reason + toolNames"]
  end
  subgraph signoff [PM sign-off]
    G["pass == total"]
    H["each gate matched"]
    I["happy path still green"]
  end
  gates --> E --> F --> signoff
```

## 要点

1. **课 06 教「看见」；本课教「签字」**：JSONL 是原料；`stop_reason` + case 期望才是验收条款。  
2. **四道闸门 → 四类证据**（当前 live 基线）：

| 闸门 | Case id | 期望证据 |
|---|---|---|
| 轮数刹车 | `max-turns-brake` | `stop_reason=max_turns` |
| 工具超时 | `tool-timeout-brake` | `stop_reason=tool_timeout` |
| 工具白名单 | `allowlist-no-bash` | toolNames 不含 bash/write/edit |
| 路径沙箱 | `path-escape-denied` | `stop_reason=path_denied` |
| 回归底线 | `read-lesson-input` | `stop_reason=success` 且调用了 `read` |

3. **读报表，不读长 Trace 全文**：先看 `passCount/total`，再逐行对 `summary.stopReason` / `toolNames`；只有 FAIL 才下钻 `results/traces/<id>.jsonl`。  
4. **模型文案不是证据**：对用户可以说「被护栏拦住了」；对发布清单只能勾「case 绿了」。  
5. **轻量工具**：`npm run eval:report` 把 baseline 打成 PM 摘要表——验收会议投屏用这一页即可。

## 产品拍板 vs 工程师实现

| 维度 | 产品拍板 | 工程师实现 |
|---|---|---|
| 什么叫 Done | 哪几条 case 必须绿？允许哪些已知 FAIL？ | `cases.json` expect + `eval:live` 断言 |
| 证据粒度 | 只要汇总表？还是每次改动贴 JSON 片段？ | `baseline-latest.json` + `eval:report` |
| 失败叙事 | 对内：闸门生效；对外：温和拒绝文案 | `stop_reason` 枚举 → 客服话术表 |
| 回归节奏 | 每次护栏 PR 必跑？只跑子集？ | `EVAL_CASE_ID=…` / 全量 live |
| 公开课程 | 报告里可否出现本机绝对路径？ | baseline 只写相对 `labs/05-…` |

## 怎么读 baseline（签字清单）

在 `labs/06-evals`：

```bash
# 已有基线时，不必重跑 live
npm run eval:report

# 护栏改动后重跑（需本地 Ollama）
NO_PROXY=127.0.0.1,localhost npm run eval:live
npm run eval:report
```

签字前勾选：

- [ ] `passCount == total`（或已知例外已写进发布说明）  
- [ ] 每个闸门 case 的 `stop_reason` / 工具名符合上表  
- [ ] 快乐路径仍 `success`（没有「护栏一加，正常读文件也挂」）  
- [ ] 公开前 scrub：无私人路径、无产品品牌名  

## 对照工程

- 基线：`labs/06-evals/results/baseline-latest.json`  
- 报表：`labs/06-evals/src/report-baseline.mjs` → `npm run eval:report`  
- 单条 Trace：`labs/06-evals/results/traces/<case-id>.jsonl`  
- 概念课：[06](./06-observability-trace.md) · 评测口径：[07](./07-evals-acceptance.md) · 闸门实现：[11](./11-hard-boundaries.md)、[12](./12-path-sandbox.md)

## 费曼题

**同事说「模型已经保证不会越权，可以上线了」。你作为 PM，要他出示哪三样证据才签字？**

### 参考答（自学用）

1. **基线汇总**：`baseline-latest.json`（或 `eval:report`）显示相关 case 全 PASS；  
2. **终止原因**：对应闸门出现 `path_denied` / `tool_timeout` / `max_turns` 等，而不是只靠模型道歉；  
3. **工具名审计**：allowlist case 的 `toolNames` 里没有越权工具，且快乐路径仍能 `read`。  
缺任一则仍是「感觉安全」，不是验收。

## 下一步

- 巩固：自己对着当前 baseline 走一遍签字清单；把费曼题讲给同伴。  
- 可选增量：把 `eval:report` 接进 CI 摘要；客服话术表按 `stop_reason` 枚举。  
- 上一课：[12 · 路径沙箱](./12-path-sandbox.md) · 路线总览：[README](./README.md)

- 下一课：[14 · 上下文预算](./14-context-budget.md)

