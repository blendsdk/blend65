/**
 * Specification tests for Pass 4 — `main()` validity.
 *
 * Expectations derive exclusively from the **frozen spec** (Ch 06 entry point /
 * F004) and the entry-point rule — NOT from implementation logic. Immutable
 * oracle. Exercised through the REAL public path (`lex`→`parse`→`analyze`);
 * assertions read the diagnostic bag.
 *
 * Gating: E10020 (no `main`) fires only when ≥1 function was collected,
 * no `main` exists, and there are no upstream parse errors — so empty /
 * unparseable / function-free inputs stay silent (the passthrough contract
 * preserved).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

/** The synthetic source id used by every parse in this file. */
let nextSrc = 1;

/** Lexes + parses `source` through the public entry points, returning the AST. */
function parseSource(source: string, bag: DiagnosticBag): ProgramNode {
  const src = nextSrc++;
  const { tokens } = lex(src, source, bag);
  const { ast } = parse({ tokens, source, sourceId: src, bag });
  return ast;
}

/** The error codes recorded on the bag, in the bag's sorted order. */
function errorCodes(bag: DiagnosticBag): string[] {
  return bag.getErrors().map((d: Diagnostic) => d.code);
}

describe("Specification: RD-18 Slice 3b post-check — main() validity (FR-5)", () => {
  // A program with functions but no `main` → E10020.
  it("should report a missing main with E10020 (ST-10, R66)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource("module Main;\nfunction foo(): void { }\n", bag);
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(errorCodes(bag)).toContain(DiagCode.NoMainFunction); // E10020
  });

  // Two `main` functions (across modules) → E10021.
  it("should report multiple main with E10021 (ST-10, R66)", () => {
    const bag = createDiagnosticBag();
    const a = parseSource("module A;\nfunction main(): void { }\n", bag);
    const b = parseSource("module B;\nfunction main(): void { }\n", bag);
    analyze({ programs: [a, b], bag, profile: DEFAULT_PROFILE });

    expect(errorCodes(bag)).toContain(DiagCode.MultipleMainFunctions); // E10021
  });

  // main signature — `main` must be `(): void`; a parameter → E10022 (a
  // spec-designated F004 code, registered additively).
  it("should reject a main with parameters via E10022 (F004, AR-11)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource("module Main;\nfunction main(a: byte): void { }\n", bag);
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(errorCodes(bag)).toContain(DiagCode.InvalidMainSignature); // E10022
  });

  // main signature — a non-void return type also violates `(): void` → E10022.
  it("should reject a main with a non-void return type via E10022 (F004)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource("module Main;\nfunction main(): byte { return 0; }\n", bag);
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(errorCodes(bag)).toContain(DiagCode.InvalidMainSignature); // E10022
  });

  // A valid `function main(): void` is accepted silently (no Pass-4 diagnostic).
  it("should accept a valid main(): void without a Pass-4 error (R66/F004)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource("module Main;\nfunction main(): void { }\n", bag);
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    const codes = errorCodes(bag);
    expect(codes).not.toContain(DiagCode.NoMainFunction);
    expect(codes).not.toContain(DiagCode.MultipleMainFunctions);
    expect(codes).not.toContain(DiagCode.InvalidMainSignature);
  });
});

describe("Specification: RD-18 Slice 4a all-paths-return (FR-6, ST-8)", () => {
  // A non-void function returning on only one path → E10102.
  it("should report a missing return path with E10102 (ST-8, spec Ch05 §4.2)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction f(): byte { let x: byte = 1; if (x > 0) { return 1; } }\nfunction main(): void { }\n",
      bag,
    );
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(errorCodes(bag)).toContain(DiagCode.NotAllPathsReturn); // E10102
  });

  // Negative case — a trailing unconditional return closes every path → no E10102.
  it("should accept a non-void function with a trailing return (ST-8)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction f(): byte { let x: byte = 1; if (x > 0) { return 1; } return 0; }\nfunction main(): void { }\n",
      bag,
    );
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(errorCodes(bag)).not.toContain(DiagCode.NotAllPathsReturn);
  });

  // Negative case — an if/else where both arms return closes every path → no E10102.
  it("should accept a non-void function whose if/else both return (ST-8)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction f(): byte { let x: byte = 1; if (x > 0) { return 1; } else { return 0; } }\nfunction main(): void { }\n",
      bag,
    );
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(errorCodes(bag)).not.toContain(DiagCode.NotAllPathsReturn);
  });
});
