import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PathSandboxError,
  assertInsideWorkspace,
  isPathInsideWorkspace,
} from "./path-sandbox.js";

describe("assertInsideWorkspace", () => {
  const root = mkdtempSync(join(tmpdir(), "path-sandbox-"));
  mkdirSync(join(root, "notes"));
  writeFileSync(join(root, "notes", "ok.md"), "ok\n");

  it("allows relative path inside workspace", () => {
    const p = assertInsideWorkspace(root, "notes/ok.md");
    assert.equal(p, join(root, "notes", "ok.md"));
  });

  it("allows absolute path that stays inside workspace", () => {
    const inside = join(root, "notes", "ok.md");
    assert.equal(assertInsideWorkspace(root, inside), inside);
  });

  it("rejects parent climb with ..", () => {
    assert.throws(
      () => assertInsideWorkspace(root, "../outside.txt"),
      (err: unknown) => err instanceof PathSandboxError,
    );
  });

  it("rejects absolute escape outside workspace", () => {
    assert.throws(
      () => assertInsideWorkspace(root, "/tmp/pi-harness-path-escape-bait.txt"),
      (err: unknown) => err instanceof PathSandboxError,
    );
  });

  it("rejects empty path", () => {
    assert.throws(
      () => assertInsideWorkspace(root, "  "),
      (err: unknown) => err instanceof PathSandboxError,
    );
  });

  it("isPathInsideWorkspace mirrors assert", () => {
    assert.equal(isPathInsideWorkspace(root, "notes/ok.md"), true);
    assert.equal(isPathInsideWorkspace(root, "../x"), false);
  });

  it("rejects symlink that escapes workspace when link exists", () => {
    const outside = join(tmpdir(), `path-sandbox-out-${Date.now()}.txt`);
    writeFileSync(outside, "secret\n");
    const link = join(root, "escape-link");
    try {
      symlinkSync(outside, link);
      assert.throws(
        () => assertInsideWorkspace(root, "escape-link"),
        (err: unknown) => err instanceof PathSandboxError,
      );
    } finally {
      try {
        rmSync(link, { force: true });
      } catch {
        // ignore
      }
      try {
        rmSync(outside, { force: true });
      } catch {
        // ignore
      }
    }
  });
});
