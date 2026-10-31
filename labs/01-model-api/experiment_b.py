#!/usr/bin/env python3
"""第一课·实验 B：由 Python 读取 README，再把内容放进模型上下文。"""

from __future__ import annotations

import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = "http://127.0.0.1:11434/api/generate"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
README = PROJECT_ROOT / "README.md"
OUTPUT = Path(__file__).with_name("experiment-b-context-injection.json")

# 关键步骤：读取文件的是 Python，不是 Qwen3.8。
readme_text = README.read_text(encoding="utf-8")

payload = {
    "model": "qwen3.8:27b",
    "prompt": (
        "下面是一个 README.md 的完整文本。请只根据这段文本，"
        "准确复述其中 Goal 段落的内容。\n\n"
        "--- README START ---\n"
        f"{readme_text}"
        "--- README END ---"
    ),
    "stream": False,
    "think": False,
    "keep_alive": "2m",
    "options": {
        "num_ctx": 4096,
        "num_predict": 256,
        "temperature": 0,
    },
}

request = urllib.request.Request(
    URL,
    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)

started = time.perf_counter()
with urllib.request.urlopen(request, timeout=600) as response:
    result = json.load(response)
elapsed = time.perf_counter() - started

record = {
    "experiment": "B: Python reads file and injects text into model context",
    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    "url": URL,
    "file_read_by": "Python host program",
    "readme_path": str(README),
    "readme_characters": len(readme_text),
    "request": payload,
    "response": result,
    "elapsed_seconds": round(elapsed, 3),
}
OUTPUT.write_text(
    json.dumps(record, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

print("=== 实验 B ===")
print(f"Python 读取文件：{README}")
print(f"注入上下文字符数：{len(readme_text)}")
print("真正访问文件的组件：Python host program")
print(f"模型回答：{result.get('response', '')}")
print(f"总耗时：{elapsed:.2f} 秒")
print(f"记录文件：{OUTPUT}")
