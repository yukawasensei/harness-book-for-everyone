# 织影 Reelloom 网页（`book/build/web`）

React 19 + Vite 7 + Tailwind v4 + shadcn/ui + TanStack Query v5。

## 目录

```
src/
  main.tsx
  app/                 App、providers、AppShell、DesignPreview
  components/ui/       shadcn 原语（无业务）
  components/common/   BrandMark、TechnicalDetails
  features/
    sessions/          会话列表、项目选择
    chat/              时间线、Composer、空状态与各类消息卡
    artifacts/         阶段导航、产物预览、审阅/返工/评分
    auth/              TokenGate、配置
                       各含 components/ hooks/ lib/ index.ts
  lib/api/             client、endpoints、sse、sse-cache、query-keys
  lib/format/          中文日期、校验错误翻译
  lib/utils.ts         cn 等
  styles/              globals.css（design token）
```

设计约定见同目录 `DESIGN.md`。

## 约定

- 跨 feature 只经对方 `index.ts`。
- `components/ui` 不引用 features；`lib` 不引用 React / UI / features。
- 共享类型从 `@server/…`、`@contracts` 等导入，不在前端重复定义。
- 路径别名与 Vite `resolve.alias` / `web/tsconfig` paths 一致：
  - `@/` → `web/src`
  - `@server/`、`@contracts`、`@workflow`、`@project/` → `book/build/src/…`
- ESLint（`npm run lint`，配置在 `book/build/eslint.config.js`）：
  - `max-lines`：单文件 ≤200 行（跳过空行与注释）
  - `no-restricted-imports`：禁止跨 feature 深路径；`components/ui` 禁 features；`lib` 禁 React/UI/features

## 测试如何解析 `@/`

`npm test`（在 `book/build/`）为：

```bash
tsx --tsconfig ./web/tsconfig.json --import ./scripts/register-web-aliases.mjs --test src/*.test.ts
```

`register-web-aliases.mjs` 注册 Node resolve hook（`scripts/web-alias-hooks.mjs`），把 `@/` 等别名解析到与 Vite 相同的目录。**不要**为迁就 node:test 把导入改回相对路径。

## 数据流

1. 查询：`lib/api/endpoints` + feature hooks（Query）。
2. 实时：单一 `connectProject` SSE；`applyProjectEvent` 写 `setQueryData` / `invalidate`。
3. 发消息：`POST .../messages`（确定性路由）；产物侧仍可走阶段 run / 审阅等既有接口。

## 新增组件

1. UI 原语：`npx shadcn@latest add <name>`（`components.json` 已配），同步更新 `DESIGN.md`。
2. 业务：放对应 feature，经 `index.ts` 导出。

## 命令

在 `book/build/`：

```bash
npm run dev:web    # 5173
npm run lint
npm run typecheck
npm run build
npm test
```
