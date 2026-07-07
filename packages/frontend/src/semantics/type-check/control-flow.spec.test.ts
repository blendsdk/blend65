/**
 * Specification tests for control-flow semantics — condition typing (E10134),
 * loop-context for `break`/`continue` (E10130/E10131), and for-counter scope +
 * nested-body typing.
 *
 * Expectations derive EXCLUSIVELY from the frozen spec Ch 05 (§3 condition typing,
 * §9 break/continue, §7.4 for-counter) — NEVER from reading the implementation
 * (immutable oracle). Exercised through the REAL public path
 * (`lex`→`parse`→`analyze`).
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

describe("Specification: RD-18 Slice 4a condition typing (FR-1)", () => {
  // A non-boolean `if` condition → E10134; an explicit comparison → none.
  it("should reject a non-boolean if-condition with E10134 (ST-1)", () => {
    expect(
      analyzeSource("module Main;\nfunction main(): void { let b: byte = 0; if (b) {} }\n"),
    ).toContain(DiagCode.NonBooleanCondition); // E10134
  });
  it("should accept an explicit comparison if-condition (ST-1)", () => {
    expect(
      analyzeSource("module Main;\nfunction main(): void { let b: byte = 0; if (b != 0) {} }\n"),
    ).not.toContain(DiagCode.NonBooleanCondition);
  });

  // A non-boolean `while` condition → E10134; a comparison → none.
  it("should reject a non-boolean while-condition with E10134 (ST-2)", () => {
    expect(analyzeSource("module Main;\nfunction main(): void { while (5) {} }\n")).toContain(
      DiagCode.NonBooleanCondition,
    );
  });
  it("should accept a comparison while-condition (ST-2)", () => {
    expect(
      analyzeSource(
        "module Main;\nfunction main(): void { let n: byte = 1; while (n > 0) { n = n - 1; } }\n",
      ),
    ).not.toContain(DiagCode.NonBooleanCondition);
  });

  // A non-boolean `do-while` condition → E10134; a comparison → none.
  it("should reject a non-boolean do-while condition with E10134 (ST-3)", () => {
    expect(
      analyzeSource(
        "module Main;\nfunction main(): void { let b: byte = 0; do {} while (b); }\n",
      ),
    ).toContain(DiagCode.NonBooleanCondition);
  });
  it("should accept a comparison do-while condition (ST-3)", () => {
    expect(
      analyzeSource(
        "module Main;\nfunction main(): void { let b: byte = 0; do {} while (b != 0); }\n",
      ),
    ).not.toContain(DiagCode.NonBooleanCondition);
  });
});

describe("Specification: RD-18 Slice 4a loop context (FR-5)", () => {
  // `break`/`continue` outside any loop → E10130 / E10131.
  it("should reject a top-level break with E10130 (ST-4)", () => {
    expect(analyzeSource("module Main;\nfunction main(): void { break; }\n")).toContain(
      DiagCode.BreakOutsideLoopSwitch, // E10130
    );
  });
  it("should reject a top-level continue with E10131 (ST-4)", () => {
    expect(analyzeSource("module Main;\nfunction main(): void { continue; }\n")).toContain(
      DiagCode.ContinueOutsideLoop, // E10131
    );
  });

  // `break`/`continue` inside a loop body → no loop-context error.
  it("should accept break inside a while body (ST-5)", () => {
    const codes = analyzeSource(
      "module Main;\nfunction main(): void { let n: byte = 1; while (n > 0) { break; } }\n",
    );
    expect(codes).not.toContain(DiagCode.BreakOutsideLoopSwitch);
  });
  it("should accept continue inside a for body (ST-5)", () => {
    const codes = analyzeSource(
      "module Main;\nfunction main(): void { for (let i: byte = 0 to 3) { continue; } }\n",
    );
    expect(codes).not.toContain(DiagCode.ContinueOutsideLoop);
  });
});

describe("Specification: RD-18 Slice 4a for-counter scope + body typing (FR-2/FR-3)", () => {
  // The for-counter is in scope in the body (a body read of it is not E10100).
  it("should keep the for-counter in scope in the body (ST-9)", () => {
    const codes = analyzeSource(
      "module Main;\nlet sum: byte;\nfunction main(): void { for (let i: byte = 1 to 3) { sum = sum + i; } }\n",
    );
    expect(codes).not.toContain(DiagCode.UndeclaredIdentifier); // E10100
  });

  // A bad expression inside a loop body IS typed (recursion) → E10100.
  it("should type nested loop-body expressions and report their errors (ST-10)", () => {
    const codes = analyzeSource(
      "module Main;\nlet sum: byte;\nfunction main(): void { for (let i: byte = 1 to 3) { sum = sum + undof; } }\n",
    );
    expect(codes).toContain(DiagCode.UndeclaredIdentifier); // E10100 on `undof`
  });
});
