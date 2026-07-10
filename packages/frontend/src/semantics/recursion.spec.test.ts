/**
 * Specification tests for recursion rejection — static frame allocation
 * cannot support recursion, so every call cycle is rejected with exactly one
 * E10174 whose message carries the full cycle path.
 *
 * Expectations derive from the frozen spec Ch 06 (no-recursion rule and its
 * cycle-path rendering) — never from the implementation. Exercised through
 * the real public path (`lex`→`parse`→`analyze`).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

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

describe("Specification: recursion rejection", () => {
  it("should reject direct recursion with exactly one E10174 carrying the 'f → f' path", () => {
    const src =
      "module Main;\n" +
      "function f(n: byte): byte { return f(n); }\n" +
      "function main(): void {}\n";
    const recursion = analyzeDiags(src).filter((d) => d.code === DiagCode.RecursionDetected);
    expect(recursion).toHaveLength(1);
    expect(recursion[0].message).toContain("f → f");
  });

  it("should reject indirect recursion with ONE E10174 per cycle carrying the full path", () => {
    const src =
      "module Main;\n" +
      "function ping(): void { pong(); }\n" +
      "function pong(): void { ping(); }\n" +
      "function main(): void {}\n";
    const recursion = analyzeDiags(src).filter((d) => d.code === DiagCode.RecursionDetected);
    expect(recursion).toHaveLength(1);
    expect(recursion[0].message).toContain("ping → pong → ping");
  });

  it("should accept a call chain without cycles silently", () => {
    const src =
      "module Main;\n" +
      "function leaf(): void {}\n" +
      "function mid(): void { leaf(); }\n" +
      "function main(): void { mid(); leaf(); }\n";
    expect(analyzeDiags(src)).toEqual([]);
  });
});
