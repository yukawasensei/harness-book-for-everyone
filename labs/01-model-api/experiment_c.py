#!/usr/bin/env python3
"""第一课·实验 C：Qwen3.8 通过 Pi Harness 的 read 工具读取文件。"""

from __future__ import annotations

import json
import shutil
import subprocess
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(__file__).with_name("experiment-c-agent-read.jsonl")

pi_path = shutil.which("pi")
if not pi_path:
    raise SystemExit("找不到 pi 命令。请确认 WSL 登录 shell 已加载 NVM。")

command = [
    pi_path,
    "--provider",
    "ollama",
    "--model",
    "qwen3.8:27b",
    "--tools",
    "read",
    "--mode",
    "json",
    "--no-session",
    "--approve",
    "必须使用 read 工具读取 README.md，然后准确复述 Goal。不要根据已有上下文猜测。",
]

completed = subprocess.run(
    command,
    cwd=PROJECT_ROOT,
    text=True,
    encoding="utf-8",
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    timeout=600,
    check=False,
)
OUTPUT.write_text(completed.stdout, encoding="utf-8")

if completed.returncode != 0:
    print(completed.stderr)
    raise SystemExit(f"Pi 退出码：{completed.returncode}")

events = []
for line_number, line in enumerate(completed.stdout.splitlines(), start=1):
    if not line.strip():
        continue
    try:
        events.append(json.loads(line))
    except json.JSONDecodeError as error:
        print(f"警告：第 {line_number} 行不是有效 JSON：{error}")

counts = Counter(event.get("type", "unknown") for event in events)
tool_events = [
    event
    for event in events
    if event.get("type") in {"tool_execution_start", "tool_execution_end"}
]


def text_blocks(value):
    """递归提取事件中的文本块，只用于显示最终回答。"""
    if isinstance(value, dict):
        if value.get("type") == "text" and isinstance(value.get("text"), str):
            yield value["text"]
        for child in value.values():
            yield from text_blocks(child)
    elif isinstance(value, list):
        for child in value:
            yield from text_blocks(child)


assistant_answers = []
for event in events:
    if event.get("type") != "message_end":
        continue
    message = event.get("message")
    if isinstance(message, dict) and message.get("role") == "assistant":
        texts = [text.strip() for text in text_blocks(message) if text.strip()]
        if texts:
            assistant_answers.append("\n".join(texts))

print("=== 实验 C ===")
print("README 内容没有预先放进用户请求。")
print("允许的工具：read")
print(f"Agent turn 数：{counts.get('turn_start', 0)}")
for event in tool_events:
    print(
        "工具事件：",
        event.get("type"),
        "tool=",
        event.get("toolName"),
        "isError=",
        event.get("isError"),
    )
print("真正访问文件的组件：Pi Harness 的 read 工具")
print("模型最终回答：")
print(assistant_answers[-1] if assistant_answers else "未提取到最终回答，请检查 JSONL trace。")
print(f"完整事件记录：{OUTPUT}")
