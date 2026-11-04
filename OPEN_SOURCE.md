# Open source prep checklist

本仓库即公开课 **《写给大家看的 Harness 书》 / Harness Book for Everyone**。发布前请确认：

## 发布前检查

- [ ] 根 README 是公开课入口（中英），主线指向 `book/harness/`
- [ ] 文档与已提交 trace 中无本机绝对家目录；统一用 `<repo-root>` / `workspaceRoot`
- [ ] 无私人称呼、公司产品名、内部代号、私人邮箱
- [ ] 硬件与训练相关表述已泛化（例如「example local GPU ≈24GB VRAM」），不写具体显卡型号
- [ ] 图解为 **中英文配套**；资产在第一篇 `book/harness/assets/`、第二篇 `book/build/assets/`
- [ ] 根目录 `LICENSE`（MIT，copyright 年与 contributors 行正确）
- [ ] 密钥、cookie、SSH、浏览器配置等均未入库（`.env` 勿提交）
- [ ] 远程仓库可见性与发布渠道符合预期

## 本地不要提交

- 含真实密钥、cookie、SSH、浏览器配置的任何文件
- 公司产品名、内部代号、私人邮箱
- 本机绝对家目录路径（用 `<repo-root>` / `workspaceRoot`）

## Diagram style locked / 图解风格锁定

书稿配图（第一篇 `book/harness/assets/harness-*.jpg`、第二篇 `book/build/assets/reelloom-*.jpg`）统一为：

- 纯白底（`#FFFFFF`），禁止奶油/米黄/深色底
- 中英双语标签、16:9、扁平教材矢量
- 配方与提示词骨架：`skills/harness-diagram/SKILL.md`

新增或重绘图解前先读该 skill；替换文件时保持文件名不变。
