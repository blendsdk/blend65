/**
 * Specification tests for the RD-18 Slice 4b acceptance-bar negatives (ST-22/ST-23/
 * ST-24, FR-13): three invalid switches must be rejected through the frontend-only
 * `compile()` facade — set `hasErrors`, emit the code, produce NO binary, and never
 * throw. CI-runnable (no ACME).
 *
 * Derived EXCLUSIVELY from `03-03-acceptance-fixtures.md §3` + the requirements
 * (FR-13) — never from reading the implementation (IMMUTABLE ORACLE). Each fixture
 * carries a `default` so the parser's E10072/MissingDefaultClause (AR-5) does not
 * mask the code under test, and uses locals only (params are Slice 5).
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DiagCode } from "@blend65/core";
import { compile } from "@blend65/compiler";

/** Compiles `src` (frontend-only) in a scratch dir; returns the compile result. */
function compileSource(src: string): ReturnType<typeof compile> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-slice4b-neg-"));
  writeFileSync(join(cwd, "main.blend"), src, "utf8");
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

describe("Specification: Slice 4b negatives via compile() (FR-13)", () => {
  // ST-22 — a non-const case value (a runtime var) → E10071, no binary.
  it("rejects a non-const case value with E10071 and no binary (ST-22)", () => {
    const result = compileSource(
      "module Main;\nfunction main(): void {\n" +
        "  let x: byte = 1;\n  let y: byte = 2;\n" +
        "  switch (x) { case y: x = 1; default: x = 0; }\n" +
        "}\n",
    );
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain(DiagCode.CaseValueNotConstant); // E10071
    expect(result).not.toHaveProperty("binary");
  });

  // ST-23 — a duplicate case value → E10132, no binary.
  it("rejects a duplicate case value with E10132 and no binary (ST-23)", () => {
    const result = compileSource(
      "module Main;\nfunction main(): void {\n" +
        "  let x: byte = 1;\n" +
        "  switch (x) { case 1: x = 1; case 1: x = 2; default: x = 0; }\n" +
        "}\n",
    );
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain(DiagCode.DuplicateCaseValue); // E10132
    expect(result).not.toHaveProperty("binary");
  });

  // ST-24 — a boolean switch discriminant → E10075, no binary.
  it("rejects a boolean switch operand with E10075 and no binary (ST-24)", () => {
    const result = compileSource(
      "module Main;\nfunction main(): void {\n" +
        "  let b: boolean = true;\n" +
        "  switch (b) { case 1: b = false; default: b = true; }\n" +
        "}\n",
    );
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain(DiagCode.InvalidSwitchOperandType); // E10075
    expect(result).not.toHaveProperty("binary");
  });
});
