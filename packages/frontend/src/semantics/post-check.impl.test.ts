/**
 * Implementation tests for RD-18 Slice 4a all-paths-return analysis (FR-6, AR-4;
 * 07-testing-strategy P1). Covers the structural `definitelyReturns` edge cases
 * the ST-8 spec case does not exhaust: one-armed `if`, both-arms-return, trailing
 * return, nested if/else chains, and loops (which never guarantee a return).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

const SRC = 1;

function analyzeSource(source: string): string[] {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: SRC, bag });
  analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return bag.getErrors().map((d: Diagnostic) => d.code);
}

/** Wrap a function body in a program that also has a valid `main`. */
function withMain(fn: string): string {
  return `module Main;\n${fn}\nfunction main(): void { }\n`;
}

describe("RD-18 Slice 4a all-paths-return edge cases (E10102)", () => {
  it("flags a one-armed if that falls through", () => {
    expect(
      analyzeSource(withMain("function f(): byte { let x: byte = 1; if (x > 0) { return 1; } }")),
    ).toContain(DiagCode.NotAllPathsReturn);
  });

  it("accepts an if/else where both arms return", () => {
    expect(
      analyzeSource(
        withMain("function f(): byte { if (1 > 0) { return 1; } else { return 0; } }"),
      ),
    ).not.toContain(DiagCode.NotAllPathsReturn);
  });

  it("accepts a plain trailing return", () => {
    expect(
      analyzeSource(withMain("function f(): byte { let x: byte = 1; return x; }")),
    ).not.toContain(DiagCode.NotAllPathsReturn);
  });

  it("accepts a nested if/else chain where every leaf returns", () => {
    expect(
      analyzeSource(
        withMain(
          "function f(): byte { if (1 > 0) { return 1; } else if (1 > 0) { return 2; } else { return 3; } }",
        ),
      ),
    ).not.toContain(DiagCode.NotAllPathsReturn);
  });

  it("flags an if/else-if chain missing a final else", () => {
    expect(
      analyzeSource(
        withMain(
          "function f(): byte { if (1 > 0) { return 1; } else if (1 > 0) { return 2; } }",
        ),
      ),
    ).toContain(DiagCode.NotAllPathsReturn);
  });

  it("does not treat a while loop as a definite return", () => {
    // A loop may run zero times → a body-only return does not close every path.
    expect(
      analyzeSource(
        withMain("function f(): byte { let n: byte = 1; while (n > 0) { return 1; } }"),
      ),
    ).toContain(DiagCode.NotAllPathsReturn);
  });

  it("imposes no obligation on a void function", () => {
    expect(analyzeSource(withMain("function f(): void { let x: byte = 1; }"))).not.toContain(
      DiagCode.NotAllPathsReturn,
    );
  });
});
