#!/usr/bin/env python3
"""第二课：对比 --no-tools 与 --tools read。"""

from __future__ import annotations

import json
import shutil
import subprocess
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LAB_DIR = Path(__file__).resolve().parent
PROMPT = (
    "请读取 labs/02-pi-cli/tool-schema-target.txt，"
    "只返回 LESSON2_CODE 的值。若无法读取，明确说明无法读取，不要猜测。"
)


def text_blocks(value):
    if isinstance(value, dict):
        if value.get("type") == "text" and isinstance(value.get("text"), str):
            yield value["text"]
        for child in value.values():
            yield from text_blocks(child)
    elif isinstance(value, list):
        for child in value:
            yield from text_blocks(child)


def run_pi(label: str, tool_args: list[str], output_name: str) -> dict:
    pi_path = shutil.which("pi")
    if not pi_path:
        raise SystemExit("找不到 pi。请在 Zsh 中运行 rehash，或重新打开 WSL 终端。")

    command = [
        pi_path,
        "--provider",
        "ollama",
        "--model",
        "qwen3.8:27b",
        *tool_args,
        "--mode",
        "json",
        "--no-session",
        "--no-context-files",
        "--no-skills",
        "--no-extensions",
        "--no-prompt-templates",
        "--approve",
        PROMPT,
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
    output_path = LAB_DIR / output_name
    output_path.write_text(completed.stdout, encoding="utf-8")

    if completed.returncode != 0:
        print(completed.stderr)
        raise SystemExit(f"{label} 的 Pi 退出码：{completed.returncode}")

    events = [
        json.loads(line)
        for line in completed.stdout.splitlines()
        if line.strip()
    ]
    counts = Counter(event.get("type") for event in events)
    starts = [event for event in events if event.get("type") == "tool_execution_start"]
    ends = [event for event in events if event.get("type") == "tool_execution_end"]

    assistant_answers = []
    for event in events:
        if event.get("type") != "message_end":
            continue
        message = event.get("message")
        if isinstance(message, dict) and message.get("role") == "assistant":
            texts = [text.strip() for text in text_blocks(message) if text.strip()]
            if texts:
                assistant_answers.append("\n".join(texts))

    return {
        "label": label,
        "turns": counts.get("turn_start", 0),
        "tool_starts": starts,
        "tool_ends": ends,
        "answer": assistant_answers[-1] if assistant_answers else "未提取到回答",
        "trace": output_path,
    }


def print_result(result: dict) -> None:
    print(f"\n=== {result['label']} ===")
    print(f"Agent turns：{result['turns']}")
    print(f"工具调用次数：{len(result['tool_starts'])}")
    for start in result["tool_starts"]:
        print(f"工具请求：name={start.get('toolName')} args={start.get('args')}")
    for end in result["tool_ends"]:
        print(f"工具结果：name={end.get('toolName')} isError={end.get('isError')}")
    print(f"模型最终回答：{result['answer']}")
    print(f"Trace：{result['trace']}")


print("第二课：同一模型、同一任务，只改变工具 allowlist。")
without_tools = run_pi("对照 A：--no-tools", ["--no-tools"], "lesson-02-no-tools.jsonl")
with_read = run_pi("对照 B：--tools read", ["--tools", "read"], "lesson-02-read-enabled.jsonl")
print_result(without_tools)
print_result(with_read)

print("\n=== 请观察唯一关键变量 ===")
print("A 没有任何 tool schema；B 只向模型提供 read schema。")
