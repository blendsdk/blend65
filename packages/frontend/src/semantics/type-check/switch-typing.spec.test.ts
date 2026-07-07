/**
 * Specification tests for switch semantics — discriminant operand-type
 * (E10075), const case values (E10071), case-const range (E10084),
 * case-value type-match (E10077), and duplicate case values (E10132), plus the
 * deferred-parser-owned duplicate-`default` behavior (no E10076).
 *
 * Expectations derive EXCLUSIVELY from the frozen spec Ch 05 §8 — NEVER from
 * reading the implementation (immutable oracle). Exercised through the REAL
 * public path (`lex`→`parse`→`analyze`).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";

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

describe("Specification: RD-18 Slice 4b switch discriminant typing (FR-1)", () => {
  // A `boolean` switch operand → E10075.
  it("should reject a boolean switch discriminant with E10075 (ST-1)", () => {
    const src =
      "module Main;\n" +
      "function main(): void {\n" +
      "  let b: boolean = true;\n" +
      "  switch (b) {\n" +
      "    case 1:\n" +
      "      b = false;\n" +
      "    default:\n" +
      "      b = true;\n" +
      "  }\n" +
      "}\n";
    expect(analyzeAll(src)).toContain(DiagCode.InvalidSwitchOperandType); // E10075
  });

  // A valid `byte` switch with const cases + default → no switch error.
  it("should accept a valid byte switch with no switch diagnostics (ST-2)", () => {
    const src =
      "module Main;\n" +
      "function main(): void {\n" +
      "  let x: byte = 1;\n" +
      "  switch (x) {\n" +
      "    case 1:\n" +
      "      x = 10;\n" +
      "    case 2:\n" +
      "      x = 20;\n" +
      "    default:\n" +
      "      x = 0;\n" +
      "  }\n" +
      "}\n";
    const codes = analyzeAll(src);
    expect(codes).not.toContain(DiagCode.InvalidSwitchOperandType); // E10075
    expect(codes).not.toContain(DiagCode.CaseValueNotConstant); // E10071
    expect(codes).not.toContain(DiagCode.CaseValueTypeMismatch); // E10077
    expect(codes).not.toContain(DiagCode.ValueOutOfRange); // E10084
    expect(codes).not.toContain(DiagCode.DuplicateCaseValue); // E10132
  });
});

describe("Specification: RD-18 Slice 4b case-value validation (FR-2/FR-3a/FR-4)", () => {
  // A non-const case value (a runtime var) → E10071.
  it("should reject a non-const case value with E10071 (ST-3)", () => {
    const src =
      "module Main;\n" +
      "function main(): void {\n" +
      "  let x: byte = 1;\n" +
      "  let y: byte = 2;\n" +
      "  switch (x) {\n" +
      "    case y:\n" +
      "      x = 10;\n" +
      "    default:\n" +
      "      x = 0;\n" +
      "  }\n" +
      "}\n";
    expect(analyzeAll(src)).toContain(DiagCode.CaseValueNotConstant); // E10071
  });

  // An integer case const out of the discriminant's range → E10084 (range,
  // NOT E10077). `case 300` on a `byte` switch.
  it("should reject an out-of-range integer case const with E10084, not E10077 (ST-4a)", () => {
    const src =
      "module Main;\n" +
      "function main(): void {\n" +
      "  let x: byte = 1;\n" +
      "  switch (x) {\n" +
      "    case 300:\n" +
      "      x = 10;\n" +
      "    default:\n" +
      "      x = 0;\n" +
      "  }\n" +
      "}\n";
    const codes = analyzeAll(src);
    expect(codes).toContain(DiagCode.ValueOutOfRange); // E10084
    expect(codes).not.toContain(DiagCode.CaseValueTypeMismatch); // NOT E10077
  });

  // A folded case const whose type is a *non-adapting* different primitive
  // than the discriminant → E10077. In the current integer-only surface there
  // is no reachable input (bool → E10071 first; integer literals adapt;
  // out-of-range → E10084), so E10077's emission is exercised only once
  // enum/other-primitive constants are supported as case values. Authored as
  // a deferred `.todo`.
  it.todo("should reject a non-adapting different-primitive case const with E10077 (ST-4b, Slice 7)");

  // A duplicate case value within a single multi-value list → E10132.
  it("should reject a duplicate value in a multi-value case with E10132 (ST-5a)", () => {
    const src =
      "module Main;\n" +
      "function main(): void {\n" +
      "  let x: byte = 1;\n" +
      "  switch (x) {\n" +
      "    case 1, 1:\n" +
      "      x = 10;\n" +
      "    default:\n" +
      "      x = 0;\n" +
      "  }\n" +
      "}\n";
    expect(analyzeAll(src)).toContain(DiagCode.DuplicateCaseValue); // E10132
  });

  // A duplicate case value across separate clauses → E10132.
  it("should reject a duplicate case value across clauses with E10132 (ST-5b)", () => {
    const src =
      "module Main;\n" +
      "function main(): void {\n" +
      "  let x: byte = 1;\n" +
      "  switch (x) {\n" +
      "    case 1:\n" +
      "      x = 10;\n" +
      "    case 1:\n" +
      "      x = 20;\n" +
      "    default:\n" +
      "      x = 0;\n" +
      "  }\n" +
      "}\n";
    expect(analyzeAll(src)).toContain(DiagCode.DuplicateCaseValue); // E10132
  });
});

describe("Specification: RD-18 Slice 4b duplicate default (FR-5/PF-001)", () => {
  // Two `default:` clauses. The parser keeps a single `defaultClause` slot
  // and silently overwrites (last-wins), so a semantics-side E10076 is unreachable
  // and the analyzer accepts it silently (E10076 deferred, parser-owned). Asserts
  // the ACTUAL current behavior: no error, and specifically no "E10076".
  it("should silently accept two default clauses — no error, no E10076 (ST-11)", () => {
    const src =
      "module Main;\n" +
      "function main(): void {\n" +
      "  let x: byte = 1;\n" +
      "  switch (x) {\n" +
      "    case 1:\n" +
      "      x = 10;\n" +
      "    default:\n" +
      "      x = 2;\n" +
      "    default:\n" +
      "      x = 3;\n" +
      "  }\n" +
      "}\n";
    const codes = analyzeAll(src);
    expect(codes).not.toContain("E10076");
    expect(codes.filter((c) => c.startsWith("E1"))).toHaveLength(0); // no user error
  });
});
