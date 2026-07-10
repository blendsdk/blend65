/**
 * Specification tests for function-parameter collection — duplicate parameter
 * names (E10003), a parameter shadowing a module-level declaration (E10101),
 * and the diagnostic-registry entries the call surface relies on (E10051 for
 * calling an interrupt function; E10175 as the not-callable code, with no
 * parameter-count limit in the language).
 *
 * Expectations derive from the frozen spec Ch 06 (parameter rules) — never
 * from the implementation. Exercised through the real public path
 * (`lex`→`parse`→`analyze`).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** Lexes + parses + analyzes `source`; returns every recorded diagnostic code. */
function analyzeAll(source: string): string[] {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: SRC, bag });
  analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return bag.getAll().map((d: Diagnostic) => d.code);
}

describe("Specification: parameter collection", () => {
  it("should reject a duplicate parameter name with exactly one E10003", () => {
    const src =
      "module Main;\n" +
      "function f(a: byte, a: byte): void {}\n" +
      "function main(): void {}\n";
    const codes = analyzeAll(src);
    expect(codes.filter((c) => c === DiagCode.DuplicateDecl)).toHaveLength(1);
  });

  it("should reject a parameter shadowing a module-level declaration with E10101", () => {
    const src =
      "module Main;\n" +
      "let score: word;\n" +
      "function f(score: word): void {}\n" +
      "function main(): void {}\n";
    expect(analyzeAll(src)).toContain(DiagCode.NameShadows);
  });

  it("should accept distinct, non-shadowing parameters without diagnostics", () => {
    const src =
      "module Main;\n" +
      "function f(a: byte, b: word): void {}\n" +
      "function main(): void {}\n";
    expect(analyzeAll(src)).toEqual([]);
  });
});

describe("Specification: diagnostic registry — the call surface", () => {
  it("registers E10051 for calling an interrupt function directly", () => {
    expect(DiagCode.CallToInterruptFunction).toBe("E10051");
  });

  it("names E10175 'NotCallable' — the language has no parameter-count limit", () => {
    expect(DiagCode.NotCallable).toBe("E10175");
    expect(Object.keys(DiagCode)).not.toContain("TooManyParameters");
  });
});
