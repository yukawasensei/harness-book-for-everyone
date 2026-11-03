# 四阶段评测维护 / Four-stage eval maintenance

所有命令在 `book/build` 执行。`cases.json` 覆盖 story、script、bible、board，每阶段一个固定上游 case；逐 case 独立建项、保留真实工具事件，不代表一条连续创作的质量测试。

```sh
npm test
npm run typecheck
npm run lint
npm run build
EVAL_FAKE=1 npm run eval -- --repeat 2
npm run context:compare
```

`npm test` 同时执行 `src/*.test.ts` 与 `web/tests/*.test.tsx`，后者原有 8 项纳入默认入口；网页测试也纳入网页 typecheck。SSR 与协议断言不代表浏览器视觉验收。

fake 的四 cases × 两次产生八份观察，每份保留 stop_reason、工具拒绝、usage 和 session trace；token 为合成值。fake 只签结构机制，人工评分独立见 [rubric.md](./rubric.md)，不参与结构放行。上下文脚本只描述当前 board 输入/保存及按场提交的静态字符估算，不支持成本收益结论；设定原文可进入 board 模型上下文。

## 基线 / Baselines

- 当前系列：`reelloom-4stage-v1`，基线路径 `evals/baselines/4stage-v1.json`。文件未建立时输出「无同系列基线」与 `STRUCTURE ONLY`，失败输出 `BLOCKED`。
- `evals/baseline.json` 是六阶段历史签收，旧 `evals/runs/**` 是历史观察；原样保留，不参与当前系列比较。旧 fixtures/sample 中的六阶段文件仅保留供历史查阅，当前 cases、fake 和上下文入口只读取四阶段文件。
- 更新只允许真实 `ollama/qwen3.8:27b`、全量、repeat=1、全部正常完成且无 removed/regressed。fake、其他模型、重复评测、CASES 选择均无权更新；已有基线的模型、流水线、真实运行标记、单轮完整观察和 case 配置须匹配，否则落盘前拒绝。改变 case 口径须显式建立新系列。
- 在已获真实运行授权后执行下面命令一次；失败保留观察和原基线，不自动补跑。普通 eval 不修改基线。真实结构签收也不代表质量或成本已由人工签收。

```sh
UPDATE_BASELINE=1 EVAL_FAKE=0 MODEL_ID=ollama/qwen3.8:27b \
  NO_PROXY=127.0.0.1,localhost npm run eval -- --repeat 1
```

输出位于忽略的 `evals/runs/local/<model>/<run-id>/`，含逐次 JSON、summary、report 和项目 sessions/staging。只创建自有评测项目，不触碰 `projects/` 的用户作品；旧数据无 format_version 或为五阶段过渡格式时拒读，最终项目只接受 `format_version: 2`。

## 后续核对 / Follow-up verification

- R3：用 ego 验证四工序界面、每次采用只开始下一道、board 采用后结束、引用拒绝与修正、只重交 S02、外观换版后的 stale/零模型拼装/人工采用，以及指定历史 board 的复制与 Markdown 导出；记录视口、截图和真实服务结果。
- R4：统一根与第二篇 README、网页说明和八章加附录；核对源码路径、四阶段案例、评分指标、当前基线实测结论与新截图。每章共用最终代码；历史 p2-* 标签不删除或移动。旧六阶段基线、旧逐镜上下文数据不能作为四阶段收益证明。

本清单是维护入口；浏览器验收、截图与章节修改另行完成，后端离线检查通过不代表这些工作已验收。
