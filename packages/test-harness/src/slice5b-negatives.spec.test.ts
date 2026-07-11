/**
 * Specification tests for the Slice 5b acceptance-bar negatives: six invalid
 * module-system programs must be rejected through the frontend-only
 * `compile()` facade — set `hasErrors`, emit the expected code, produce NO
 * binary, and never throw. CI-runnable (no ACME).
 *
 * These tests are derived from the frozen spec's module rules (Ch 10) and the
 * fixture's documented behavior, not from reading the implementation: a
 * circular initializer chain, qualified access to a non-exported member, an
 * unknown qualified head, a call-bearing module initializer (loud
 * not-supported rejection), a duplicate declaration across two files of one
 * merged module, and a const initialized from a runtime variable.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DiagCode, IceCode } from "@blend65/core";
import { compile } from "@blend65/compiler";

/** Compiles the named sources (frontend-only) in a scratch dir. */
function compileFiles(files: Record<string, string>): ReturnType<typeof compile> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-slice5b-neg-"));
  for (const [name, src] of Object.entries(files)) {
    writeFileSync(join(cwd, name), src, "utf8");
  }
  try {
    let result!: ReturnType<typeof compile>;
    expect(() => {
      result = compile({ platform: "c64", cwd, sourceFiles: Object.keys(files) });
    }).not.toThrow();
    return result;
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe("Specification: Slice 5b negatives via compile()", () => {
  it("rejects a circular initializer chain with ONE E10194 carrying the path", () => {
    const result = compileFiles({
      "main.blend":
        "module Main;\n" +
        "let a: byte = b + 1;\n" +
        "let b: byte = a + 1;\n" +
        "function main(): void {}\n",
    });
    expect(result.hasErrors).toBe(true);
    const circular = result.diagnostics.filter((d) => d.code === DiagCode.CircularInit);
    expect(circular).toHaveLength(1);
    expect(circular[0].message).toContain("a → b → a");
    expect(result).not.toHaveProperty("binary");
  });

  it("rejects qualified access to a non-exported member with E10012", () => {
    const result = compileFiles({
      "main.blend": "module Main;\nfunction main(): void { Math.helper(); }\n",
      "math.blend": "module Math;\nfunction helper(): byte { return 1; }\n",
    });
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain(DiagCode.ImportNonExported);
    expect(result).not.toHaveProperty("binary");
  });

  it("rejects an unknown qualified head with E10100", () => {
    const result = compileFiles({
      "main.blend": "module Main;\nfunction main(): void { Nope.fn(); }\n",
    });
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain(DiagCode.UndeclaredIdentifier);
    expect(result).not.toHaveProperty("binary");
  });

  it("rejects a call-bearing module initializer loudly", () => {
    const result = compileFiles({
      "main.blend":
        "module Main;\n" +
        "function f(): byte { return 1; }\n" +
        "let x: byte = f();\n" +
        "function main(): void {}\n",
    });
    expect(result.hasErrors).toBe(true);
    const ice = result.diagnostics.find((d) => d.code === IceCode.Unexpected);
    expect(ice?.message).toContain("call-bearing module initializers are not supported yet");
    expect(result).not.toHaveProperty("binary");
  });

  it("rejects a duplicate declaration across two files of one merged module with E10003", () => {
    const result = compileFiles({
      "main.blend": "module Main;\nfunction main(): void {}\n",
      "math.blend": "module M;\nexport function f(): byte { return 1; }\n",
      "math2.blend": "module M;\nexport function f(): byte { return 2; }\n",
    });
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain(DiagCode.DuplicateDecl);
    expect(result).not.toHaveProperty("binary");
  });

  it("rejects a const initialized from a runtime variable with E10193", () => {
    const result = compileFiles({
      "main.blend":
        "module Main;\n" +
        "let v: byte;\n" +
        "const B: byte = v;\n" +
        "function main(): void {}\n",
    });
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain(DiagCode.NonConstInit);
    expect(result).not.toHaveProperty("binary");
  });
});
