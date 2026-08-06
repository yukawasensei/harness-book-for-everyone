#!/usr/bin/env python3
"""第一课·实验 A：模型没有文件工具时，能否读取本机 README.md？"""

from __future__ import annotations

import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = "http://127.0.0.1:11434/api/generate"
OUTPUT = Path(__file__).with_name("experiment-a-no-tool.json")

payload = {
    "model": "qwen3.6:27b",
    "prompt": (
        "请读取文件 <repo-root>/README.md，"
        "然后准确告诉我其中 Goal 段落的内容。不要猜测。"
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
    "experiment": "A: bare Ollama model, no file content, no tools",
    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    "url": URL,
    "request": payload,
    "response": result,
    "elapsed_seconds": round(elapsed, 3),
}
OUTPUT.write_text(
    json.dumps(record, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

print("=== 实验 A ===")
print("模型没有收到文件内容，也没有 read 工具。")
print(f"模型回答：{result.get('response', '')}")
print(f"总耗时：{elapsed:.2f} 秒")
print(f"记录文件：{OUTPUT}")
