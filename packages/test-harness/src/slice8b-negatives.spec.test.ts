/**
 * Specification tests for the Slice 8b acceptance-bar negatives, all
 * through the public `compile()` facade with real files in a scratch
 * project: the embed legality/reader family (illegal position, missing
 * file, size mismatch, traversal escape — the escape rejects whether or
 * not the target exists), the string-initialiser family (mixed elements,
 * oversized string, unmappable character), and the loud format-argument
 * boundary. One test per diagnostic code. CI-runnable (no ACME).
 *
 * These tests derive from the frozen spec (Ch 08, Ch 13) — never from the
 * implementation.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { compile } from "@blend65/compiler";

/**
 * Compiles one `main.blend` (frontend-only) in a scratch dir, staging any
 * extra files (relative path → bytes) beside it first.
 */
function compileWithFiles(
  source: string,
  files: Record<string, Uint8Array> = {},
): ReturnType<typeof compile> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-slice8b-neg-"));
  writeFileSync(join(cwd, "main.blend"), source, "utf8");
  for (const [rel, bytes] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, rel)), { recursive: true });
    writeFileSync(join(cwd, rel), bytes);
  }
  try {
    let result!: ReturnType<typeof compile>;
    expect(() => {
      result = compile({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
    }).not.toThrow();
    return result;
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** All diagnostic codes of a result. */
function codes(result: { diagnostics: readonly { code: string }[] }): string[] {
  return result.diagnostics.map((d) => d.code);
}

const MAIN = "function main(): void { }";
const EIGHT = Uint8Array.from([1, 2, 4, 8, 16, 32, 64, 128]);

describe("Specification: Slice 8b embed negatives via compile()", () => {
  it("rejects embed outside a module-level const byte-array initializer (E10200)", () => {
    const result = compileWithFiles(
      ["module Main;", 'let d: byte[] = embed("t.bin");', MAIN].join("\n"),
      { "t.bin": EIGHT },
    );
    expect(codes(result)).toContain("E10200");
  });

  it("rejects a missing asset file (E10201)", () => {
    const result = compileWithFiles(
      ["module Main;", 'const D: byte[] = embed("missing.bin");', MAIN].join("\n"),
    );
    expect(codes(result)).toContain("E10201");
  });

  it("rejects a declared size that disagrees with the file (E10202)", () => {
    const result = compileWithFiles(
      ["module Main;", 'const D: byte[4] = embed("t.bin");', MAIN].join("\n"),
      { "t.bin": EIGHT },
    );
    expect(codes(result)).toContain("E10202");
  });

  it("rejects a traversal escape even though the target does not exist (E10205)", () => {
    const result = compileWithFiles(
      ["module Main;", 'const D: byte[] = embed("../../outside.bin");', MAIN].join("\n"),
    );
    expect(codes(result)).toContain("E10205");
  });

  it("rejects the format argument loudly as not supported yet (E90001)", () => {
    const result = compileWithFiles(
      ["module Main;", 'const D: byte[] = embed("t.bin", spritepad);', MAIN].join("\n"),
      { "t.bin": EIGHT },
    );
    const e = result.diagnostics.find((d) => d.code === "E90001");
    expect(e, "expected the loud not-supported error").toBeDefined();
    expect(e?.message).toContain("format-aware");
  });
});

describe("Specification: Slice 8b string negatives via compile()", () => {
  it("rejects a string mixed with value elements (E10116)", () => {
    const result = compileWithFiles(
      ["module Main;", 'let a: byte[10] = [1, "HI", 3];', MAIN].join("\n"),
    );
    expect(codes(result)).toContain("E10116");
  });

  it("rejects a string longer than the declared array size (E10124)", () => {
    const result = compileWithFiles(
      ["module Main;", 'let q: byte[3] = "HELLO";', MAIN].join("\n"),
    );
    expect(codes(result)).toContain("E10124");
  });

  it("rejects a character the platform encoding cannot represent (E10127)", () => {
    const result = compileWithFiles(
      ["module Main;", 'const M: byte[] = "café";', MAIN].join("\n"),
    );
    expect(codes(result)).toContain("E10127");
  });
});
