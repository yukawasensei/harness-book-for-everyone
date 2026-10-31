/**
 * Custom `read` tool that enforces workspace path sandbox before any I/O.
 * Replaces the built-in read when registered via createAgentSession customTools
 * (same name overrides builtin in pi-coding-agent AgentSession registry).
 */
import { readFile } from "node:fs/promises";
import { Type } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { PathSandboxError, assertInsideWorkspace } from "./path-sandbox.js";

export interface SandboxedReadOptions {
  workspaceRoot: string;
  /** Called when the harness denies a path (before the error propagates). */
  onDenied?: (info: {
    requestedPath: string;
    resolvedPath: string;
    workspaceRoot: string;
  }) => void;
}

export function createSandboxedReadTool(options: SandboxedReadOptions) {
  const { workspaceRoot, onDenied } = options;

  return defineTool({
    name: "read",
    label: "Read",
    description:
      "Read the contents of a text file inside the workspace. Paths outside the workspace root are denied by the harness.",
    promptSnippet: "Read a file inside the workspace",
    promptGuidelines: [
      "Use read to examine files instead of cat or sed.",
      "Only paths inside the current workspace are allowed; escapes are denied.",
    ],
    parameters: Type.Object({
      path: Type.String({
        description: "Path to the file to read (relative or absolute)",
      }),
    }),
    async execute(_toolCallId, params) {
      const requestedPath = params.path;
      let absolutePath: string;
      try {
        absolutePath = assertInsideWorkspace(workspaceRoot, requestedPath);
      } catch (error) {
        if (error instanceof PathSandboxError) {
          onDenied?.({
            requestedPath: error.requestedPath,
            resolvedPath: error.resolvedPath,
            workspaceRoot: error.workspaceRoot,
          });
        }
        throw error;
      }

      try {
        const text = await readFile(absolutePath, "utf8");
        return {
          content: [{ type: "text" as const, text }],
          details: {
            path: requestedPath,
            absolutePath,
            sandboxed: true,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read ${requestedPath}: ${message}`);
      }
    },
  });
}
