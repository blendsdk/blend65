/**
 * Specification tests for user-function call typing — the happy path, the
 * callee-resolution ladder (undeclared E10100, interrupt E10051, entry point
 * E10023, not-callable E10175), argument-count E10170 (which suppresses
 * per-argument type checks), argument type checking E10171 (assignment
 * compatibility — a narrowing argument is rejected), and declaration-order
 * independence.
 *
 * Expectations derive from the frozen spec Ch 06 §4 and Ch 10 §5.2 — never
 * from the implementation. Exercised through the real public path
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

/** Lexes + parses + analyzes `source`; returns every recorded diagnostic code. */
function analyzeAll(source: string): string[] {
  return analyzeDiags(source).map((d) => d.code);
}

describe("Specification: call typing — happy path", () => {
  it("should type a valid two-byte-argument call as the return type with no diagnostics", () => {
    const src =
      "module Main;\n" +
      "function add(a: byte, b: byte): byte { return a + b; }\n" +
      "function main(): void { let r: byte = add(10, 7); }\n";
    expect(analyzeAll(src)).toEqual([]);
  });

  it("should resolve a function declared after its call site (declaration-order independence)", () => {
    const src =
      "module Main;\n" +
      "function main(): void { let r: byte = combo(5); }\n" +
      "function combo(n: byte): byte { return n; }\n";
    expect(analyzeAll(src)).toEqual([]);
  });
});

describe("Specification: call typing — argument checking", () => {
  it("should reject a wrong argument count with E10170 naming the function and both counts", () => {
    const src =
      "module Main;\n" +
      "function add(a: byte, b: byte): byte { return a + b; }\n" +
      "function main(): void { let r: byte = add(1); }\n";
    const diags = analyzeDiags(src);
    const codes = diags.map((d) => d.code);
    expect(codes).toContain(DiagCode.WrongArgCount);
    const count = diags.find((d) => d.code === DiagCode.WrongArgCount);
    expect(count?.message).toContain("add");
    expect(count?.message).toContain("2");
    expect(count?.message).toContain("1");
    // A count failure suppresses the per-argument type checks.
    expect(codes).not.toContain(DiagCode.ArgTypeMismatch);
  });

  it("should reject an argument type mismatch with E10171 naming the parameter and both types", () => {
    const src =
      "module Main;\n" +
      "function add(a: byte, b: byte): byte { return a + b; }\n" +
      "function main(): void { let w: word = 300; let r: byte = add(w, 1); }\n";
    const diags = analyzeDiags(src);
    const codes = diags.map((d) => d.code);
    expect(codes).toContain(DiagCode.ArgTypeMismatch);
    const mismatch = diags.find((d) => d.code === DiagCode.ArgTypeMismatch);
    expect(mismatch?.message).toContain("'a'");
    expect(mismatch?.message).toContain("'byte'");
    expect(mismatch?.message).toContain("'word'");
    // Strict same-type: one code for the argument position, no assignment-family cascade.
    expect(codes).not.toContain(DiagCode.WidthNarrowingNoCast);
    expect(codes).not.toContain(DiagCode.WrongArgCount);
  });
});

describe("Specification: call typing — callee resolution ladder", () => {
  it("should reject an undeclared callee with exactly one E10100 and no cascade", () => {
    const src = "module Main;\nfunction main(): void { nope(); }\n";
    expect(analyzeAll(src)).toEqual([DiagCode.UndeclaredIdentifier]);
  });

  it("should reject calling an interrupt function directly with E10051", () => {
    const src =
      "module Main;\n" +
      "interrupt function h() {}\n" +
      "function main(): void { h(); }\n";
    expect(analyzeAll(src)).toContain(DiagCode.CallToInterruptFunction);
  });

  it("should reject calling main directly with E10023", () => {
    const src =
      "module Main;\n" +
      "function caller(): void { main(); }\n" +
      "function main(): void {}\n";
    expect(analyzeAll(src)).toContain(DiagCode.CallingMainDirectly);
  });

  it("should reject calling a non-function value with E10175", () => {
    const src = "module Main;\nfunction main(): void { let x: byte = 1; x(); }\n";
    const codes = analyzeAll(src);
    expect(codes).toContain(DiagCode.NotCallable);
    expect(codes).not.toContain(DiagCode.UndeclaredIdentifier);
  });
});
