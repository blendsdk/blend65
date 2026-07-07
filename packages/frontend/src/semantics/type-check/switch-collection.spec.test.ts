/**
 * Specification tests for RD-18 Slice 4b switch body handling — case/default body
 * locals collected flat into the enclosing function scope (E10100 absence), and
 * `break`/`continue` transparency (a `break` inside a switch targets the enclosing
 * loop, not the switch — Swift model, spec §9).
 *
 * Expectations derive EXCLUSIVELY from the requirements (FR-8/FR-9) + the Ambiguity
 * Register (AR-6/AR-12) — NEVER from reading the implementation (immutable oracle).
 * Exercised through the REAL public path (`lex`→`parse`→`analyze`).
 *
 * Traces: ST-9 (FR-8/AR-12), ST-10 (FR-9/AR-6).
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

describe("Specification: RD-18 Slice 4b case-body locals (FR-8/AR-12)", () => {
  // ST-9 — a `let z` declared in a case body is collected flat into the function
  // scope, so a reference to it AFTER the switch resolves (no E10100). Before the
  // collector recurses switch bodies, `z` is uncollected → the later ref is
  // undeclared (E10100); the collection recursion closes that.
  it("should collect a case-body local into the function scope (ST-9)", () => {
    const src =
      "module Main;\n" +
      "let sink: byte;\n" +
      "function main(): void {\n" +
      "  let x: byte = 1;\n" +
      "  switch (x) {\n" +
      "    case 1:\n" +
      "      let z: byte = 5;\n" +
      "    default:\n" +
      "      x = 0;\n" +
      "  }\n" +
      "  sink = z;\n" +
      "}\n";
    expect(analyzeAll(src)).not.toContain(DiagCode.UndeclaredIdentifier); // E10100
  });
});

describe("Specification: RD-18 Slice 4b break/continue transparency (FR-9/AR-6)", () => {
  // ST-10 — a `break` inside a `switch` inside a `while` is accepted: it targets the
  // enclosing loop (the switch does not raise the loop depth), so no E10130.
  it("should accept a break inside a switch inside a while (ST-10)", () => {
    const src =
      "module Main;\n" +
      "function main(): void {\n" +
      "  let n: byte = 1;\n" +
      "  while (n > 0) {\n" +
      "    switch (n) {\n" +
      "      case 1:\n" +
      "        break;\n" +
      "      default:\n" +
      "        n = 0;\n" +
      "    }\n" +
      "    n = n - 1;\n" +
      "  }\n" +
      "}\n";
    expect(analyzeAll(src)).not.toContain(DiagCode.BreakOutsideLoopSwitch); // E10130
  });
});
