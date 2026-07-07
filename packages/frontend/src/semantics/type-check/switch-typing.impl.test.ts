/**
 * Implementation tests for RD-18 Slice 4b switch semantics — internals and edge
 * cases beyond the specification oracle: check precedence (E10071 → E10084 →
 * E10077), literal adaptation for a `word` discriminant, poison (cascade)
 * suppression, multi-value lists, and empty case bodies.
 *
 * These probe the implementation's behavior (not a frozen-spec contract), so they
 * live in the `.impl` tier. Exercised through the REAL public path
 * (`lex`→`parse`→`analyze`).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";

const SRC = 1;

function analyzeAll(source: string): string[] {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: SRC, bag });
  analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return bag.getAll().map((d: Diagnostic) => d.code);
}

describe("Impl: RD-18 Slice 4b case-value check precedence (PF-002)", () => {
  // A `bool` case value on an integer switch is caught by E10071 (not-an-integer-
  // const), NOT by the type-match E10077 — E10071 shadows it.
  it("emits E10071 (not E10077) for a bool case value", () => {
    const codes = analyzeAll(
      "module Main;\n" +
        "function main(): void {\n" +
        "  let x: byte = 1;\n" +
        "  switch (x) { case true: x = 1; default: x = 0; }\n" +
        "}\n",
    );
    expect(codes).toContain(DiagCode.CaseValueNotConstant); // E10071
    expect(codes).not.toContain(DiagCode.CaseValueTypeMismatch); // NOT E10077
  });

  // An out-of-range integer case const is a RANGE error (E10084), NOT a type
  // mismatch (E10077) — E10084 shadows it.
  it("emits E10084 (not E10077) for an out-of-range integer case const", () => {
    const codes = analyzeAll(
      "module Main;\n" +
        "function main(): void {\n" +
        "  let x: byte = 1;\n" +
        "  switch (x) { case 256: x = 1; default: x = 0; }\n" +
        "}\n",
    );
    expect(codes).toContain(DiagCode.ValueOutOfRange); // E10084
    expect(codes).not.toContain(DiagCode.CaseValueTypeMismatch); // NOT E10077
  });
});

describe("Impl: RD-18 Slice 4b literal adaptation + no spurious diagnostics", () => {
  // A `word` discriminant with byte-fitting case values: the literals adapt to
  // `word`, so no spurious type-mismatch (E10077) and no range error (E10084).
  it("accepts byte-fitting values on a word switch (no E10077/E10084)", () => {
    const codes = analyzeAll(
      "module Main;\n" +
        "function main(): void {\n" +
        "  let w: word = 5;\n" +
        "  switch (w) { case 5: w = 1; case 300: w = 2; default: w = 0; }\n" +
        "}\n",
    );
    expect(codes).not.toContain(DiagCode.CaseValueTypeMismatch); // E10077
    expect(codes).not.toContain(DiagCode.ValueOutOfRange); // E10084 (300 fits a word)
  });

  // A multi-value list of distinct valid values is accepted (no duplicate error).
  it("accepts a multi-value list of distinct values (no E10132)", () => {
    const codes = analyzeAll(
      "module Main;\n" +
        "function main(): void {\n" +
        "  let x: byte = 1;\n" +
        "  switch (x) { case 1, 2, 3: x = 9; default: x = 0; }\n" +
        "}\n",
    );
    expect(codes).not.toContain(DiagCode.DuplicateCaseValue); // E10132
  });

  // An empty case body (a bare `case 1:` immediately followed by another clause) is
  // valid — no diagnostics.
  it("accepts an empty case body", () => {
    const codes = analyzeAll(
      "module Main;\n" +
        "function main(): void {\n" +
        "  let x: byte = 1;\n" +
        "  switch (x) { case 1: case 2: x = 9; default: x = 0; }\n" +
        "}\n",
    );
    expect(codes.filter((c) => c.startsWith("E1"))).toHaveLength(0);
  });
});

describe("Impl: RD-18 Slice 4b cascade suppression (3b R114)", () => {
  // A poisoned (undeclared-identifier) discriminant emits E10100 but NOT a spurious
  // E10075 — the operand-type check is suppressed on a poison type.
  it("suppresses E10075 for a poisoned discriminant (emits only E10100)", () => {
    const codes = analyzeAll(
      "module Main;\n" +
        "function main(): void {\n" +
        "  switch (undof) { case 1: default: }\n" +
        "}\n",
    );
    expect(codes).toContain(DiagCode.UndeclaredIdentifier); // E10100
    expect(codes).not.toContain(DiagCode.InvalidSwitchOperandType); // NOT E10075
  });
});
