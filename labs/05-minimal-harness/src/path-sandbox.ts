/**
 * Workspace path sandbox — harness-level gate for file tools.
 * Public curriculum helper: resolve + reject escapes outside workspaceRoot.
 */
import { isAbsolute, relative, resolve, sep } from "node:path";
import { realpathSync } from "node:fs";

export class PathSandboxError extends Error {
  readonly code = "PATH_DENIED" as const;
  readonly requestedPath: string;
  readonly workspaceRoot: string;
  readonly resolvedPath: string;

  constructor(opts: {
    requestedPath: string;
    workspaceRoot: string;
    resolvedPath: string;
    message?: string;
  }) {
    super(
      opts.message
        ?? `Path denied: "${opts.requestedPath}" resolves outside workspace (${opts.workspaceRoot})`,
    );
    this.name = "PathSandboxError";
    this.requestedPath = opts.requestedPath;
    this.workspaceRoot = opts.workspaceRoot;
    this.resolvedPath = opts.resolvedPath;
  }
}

function realExistingPrefix(absolutePath: string): string {
  // Walk up until an existing ancestor can be realpath'd (handles not-yet-created leaves).
  let cursor = absolutePath;
  for (;;) {
    try {
      return realpathSync(cursor);
    } catch {
      const parent = resolve(cursor, "..");
      if (parent === cursor) {
        return absolutePath;
      }
      cursor = parent;
    }
  }
}

/**
 * Resolve requestedPath against workspaceRoot and ensure the result stays inside the workspace.
 * Rejects `..` climbs, absolute escapes, and symlink escapes (via realpath of existing prefix).
 * Returns the resolved absolute path (not necessarily realpath of the leaf if it does not exist).
 */
export function assertInsideWorkspace(
  workspaceRoot: string,
  requestedPath: string,
): string {
  if (typeof requestedPath !== "string" || requestedPath.trim().length === 0) {
    throw new PathSandboxError({
      requestedPath: String(requestedPath),
      workspaceRoot,
      resolvedPath: "",
      message: "Path denied: empty path",
    });
  }
  if (requestedPath.includes("\0")) {
    throw new PathSandboxError({
      requestedPath,
      workspaceRoot,
      resolvedPath: "",
      message: "Path denied: null byte in path",
    });
  }

  const rootReal = realpathSync(workspaceRoot);
  const resolved = resolve(rootReal, requestedPath);
  const candidateReal = realExistingPrefix(resolved);
  const rel = relative(rootReal, candidateReal);

  if (rel === "") {
    // Workspace root itself — allowed (rare for read, but not an escape).
    return resolved;
  }
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new PathSandboxError({
      requestedPath,
      workspaceRoot: rootReal,
      resolvedPath: resolved,
    });
  }
  return resolved;
}

export function isPathInsideWorkspace(
  workspaceRoot: string,
  requestedPath: string,
): boolean {
  try {
    assertInsideWorkspace(workspaceRoot, requestedPath);
    return true;
  } catch (error) {
    if (error instanceof PathSandboxError) return false;
    throw error;
  }
}
