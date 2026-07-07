/**
 * Specification tests for RD-18 Slice 4a for-loop bound/step/counter safety —
 * end-bound range (E10064), step positivity (E10061), and counter-type integrity
 * (E10065).
 *
 * Expectations derive EXCLUSIVELY from the frozen spec Ch 05 (§7.2.1 end-bound,
 * §7.3 step, §7.4 counter type), the requirements (FR-3/FR-4), and the Ambiguity
 * Register (AR-8/AR-10/AR-15) — NEVER from reading the implementation (immutable
 * oracle). Exercised through the REAL public path (`lex`→`parse`→`analyze`).
 *
 * Traces: ST-6 (§7.2.1), ST-7 (§7.3), ST-24 (§7.4 / AR-15).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** Lexes + parses + analyzes `source`; returns the recorded error codes. */
function analyzeSource(source: string): string[] {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: SRC, bag });
  analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return bag.getErrors().map((d: Diagnostic) => d.code);
}

describe("Specification: RD-18 Slice 4a for-loop end-bound range (FR-4, ST-6)", () => {
  // ST-6 — a const end-bound out of the counter type's range → E10064.
  it("should reject a byte for-loop whose end bound is 300 with E10064", () => {
    expect(
      analyzeSource("module Main;\nfunction main(): void { for (let i: byte = 0 to 300) {} }\n"),
    ).toContain(DiagCode.ForEndBoundOutOfRange); // E10064
  });
  it("should accept an in-range byte for-loop end bound (200)", () => {
    expect(
      analyzeSource("module Main;\nfunction main(): void { for (let i: byte = 0 to 200) {} }\n"),
    ).not.toContain(DiagCode.ForEndBoundOutOfRange);
  });
});

describe("Specification: RD-18 Slice 4a for-loop step positivity (FR-4, ST-7)", () => {
  // ST-7 — a zero step → E10061; a positive const step → none; a non-const step → E10061.
  it("should reject a zero step with E10061", () => {
    expect(
      analyzeSource(
        "module Main;\nfunction main(): void { for (let i: byte = 0 to 9 step 0) {} }\n",
      ),
    ).toContain(DiagCode.StepValueNotPositive); // E10061
  });
  it("should accept a positive const step (2)", () => {
    expect(
      analyzeSource(
        "module Main;\nfunction main(): void { for (let i: byte = 0 to 9 step 2) {} }\n",
      ),
    ).not.toContain(DiagCode.StepValueNotPositive);
  });
  it("should reject a non-const step with E10061", () => {
    expect(
      analyzeSource(
        "module Main;\nlet s: byte;\nfunction main(): void { for (let i: byte = 0 to 9 step s) {} }\n",
      ),
    ).toContain(DiagCode.StepValueNotPositive);
  });
});

describe("Specification: RD-18 Slice 4a for-counter type (FR-3, ST-24 / AR-15)", () => {
  // ST-24 — a missing OR non-integer counter type → E10065 (no throw, no silent pass).
  it("should reject a for-counter with no type annotation with E10065", () => {
    expect(
      analyzeSource("module Main;\nfunction main(): void { for (let i = 0 to 5) {} }\n"),
    ).toContain(DiagCode.ForCounterTypeNotInteger); // E10065
  });
  it("should reject a boolean-typed for-counter with E10065", () => {
    expect(
      analyzeSource("module Main;\nfunction main(): void { for (let i: boolean = 0 to 5) {} }\n"),
    ).toContain(DiagCode.ForCounterTypeNotInteger);
  });
  it("should accept an integer (byte) for-counter type (no E10065)", () => {
    expect(
      analyzeSource("module Main;\nfunction main(): void { for (let i: byte = 0 to 5) {} }\n"),
    ).not.toContain(DiagCode.ForCounterTypeNotInteger);
  });
});
