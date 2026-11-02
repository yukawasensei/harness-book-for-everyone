# WSL 学习环境

## 默认交互终端

- Shell：Zsh (`/usr/bin/zsh`)
- Node 版本管理器：FNM 1.39.0
- Node：v22.22.1
- npm：10.9.4
- Pi：1.4.0

用户在 WSL 终端中运行课程命令时，使用 Zsh/FNM 环境。项目根目录的 `.nvmrc` 同样可被 FNM 用于固定 Node 版本。

## 运行边界

- Harness、Node、npm、tsx、Pi SDK、测试和 trace 分析全部运行在 WSL2 Ubuntu。
- Windows 侧只运行 Ollama、NVIDIA 驱动等宿主服务，不运行 Harness。
- 自动化助手必须通过 `wsl.exe -d Ubuntu-24.04 -- ...` 进入 WSL 后再执行课程命令。

## 自动化 Bash 环境

自动化助手通过 `wsl.exe -e bash -lc` 执行自动检查时使用 NVM；Bash 和 Zsh 的全局 npm 目录相互独立。因此需要在用户交互终端使用的全局 CLI，应确认它已安装在 FNM Node 环境中。

## Ollama

Ollama 只安装在 Windows，WSL 通过以下地址访问：

```text
http://127.0.0.1:11434
http://127.0.0.1:11434/v1
```

不要在 WSL 重复安装 Ollama。
