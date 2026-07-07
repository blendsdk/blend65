/**
 * Implementation tests for `loadConfig()` internals: the pre-populated-bag
 * `hasErrors` matrix including the at-cap case, the unreadable-file I/O
 * path, override-sourced synthetic spans, and post-error field values.
 */

import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { createDiagnosticBag } from "@blend65/core";
import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "./load-config.js";

const tempRoots: string[] = [];

/** Creates a fresh temp tree and registers it for cleanup. */
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "blend65-config-impl-"));
  tempRoots.push(dir);
  return dir;
}

/** Writes `content` as `<dir>/blend65.json`. */
function writeConfig(dir: string, content: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "blend65.json");
  writeFileSync(path, content, "utf8");
  return path;
}

afterAll(() => {
  for (const dir of tempRoots) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("hasErrors with pre-populated bags (PF-020)", () => {
  it("stays true when the bag is already AT its cap and the new error is suppressed", () => {
    const dir = makeTempDir();
    const bag = createDiagnosticBag({ maxErrors: 1 });
    bag.addError("E10001", null, "pre-existing 1");
    bag.addError("E10003", null, "pre-existing 2"); // exceeds cap → truncation sentinel
    expect(bag.isErrorLimitReached()).toBe(true);
    const before = bag.count();

    const { hasErrors } = loadConfig({ bag, configPath: join(dir, "nope.json") });
    expect(hasErrors).toBe(true); // emitted, even though the bag absorbed nothing
    expect(bag.count()).toBe(before); // suppressed add changed nothing observable
  });

  it("is false for a clean load even when the bag already holds errors AND warnings", () => {
    const dir = makeTempDir();
    writeConfig(dir, '{"platform":"c64"}');
    const bag = createDiagnosticBag();
    bag.addError("E10001", null, "pre-existing error");
    bag.addWarning("W10130", null, "pre-existing warning");
    const { hasErrors } = loadConfig({ bag, cwd: dir });
    expect(hasErrors).toBe(false);
  });

  it("is false when the load emits only warnings (unknown key)", () => {
    const dir = makeTempDir();
    writeConfig(dir, '{"platform":"c64", "platfrom":"typo"}');
    const bag = createDiagnosticBag();
    const { hasErrors } = loadConfig({ bag, cwd: dir });
    expect(hasErrors).toBe(false);
    expect(bag.getWarnings().length).toBe(1);
  });
});

describe("unreadable-file I/O path", () => {
  it("reports E10240 (with the reason) for an existing but unreadable file", () => {
    // Root bypasses permission bits — the scenario is unobservable there.
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      return;
    }
    const dir = makeTempDir();
    const path = writeConfig(dir, '{"platform":"c64"}');
    chmodSync(path, 0o000);
    try {
      const bag = createDiagnosticBag();
      const { config, hasErrors } = loadConfig({ bag, configPath: path });
      expect(hasErrors).toBe(true);
      const errors = bag.getErrors().filter((d) => d.code === "E10240");
      expect(errors.length).toBe(1);
      expect(errors[0]!.message).toContain(path);
      expect(config.configPath).toBeNull(); // nothing was loaded
      expect(config.outDir).toBe("./build/"); // defaults still apply
    } finally {
      chmodSync(path, 0o644); // restore so afterAll cleanup succeeds
    }
  });
});

describe("override-sourced synthetic spans (PF-019)", () => {
  it("anchors an override-sourced E10243 to the negative synthetic space, not the file node", () => {
    const dir = makeTempDir();
    writeConfig(dir, '{"platform":"c64", "maxErrors": 50}');
    const bag = createDiagnosticBag();
    loadConfig({ bag, cwd: dir, overrides: { maxErrors: 0 } });
    const errors = bag.getErrors().filter((d) => d.code === "E10243");
    expect(errors.length).toBe(1);
    expect(errors[0]!.primarySpan?.start).toBeLessThan(0);
  });

  it("anchors a file-sourced E10243 to a real (non-negative) byte offset", () => {
    const dir = makeTempDir();
    writeConfig(dir, '{"platform":"c64", "maxErrors": 0}');
    const bag = createDiagnosticBag();
    loadConfig({ bag, cwd: dir });
    const errors = bag.getErrors().filter((d) => d.code === "E10243");
    expect(errors.length).toBe(1);
    expect(errors[0]!.primarySpan?.start).toBeGreaterThanOrEqual(0);
  });
});

describe("post-error field values (AR-P9)", () => {
  it("keeps platform as '' after E10245", () => {
    const dir = makeTempDir();
    writeConfig(dir, "{}");
    const bag = createDiagnosticBag();
    const { config, hasErrors } = loadConfig({ bag, cwd: dir });
    expect(hasErrors).toBe(true);
    expect(config.platform).toBe("");
  });

  it("keeps semantically-invalid values as-merged (no post-hoc fallback)", () => {
    const dir = makeTempDir();
    writeConfig(
      dir,
      '{"platform":"c64", "maxErrors": 0, "include": ["../escape/**"], "startup": "fast"}',
    );
    const bag = createDiagnosticBag();
    const { config, hasErrors } = loadConfig({ bag, cwd: dir });
    expect(hasErrors).toBe(true);
    expect(config.maxErrors).toBe(0); // E10243, value survives
    expect(config.include).toEqual(["../escape/**"]); // E10246, value survives
    expect(config.startup).toBe("fast"); // E10243 enum, value survives (widening)
  });
});
