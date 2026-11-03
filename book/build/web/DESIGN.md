# 织影 Reelloom · 设计系统

## Token（`styles/globals.css`）

| Token | 用途 |
|---|---|
| background / foreground | 页面底与正文 |
| card / card-foreground / muted / muted-foreground | 卡片与次要文案 |
| popover / popover-foreground | 浮层 |
| border / input / ring | 边框、表单、焦点环 |
| primary / primary-foreground | 主操作（绿系 oklch） |
| secondary / accent（及 *-foreground） | 次要面与高亮 |
| destructive / success / warning / info | 状态语义 |
| model / injected（及 *-foreground） | 提示词：模型部分（蓝）/ 程序注入（绿） |
| radius-sm/md/lg/xl | 圆角刻度 |
| font-sans / font-mono | 正文字体 / 等宽 |

Light + dark 跟随 `prefers-color-scheme`（另有 `.dark` 变体钩子）。组件内只用 Tailwind token 类，不写十六进制、不写 inline style、不写散落自定义 CSS 类。

产物预览保留可读结构类名（样式仍走 token）：`.prompt-card`、`.prompt-card.scene-revised`、`.prompt-model`、`.prompt-injected`。

## 字体

`system-ui` + `"Noto Sans SC"` / PingFang / Microsoft YaHei 回退；等宽用于 ID / JSON。

## 原语（`components/ui`）

button、card、badge、dialog、alert-dialog、dropdown-menu、tabs、tooltip、popover、textarea、input、scroll-area、sheet、collapsible、separator、skeleton、sonner、switch。

- 交互容器优先用这些原语；变体用 `cva`。
- 一文件一组件，单文件必须 ≤200 行（ESLint `max-lines`）。
- 图标只用 `lucide-react`，禁止 emoji 当图标。

## 文案语气

大白话中文；不露英文字段名；错误与校验经 `lib/format` 中文化；语气克制，不夸张、不喊口号、不用感叹号。

## 业务组件

路径：`features/chat` 时间线卡片；`features/artifacts` 右栏产物；`features/sessions` 会话列表。跨 feature 只经对方 `index.ts`。

1. **EmptyState（空状态）**：居中引导；标题「你想拍一部什么样的短片？」；内嵌 Composer；三张示例（深空孤舰、老钟表店、雨夜古渡）；底注六阶段交稿说明。
2. **PlanCard（计划卡，已废弃删除）**：v2 全面重构为四道工序（故事 → 剧本 → 设定集 → 分镜板），工序进度与状态统一收敛至顶部/右栏 StageNav 与对话流交稿卡，废弃旧版六工序纵向计划卡。
3. **ReviewCard（交稿卡）**：时间线内交稿摘要 +「查看并审阅」；签字只在右栏 ReviewPanel。
4. **ToolCallCard（工具调用卡）**：工具中文名；running / success / error；折叠参数与结果。
5. **SystemNotice（系统提示卡）**：error / quota / stale / info 四型；可选操作按钮。
6. **RunStatusBar（运行状态条）**：「正在写{阶段}…」+ 可选「中断」。
7. **StageNav（阶段导航）**：四阶段纵列；状态点（success / primary / warning / 灰）；标注当前与「下一步」。
8. **ArtifactPreview（产物预览）与 BoardPreview（分镜板）**：按阶段结构化渲染；强制换行防横向滚动。分镜板按场分组，展示场次小标题（场号、地点、时间）、镜号、景别、运镜、动作与画面、对白与声音、时长、设定引用名称与等宽 ID；画面提示词分蓝色镜头描写（model）与绿色设定注入（injected），配图例与单镜复制；顶部支持 Markdown 导出；待更新状态下提供黄色横幅与零模型重新拼装。
9. **RunSummaryCard（运行摘要）**：当前/最近运行文案、开始时间、耗时与用量、错误明细。

相关配套（非上列九卡）：SessionList、Composer、VersionPicker、MoreActionsMenu、ReviewPanel、RatingDialog / RatingPanel。

## 预览

开发态打开 `?design` 或 `#/design` 审阅基础原语与业务卡片状态（见 `app/DesignPreview`）。
