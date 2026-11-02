import type { TraceRow } from "../trace.js";
import { extname } from "node:path";
import { createRequire } from "node:module";

// Pinned direct dependency, used only for positions omitted by V8;
// native JSON.parse above remains the authority for accepting a write.
const diagnosticParser = createRequire(import.meta.url)("json-bigint")() as { parse(text: string): unknown };

export function rejectInvalidJsonWrite(
  toolName: string, toolCallId: string, rawArgs: unknown, writeTrace: (row: TraceRow) => void,
): { block: true; reason: string } | undefined {
  const args = rawArgs as Record<string, unknown> | undefined;
  if (toolName !== "write" || !args || typeof args.path !== "string" ||
    extname(args.path).toLowerCase() !== ".json" || typeof args.content !== "string") return undefined;
  try {
    JSON.parse(args.content);
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const position = /position (\d+)/.exec(message);
    let offset = position ? Number(position[1]) : args.content.length;
    if (!position) {
      try { diagnosticParser.parse(args.content); }
      catch (diagnostic) {
        const at = (diagnostic as { at?: number }).at;
        if (typeof at === "number") offset = Math.min(args.content.length, Math.max(0, at - 1));
      }
    }
    const prefix = args.content.slice(0, offset).split("\n");
    const line = prefix.length;
    const column = prefix.at(-1)!.length + 1;
    const reason = `Harness JSON validation: line ${line}, column ${column}: ${message}. File was not written. Retry write with valid JSON, escaping embedded quotes.`;
    writeTrace({ timestamp: new Date().toISOString(), eventType: "json_write_rejected",
      toolName, toolCallId, path: args.path, line, column, reason });
    return { block: true, reason };
  }
}
