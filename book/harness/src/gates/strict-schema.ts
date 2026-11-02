import type { Tool } from "@earendil-works/pi-ai";
import { Value } from "typebox/value";
import type { TraceRow } from "../trace.js";

export function rejectInvalidArguments(
  tool: Tool, toolCallId: string, rawArgs: unknown, writeTrace: (row: TraceRow) => void,
): { block: true; reason: string } | undefined {
  // Value.Errors checks the original value; unlike the SDK validator it never coerces it.
  const errors = Value.Errors(tool.parameters, rawArgs);
  if (errors.length === 0) return undefined;
  const reason = `Harness schema validation: ${errors.map(error => `${error.instancePath || "/"}: ${error.message}`).join("; ")}. No execution or type coercion allowed. Retry with arguments matching the declared schema.`;
  writeTrace({ timestamp: new Date().toISOString(), eventType: "schema_validation_rejected",
    toolName: tool.name, toolCallId, args: rawArgs, reason });
  return { block: true, reason };
}
