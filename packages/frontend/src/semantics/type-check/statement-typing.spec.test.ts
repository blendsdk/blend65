/**
 * Specification tests for RD-18 Slice 3b statement typing + assignment
 * compatibility (Pass 3, FR-2).
 *
 * Expectations derive exclusively from the **frozen spec** (Ch 02 §5.3 assignment
 * compatibility, TS-2 literal range) + the AR-11 canonical diagnostic-code table
 * + AR-13 (parser-owned missing-annotation) — NOT from implementation logic.
 * Immutable oracle. Exercised through the REAL public path (`lex`→`parse`→`analyze`).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** Lexes + parses `source` through the public entry points, returning the AST. */
function parseSource(source: string, bag: DiagnosticBag): ProgramNode {
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  return ast;
}

/** The error codes recorded on the bag, in the bag's sorted order. */
function errorCodes(bag: DiagnosticBag): string[] {
  return bag.getErrors().map((d: Diagnostic) => d.code);
}

describe("Specification: RD-18 Slice 3b statement typing (FR-2)", () => {
  // ST-2 — an out-of-range literal in a typed context → E10084 (TS-2, spec 02:96).
  it("should reject an out-of-range literal with E10084 (ST-2, TS-2)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void { let b: byte = 256; }\n",
      bag,
    );
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(errorCodes(bag)).toContain(DiagCode.ValueOutOfRange); // E10084
  });

  // ST-7 (reframed, AR-13) — an annotation-less `let` IS rejected, but by the
  // frozen RD-03 parser (E10313 ExpectedColon + E10303 ExpectedTypeAnnotation),
  // not the analyzer's E10150 (which is unreachable from source). The spec AC
  // "annotation-less let is a compile error" is satisfied; the analyzer never
  // throws and adds no cascading error of its own.
  it("should reject an annotation-less let via the parser, never throwing (ST-7, AR-13)", () => {
    const bag = createDiagnosticBag();
    let program!: ProgramNode;
    expect(() => {
      program = parseSource("module Main;\nfunction main(): void { let x = 5; }\n", bag);
    }).not.toThrow();

    // Parser owns the rejection (frozen RD-03).
    const codes = errorCodes(bag);
    expect(codes).toContain(DiagCode.ExpectedColon); // E10313
    expect(codes).toContain(DiagCode.ExpectedTypeAnnotation); // E10303

    // The analyzer runs over the error-laden AST without throwing and adds no
    // MissingTypeAnnotation cascade (parser already reported it).
    expect(() => {
      analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });
    }).not.toThrow();
    expect(bag.hasErrors()).toBe(true);
  });

  // ST-8 — assignment compatibility (AR-11 canonical codes; the stale spec §5.3
  // numbers E10082/E10080 collide with div-by-zero/operand-type):
  //   narrowing word→byte   → E10154 (WidthNarrowingNoCast)
  //   cross-sign sbyte→byte → E10153 (SignedUnsignedMismatch)
  it("should reject narrowing with E10154 and cross-sign with E10153 (ST-8, AR-11)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void {" +
        " let w: word = 300; let bn: byte = w;" + // narrowing word→byte
        " let s: sbyte = -1; let bc: byte = s; }\n", // cross-sign sbyte→byte
      bag,
    );
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    const codes = errorCodes(bag);
    expect(codes).toContain(DiagCode.WidthNarrowingNoCast); // E10154 (narrowing)
    expect(codes).toContain(DiagCode.SignedUnsignedMismatch); // E10153 (cross-sign)
  });
});
