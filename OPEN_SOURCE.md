# Open source prep checklist

本仓库面向公开分享的 **Agent Harness PM 课程**。发布前请确认：

## 已处理（本轮）

- [x] 根 README 改为公开课入口（中英）
- [x] 文档中的 `/home/<user>/...`、`C:\\Users\\...` 换成 `<repo-root>` / `~/ai-learning/pi-qwen-harness` / `workspaceRoot`
- [x] 去掉助教/内部代号口吻中的私有称呼（改为 generic facilitator）
- [x] 本机 GPU 型号与用户名从公开课表中泛化
- [x] 课 11–13 图解改为 **中英文配套**
- [x] 课 01–10 图解回填为 **中英文配套**
- [x] 根目录 `LICENSE`（MIT，2026，pi-qwen-harness contributors）
- [x] committed eval traces 中的绝对 `workspaceRoot` 改为相对/占位

## 待 PM 拍板

1. **QLoRA / 正式训练课**（course-plan 课 8–10）：**保留在公开课表**；硬件表述用「example local GPU ≈24GB VRAM」等泛化措辞，不写具体显卡型号与私人家目录。
2. **历史 JSONL 样本**（`labs/**/*.jsonl`）：内含当时机器的 `cwd` 绝对路径。  
   - 选项 A：批量替换后保留作教学回放；B：移出 git，改用 scrubbed fixture。
3. **时间戳 baseline 副本**：已 `.gitignore` `baseline-20*.json`，只跟踪 `baseline-latest.json`。
4. **远程与可见性**：已选 **MIT**（见根目录 `LICENSE`，copyright 2026 pi-qwen-harness contributors）。尚无 `git remote`；公开前再定 GitHub 可见性。

## 本地不要提交

- 含真实密钥、cookie、SSH、浏览器配置的任何文件  
- 公司产品名、内部代号、私人邮箱  
- `/home/<yourname>/...` 绝对路径（用 `<repo-root>`）
