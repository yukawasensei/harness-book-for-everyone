/**
 * Demo tool that sleeps — used to prove harness-level TOOL_TIMEOUT_MS.
 * Not a product tool; exists so evals can force a long-running executor.
 */
import { Type } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { sleep, ToolTimeoutError, withToolTimeout } from "./tool-timeout.js";

export interface SlowToolOptions {
  /** Harness hard timeout in ms; 0 = disabled. */
  timeoutMs: number;
  /** Called when the harness timeout fires (before the error propagates). */
  onTimeout?: (timeoutMs: number) => void;
}

export function createSlowTool(options: SlowToolOptions) {
  const { timeoutMs, onTimeout } = options;

  return defineTool({
    name: "slow",
    label: "Slow",
    description:
      "Sleep for a given number of milliseconds, then return. Used to demonstrate harness tool timeouts.",
    promptSnippet: "Sleep for N milliseconds (demo timeout tool)",
    promptGuidelines: [
      "Call slow when asked to wait or sleep for a duration in milliseconds.",
      "Pass delay_ms as an integer milliseconds value.",
    ],
    parameters: Type.Object({
      delay_ms: Type.Integer({
        description: "How long to sleep, in milliseconds",
        minimum: 0,
      }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      try {
        await withToolTimeout(sleep(params.delay_ms, signal), timeoutMs, signal);
        return {
          content: [
            {
              type: "text" as const,
              text: `slept ${params.delay_ms}ms (timeoutMs=${timeoutMs || "off"})`,
            },
          ],
          details: { delay_ms: params.delay_ms, timedOut: false },
        };
      } catch (error) {
        if (error instanceof ToolTimeoutError) {
          onTimeout?.(error.timeoutMs);
          // Throw so pi marks tool_execution_end.isError=true
          throw error;
        }
        throw error;
      }
    },
  });
}
