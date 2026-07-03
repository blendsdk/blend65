/**
 * Implementation tests for `assertGolden` — diff formatting, the missing-file
 * message, and parent-directory creation in update mode. CI tier (no emulator).
 */

import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AssertionError } from "./run/assertions.js";
import { assertGolden } from "./golden.js";

let dir: string;

afterEach(() => {
  if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  delete process.env.UPDATE_GOLDEN;
});

describe("assertGolden — compare mode", () => {
  it("a missing golden file throws an AssertionError naming UPDATE_GOLDEN", () => {
    dir = mkdtempSync(join(tmpdir(), "b65-golden-impl-"));
    const path = join(dir, "absent.golden");
    expect(() => assertGolden("x", path)).toThrow(AssertionError);
    expect(() => assertGolden("x", path)).toThrow(/UPDATE_GOLDEN=1/);
  });

  it("the diff excerpt reports the 1-based line number of the first divergence", () => {
    dir = mkdtempSync(join(tmpdir(), "b65-golden-impl-"));
    const path = join(dir, "g.golden");
    assertGolden("a\nb\nc\nd\n", path, true); // write via updateMode arg
    let message = "";
    try {
      assertGolden("a\nb\nX\nd\n", path);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/first difference at line 3/);
    expect(message).toContain("- c"); // golden line
    expect(message).toContain("+ X"); // actual line
  });
});

describe("assertGolden — update mode", () => {
  it("creates missing parent directories when writing the golden", () => {
    dir = mkdtempSync(join(tmpdir(), "b65-golden-impl-"));
    const path = join(dir, "nested", "deep", "new.golden");
    expect(existsSync(path)).toBe(false);
    assertGolden("content\n", path, true);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf8")).toBe("content\n");
  });

  it("UPDATE_GOLDEN=0 / empty does NOT trigger update mode (stays compare)", () => {
    dir = mkdtempSync(join(tmpdir(), "b65-golden-impl-"));
    const path = join(dir, "absent.golden");
    process.env.UPDATE_GOLDEN = "0";
    expect(() => assertGolden("x", path)).toThrow(/not found/);
    expect(existsSync(path)).toBe(false);
  });
});
