/**
 * Specification tests for return-statement completion — a bare `return;` in a
 * non-void function (E10172) and a return-value type mismatch, reported
 * through the assignment-compatibility family with return-context wording.
 *
 * Expectations derive from the frozen spec Ch 06 (return rules) — never from
 * the implementation. Exercised through the real public path
 * (`lex`→`parse`→`analyze`).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** Lexes + parses + analyzes `source`; returns every recorded diagnostic. */
function analyzeDiags(source: string): Diagnostic[] {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: SRC, bag });
  analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return bag.getAll();
}

describe("Specification: return completion", () => {
  it("should reject a bare 'return;' in a non-void function with E10172", () => {
    const src =
      "module Main;\n" +
      "function f(): byte { return; }\n" +
      "function main(): void {}\n";
    const diags = analyzeDiags(src);
    const codes = diags.map((d) => d.code);
    expect(codes).toContain(DiagCode.MissingReturnValue);
    const missing = diags.find((d) => d.code === DiagCode.MissingReturnValue);
    expect(missing?.message).toContain("f");
  });

  it("should reject a narrowing return-value mismatch with E10154 and return-context wording", () => {
    const src =
      "module Main;\n" +
      "function f(): byte { let w: word = 300; return w; }\n" +
      "function main(): void {}\n";
    const diags = analyzeDiags(src);
    const codes = diags.map((d) => d.code);
    expect(codes).toContain(DiagCode.WidthNarrowingNoCast);
    const mismatch = diags.find((d) => d.code === DiagCode.WidthNarrowingNoCast);
    expect(mismatch?.message).toContain("return type of 'f'");
    // The mismatch is reported once, through the assignment family only.
    expect(codes).not.toContain(DiagCode.MissingReturnValue);
    expect(codes).not.toContain(DiagCode.VoidFunctionReturnsValue);
  });

  it("should accept a matching return value without diagnostics", () => {
    const src =
      "module Main;\n" +
      "function f(): byte { return 7; }\n" +
      "function main(): void {}\n";
    expect(analyzeDiags(src)).toEqual([]);
  });
});
