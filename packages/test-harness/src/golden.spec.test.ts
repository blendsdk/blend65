/**
 * Specification tests for `assertGolden` (ST-24, ST-25, ST-26).
 *
 * Derived EXCLUSIVELY from RD-12 §4.3 and R29–R32 / AC-10 / AR-H10 — never from
 * reading the implementation (IMMUTABLE ORACLE RULE). Pure file compare/write,
 * runs in CI (no emulator).
 */

import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertGolden } from "./golden.js";

let dir: string;

function tempPath(name: string): string {
  return join(dir, name);
}

describe("Specification: assertGolden (ST-24, ST-25, ST-26)", () => {
  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    delete process.env.UPDATE_GOLDEN;
  });

  it("ST-24: passes when the golden file equals the actual content", () => {
    dir = mkdtempSync(join(tmpdir(), "b65-golden-"));
    const path = tempPath("g.golden");
    writeFileSync(path, "hello\nworld\n", "utf8");
    expect(() => assertGolden("hello\nworld\n", path)).not.toThrow();
  });

  it("ST-25: throws an AssertionError with a diff excerpt on mismatch", () => {
    dir = mkdtempSync(join(tmpdir(), "b65-golden-"));
    const path = tempPath("g.golden");
    writeFileSync(path, "line1\nline2\nline3\n", "utf8");
    let message = "";
    try {
      assertGolden("line1\nCHANGED\nline3\n", path);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message.length).toBeGreaterThan(0);
    // The excerpt points at the first divergence.
    expect(message).toContain("line2");
    expect(message).toContain("CHANGED");
  });

  it("ST-26: with UPDATE_GOLDEN set, writes the golden and passes; a re-run compares clean", () => {
    dir = mkdtempSync(join(tmpdir(), "b65-golden-"));
    const path = tempPath("new.golden");
    expect(existsSync(path)).toBe(false);

    process.env.UPDATE_GOLDEN = "1";
    expect(() => assertGolden("fresh content\n", path)).not.toThrow();
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf8")).toBe("fresh content\n");

    // Re-run in compare mode: the just-written golden matches.
    delete process.env.UPDATE_GOLDEN;
    expect(() => assertGolden("fresh content\n", path)).not.toThrow();
  });

  it("ST-26: the explicit updateMode arg also writes the golden", () => {
    dir = mkdtempSync(join(tmpdir(), "b65-golden-"));
    const path = tempPath("arg.golden");
    expect(() => assertGolden("via arg\n", path, true)).not.toThrow();
    expect(readFileSync(path, "utf8")).toBe("via arg\n");
  });
});
