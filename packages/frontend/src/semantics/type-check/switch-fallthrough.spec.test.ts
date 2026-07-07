/**
 * Specification tests for `fallthrough` validation — position (E10074: must be
 * the last statement of a case body, never nested in an inner block) and
 * no-effect (E10073 warning: a `fallthrough` in the last clause has nothing
 * to fall into).
 *
 * Expectations derive EXCLUSIVELY from the frozen spec Ch 05 §8.3 + `F009` —
 * NEVER from reading the implementation (immutable oracle). Exercised through
 * the REAL public path (`lex`→`parse`→`analyze`).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** Lexes + parses + analyzes `source`; returns every recorded diagnostic. */
function analyzeDiagnostics(source: string): Diagnostic[] {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: SRC, bag });
  analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return bag.getAll();
}

describe("Specification: RD-18 Slice 4b fallthrough position (FR-6)", () => {
  // `fallthrough` that is not the last statement of a case body → E10074.
  it("should reject a fallthrough followed by another statement with E10074 (ST-6)", () => {
    const src =
      "module Main;\n" +
      "function main(): void {\n" +
      "  let x: byte = 1;\n" +
      "  switch (x) {\n" +
      "    case 1:\n" +
      "      fallthrough;\n" +
      "      x = 10;\n" +
      "    default:\n" +
      "      x = 0;\n" +
      "  }\n" +
      "}\n";
    expect(analyzeDiagnostics(src).map((d) => d.code)).toContain(
      DiagCode.FallthroughNotLast, // E10074
    );
  });

  // `fallthrough` nested inside an `if` within a case body → E10074.
  it("should reject a fallthrough nested in an inner block with E10074 (ST-7)", () => {
    const src =
      "module Main;\n" +
      "function main(): void {\n" +
      "  let x: byte = 1;\n" +
      "  switch (x) {\n" +
      "    case 1:\n" +
      "      if (x == 1) {\n" +
      "        fallthrough;\n" +
      "      }\n" +
      "    default:\n" +
      "      x = 0;\n" +
      "  }\n" +
      "}\n";
    expect(analyzeDiagnostics(src).map((d) => d.code)).toContain(
      DiagCode.FallthroughNotLast, // E10074
    );
  });
});

describe("Specification: RD-18 Slice 4b fallthrough no-effect (FR-7)", () => {
  // `fallthrough` as the last statement of the `default` (last) clause →
  // E10073, emitted at WARNING severity (not an error).
  it("should warn (E10073, warning severity) on a fallthrough in the default clause (ST-8)", () => {
    const src =
      "module Main;\n" +
      "function main(): void {\n" +
      "  let x: byte = 1;\n" +
      "  switch (x) {\n" +
      "    case 1:\n" +
      "      x = 10;\n" +
      "    default:\n" +
      "      fallthrough;\n" +
      "  }\n" +
      "}\n";
    const diags = analyzeDiagnostics(src);
    const e10073 = diags.find((d) => d.code === DiagCode.FallthroughNoEffect);
    expect(e10073).toBeDefined();
    expect(e10073?.severity).toBe("warning");
  });
});
