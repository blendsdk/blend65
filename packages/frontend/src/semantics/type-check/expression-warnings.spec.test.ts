/**
 * Specification tests for the expression-level warnings that need no constant
 * folding: possible intermediate overflow before widening (TS-9) and a
 * constant shift amount that meets or exceeds the operand width (Ch 04 §4).
 *
 * Expectations derive exclusively from the frozen spec and the canonical
 * diagnostic-code registry — NOT from implementation logic. Immutable oracle.
 * Codes are asserted by their frozen numeric strings.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** Result bundle of one full `lex → parse → analyze` run. */
interface Analyzed {
  program: ProgramNode;
  bag: DiagnosticBag;
}

/** Runs `source` through the public pipeline and returns AST + bag. */
function analyzeSource(source: string): Analyzed {
  const bag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return { program: ast, bag };
}

/** The warning codes recorded on the bag, in the bag's sorted order. */
function warningCodes(bag: DiagnosticBag): string[] {
  return bag.getWarnings().map((d: Diagnostic) => d.code);
}

/** Wraps `body` statements in the standard single-module `main` fixture. */
function inMain(body: string): string {
  return `module Main;\nfunction main(): void { ${body} }\n`;
}

describe("Specification: intermediate-overflow warning (TS-9)", () => {
  it("should warn when narrow runtime arithmetic widens into a 16-bit target", () => {
    const { bag } = analyzeSource(
      inMain("let a: byte = 5; let b: byte = 6; let r: word = a + b;"),
    );

    // The program is legal — the diagnostic is advisory only.
    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).toContain("W10160");
  });

  it("should not warn when the arithmetic already happens at the target width", () => {
    const { bag } = analyzeSource(
      inMain("let a: word = 5; let b: word = 6; let r: word = a + b;"),
    );

    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).not.toContain("W10160");
  });

  it("should not warn when a narrow result stays in a narrow target", () => {
    const { bag } = analyzeSource(
      inMain("let a: byte = 5; let b: byte = 6; let r: byte = a + b;"),
    );

    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).not.toContain("W10160");
  });
});

describe("Specification: shift-count-exceeds-width warning (Ch 04 §4)", () => {
  it("should warn when a constant shift amount meets or exceeds the operand width", () => {
    const { bag } = analyzeSource(inMain("let b: byte = 1; let r: byte = b << 9;"));

    // Still compiles: the result is well-defined (always zero), so the
    // diagnostic is a warning, not an error.
    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).toContain("W10174");
  });

  it("should not warn for a constant shift amount below the operand width", () => {
    const { bag } = analyzeSource(inMain("let b: byte = 1; let r: byte = b << 7;"));

    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).not.toContain("W10174");
  });
});
