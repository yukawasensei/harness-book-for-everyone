# Open source prep checklist

本仓库面向公开分享的 **Agent Harness PM 课程**。发布前请确认：

## 已处理（本轮）

- [x] 根 README 改为公开课入口（中英）
- [x] 文档中的 `/home/<user>/...`、`C:\\Users\\...` 换成 `<repo-root>` / `~/ai-learning/pi-qwen-harness` / `workspaceRoot`
- [x] 去掉助教/内部代号口吻中的私有称呼（改为 generic facilitator）
- [x] 本机 GPU 型号与用户名从公开课表中泛化
- [x] 课 11–13 图解改为 **中英文配套**
- [x] committed eval traces 中的绝对 `workspaceRoot` 改为相对/占位

## 待 PM 拍板

1. **QLoRA / 正式训练课**（course-plan 课 8–10）：保留在公开课表，还是挪到未跟踪的 `notes/private-lab-hardware.md`？  
   - 公开版建议只保留「推理用 Ollama 量化模型 ≠ 可训练权重」概念，不写具体显卡型号与家目录训练路径。
2. **历史 JSONL 样本**（`labs/**/*.jsonl`）：内含当时机器的 `cwd` 绝对路径。  
   - 选项 A：批量替换后保留作教学回放；B：移出 git，改用 scrubbed fixture。
3. **时间戳 baseline 副本**（`labs/06-evals/results/baseline-20*.json`）：是否加入 `.gitignore`，只保留 `baseline-latest.json`？
4. **远程与 License**：尚无 `git remote`；公开前需选定 LICENSE（MIT/Apache-2.0 等）与 GitHub 可见性。

## 本地不要提交

- 含真实密钥、cookie、SSH、浏览器配置的任何文件  
- 公司产品名、内部代号、私人邮箱  
- `/home/<yourname>/...` 绝对路径（用 `<repo-root>`）
