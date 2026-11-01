/**
 * Minimal path sandbox for lab07: only allow writes under workspace/out.
 */
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export class PathSandboxError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "PathSandboxError";
    this.code = "PATH_DENIED";
    Object.assign(this, meta);
  }
}

export function assertUnderOutDir(labRoot, requestedRelativePath) {
  if (typeof requestedRelativePath !== "string" || !requestedRelativePath.trim()) {
    throw new PathSandboxError("Path denied: empty path", { requestedPath: String(requestedRelativePath) });
  }
  if (requestedRelativePath.includes("\0")) {
    throw new PathSandboxError("Path denied: null byte", { requestedPath: requestedRelativePath });
  }
  if (isAbsolute(requestedRelativePath)) {
    throw new PathSandboxError("Path denied: absolute path not allowed", {
      requestedPath: requestedRelativePath,
    });
  }

  const outRoot = resolve(labRoot, "workspace", "out");
  const resolved = resolve(outRoot, requestedRelativePath);
  const rel = relative(outRoot, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new PathSandboxError(`Path denied: escapes workspace/out (${requestedRelativePath})`, {
      requestedPath: requestedRelativePath,
      resolvedPath: resolved,
      outRoot,
    });
  }
  // Normalize to posix-ish relative for assertions
  const relPosix = rel.split(sep).join("/");
  return { absolutePath: resolved, relativeFromOut: relPosix, outRoot };
}

export function ensureParentDir(absolutePath) {
  mkdirSync(dirname(absolutePath), { recursive: true });
}
