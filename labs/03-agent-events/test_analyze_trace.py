import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze_trace import summarize_trace


class TraceSummaryTests(unittest.TestCase):
    def test_summarizes_one_successful_tool_loop(self):
        events = [
            {"type": "turn_start"},
            {"type": "message_end", "message": {"role": "user", "content": [{"type": "text", "text": "read it"}]}},
            {"type": "message_end", "message": {"role": "assistant", "content": [{"type": "toolCall", "id": "call_1", "name": "read", "arguments": {"path": "README.md"}}]}},
            {"type": "tool_execution_start", "toolCallId": "call_1", "toolName": "read", "args": {"path": "README.md"}},
            {"type": "tool_execution_end", "toolCallId": "call_1", "toolName": "read", "isError": False, "result": {"content": [{"type": "text", "text": "goal"}]}},
            {"type": "message_end", "message": {"role": "toolResult", "content": [{"type": "text", "text": "goal"}]}},
            {"type": "turn_start"},
            {"type": "message_end", "message": {"role": "assistant", "content": [{"type": "text", "text": "final answer"}]}},
            {"type": "agent_end"},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "trace.jsonl"
            path.write_text("\n".join(json.dumps(e) for e in events) + "\n", encoding="utf-8")
            summary = summarize_trace(path)

        self.assertEqual(summary["event_count"], 9)
        self.assertEqual(summary["turn_count"], 2)
        self.assertEqual(summary["message_roles"], ["user", "assistant", "toolResult", "assistant"])
        self.assertEqual(summary["tool_calls"], [{
            "tool_call_id": "call_1",
            "tool_name": "read",
            "args": {"path": "README.md"},
            "is_error": False,
        }])
        self.assertEqual(summary["final_text"], "final answer")
        self.assertTrue(summary["agent_ended"])


if __name__ == "__main__":
    unittest.main()
