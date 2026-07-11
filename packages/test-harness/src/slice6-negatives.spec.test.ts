/**
 * Specification tests for the Slice 6 acceptance-bar negatives: invalid
 * expression programs must be rejected through the public `compile()` facade
 * — set `hasErrors`, emit the expected code, produce NO binary, and never
 * throw — and the two advisory shapes must compile WITH their warnings.
 * Signed division is rejected at the lowering stage, so it goes through
 * `emitIl`. CI-runnable (no ACME).
 *
 * These tests are derived from the frozen spec's operator rules (Ch 02/04),
 * not from reading the implementation.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compile, emitIl } from "@blend65/compiler";

/** Compiles one `main.blend` (frontend-only) in a scratch dir. */
function compileMain(source: string): ReturnType<typeof compile> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-slice6-neg-"));
  writeFileSync(join(cwd, "main.blend"), source, "utf8");
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

/** Runs one `main.blend` through the IL pipeline (frontend + lowering). */
function emitIlMain(source: string): ReturnType<typeof emitIl> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-slice6-neg-il-"));
  writeFileSync(join(cwd, "main.blend"), source, "utf8");
  try {
    let result!: ReturnType<typeof emitIl>;
    expect(() => {
      result = emitIl({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
    }).not.toThrow();
    return result;
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** The `main` fixture wrapper. */
function inMain(body: string): string {
  return `module Main;\nfunction main(): void { ${body} }\n`;
}

describe("Specification: Slice 6 negatives via compile()", () => {
  it("rejects a mixed-signedness comparison with E10081", () => {
    const result = compileMain(
      inMain("let b: byte = 1; let s: sbyte = -1; let ok: boolean = b < s;"),
    );
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain("E10081");
    expect(result).not.toHaveProperty("binary");
  });

  it("rejects an ordered comparison on booleans with E10080", () => {
    const result = compileMain(
      inMain("let f1: boolean = true; let f2: boolean = false; let r: boolean = f1 < f2;"),
    );
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain("E10080");
  });

  it("rejects negating an unsigned value with E10087", () => {
    const result = compileMain(inMain("let b: byte = 5; let n: byte = -b;"));
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain("E10087");
  });

  it("rejects a boolean-integer cast with E10086", () => {
    const result = compileMain(inMain("let f: boolean = <boolean>(5);"));
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain("E10086");
  });

  it("rejects mixed-sign conditional arms with E10088", () => {
    const result = compileMain(
      inMain(
        "let flag: boolean = true; let b: byte = 1; let s: sbyte = -1;" +
          " let x: byte = flag ? b : s;",
      ),
    );
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain("E10088");
  });

  it("rejects a signed shift amount with E10083", () => {
    const result = compileMain(
      inMain("let x: byte = 1; let s: sbyte = 1; let r: byte = x << s;"),
    );
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain("E10083");
  });

  it("rejects signed division loudly at the lowering stage (E90001)", () => {
    const result = emitIlMain(
      inMain("let a: sbyte = -4; let b: sbyte = 2; let q: sbyte = a / b;"),
    );
    expect(result.hasErrors).toBe(true);
    const ice = result.diagnostics.find((d) => d.code === "E90001");
    expect(ice).toBeDefined();
    expect(ice?.message).toContain("signed division");
  });
});

describe("Specification: Slice 6 advisory shapes via compile()", () => {
  it("compiles narrow arithmetic into a wider target WITH W10160", () => {
    const result = compileMain(
      inMain("let a: byte = 5; let b: byte = 6; let r: word = a + b; poke($C000, a);"),
    );
    expect(result.hasErrors).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain("W10160");
  });

  it("compiles a width-exceeding constant shift WITH W10174", () => {
    const result = compileMain(
      inMain("let b: byte = 1; let r: byte = b << 9; poke($C000, r);"),
    );
    expect(result.hasErrors).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain("W10174");
  });
});
