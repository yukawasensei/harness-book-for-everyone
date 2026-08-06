#!/usr/bin/env python3
"""Extract a concise learning timeline from a Pi JSONL trace."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load_events(path: Path) -> list[tuple[int, dict[str, Any]]]:
    events: list[tuple[int, dict[str, Any]]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            events.append((line_number, json.loads(line)))
    return events


def _text_from_content(content: Any) -> str:
    if not isinstance(content, list):
        return ""
    return "\n".join(
        part.get("text", "")
        for part in content
        if isinstance(part, dict) and part.get("type") == "text"
    )


def summarize_trace(path: Path) -> dict[str, Any]:
    events = load_events(path)
    message_roles: list[str] = []
    starts: dict[str, dict[str, Any]] = {}
    tool_calls: list[dict[str, Any]] = []
    timeline: list[dict[str, Any]] = []
    final_text = ""

    for line_number, event in events:
        event_type = event.get("type")

        if event_type == "message_end":
            message = event.get("message") or {}
            role = message.get("role")
            if role:
                message_roles.append(role)
                item: dict[str, Any] = {
                    "line": line_number,
                    "type": event_type,
                    "role": role,
                }
                content = message.get("content")
                if role == "assistant" and isinstance(content, list):
                    tool_part = next(
                        (part for part in content if isinstance(part, dict) and part.get("type") == "toolCall"),
                        None,
                    )
                    if tool_part:
                        item.update({
                            "tool_name": tool_part.get("name"),
                            "tool_call_id": tool_part.get("id"),
                            "args": tool_part.get("arguments"),
                        })
                    text = _text_from_content(content)
                    if text:
                        final_text = text
                        item["text"] = text
                timeline.append(item)

        elif event_type == "tool_execution_start":
            tool_call_id = event.get("toolCallId")
            starts[tool_call_id] = event
            timeline.append({
                "line": line_number,
                "type": event_type,
                "tool_name": event.get("toolName"),
                "tool_call_id": tool_call_id,
                "args": event.get("args"),
            })

        elif event_type == "tool_execution_end":
            tool_call_id = event.get("toolCallId")
            start = starts.get(tool_call_id, {})
            tool_calls.append({
                "tool_call_id": tool_call_id,
                "tool_name": event.get("toolName") or start.get("toolName"),
                "args": start.get("args"),
                "is_error": event.get("isError"),
            })
            timeline.append({
                "line": line_number,
                "type": event_type,
                "tool_name": event.get("toolName"),
                "tool_call_id": tool_call_id,
                "is_error": event.get("isError"),
            })

        elif event_type == "agent_end":
            timeline.append({"line": line_number, "type": event_type})

    return {
        "event_count": len(events),
        "turn_count": sum(1 for _, event in events if event.get("type") == "turn_start"),
        "message_roles": message_roles,
        "tool_calls": tool_calls,
        "final_text": final_text,
        "agent_ended": any(event.get("type") == "agent_end" for _, event in events),
        "timeline": timeline,
    }


def render_summary(path: Path, summary: dict[str, Any]) -> str:
    lines = [
        f"Trace: {path}",
        f"Events: {summary['event_count']}",
        f"Turns: {summary['turn_count']}",
        "Message roles: " + " -> ".join(summary["message_roles"]),
        "Timeline:",
    ]
    for item in summary["timeline"]:
        detail = f"line {item['line']}: {item['type']}"
        if item.get("role"):
            detail += f" role={item['role']}"
        if item.get("tool_name"):
            detail += f" tool={item['tool_name']}"
        if item.get("tool_call_id"):
            detail += f" id={item['tool_call_id']}"
        if "is_error" in item:
            detail += f" isError={item['is_error']}"
        if item.get("args") is not None:
            detail += " args=" + json.dumps(item["args"], ensure_ascii=False)
        lines.append("  " + detail)
    lines.append("Final answer: " + summary["final_text"])
    lines.append("Agent ended: " + str(summary["agent_ended"]))
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("trace", type=Path, help="Pi JSONL trace path")
    args = parser.parse_args()
    summary = summarize_trace(args.trace)
    print(render_summary(args.trace, summary))


if __name__ == "__main__":
    main()
