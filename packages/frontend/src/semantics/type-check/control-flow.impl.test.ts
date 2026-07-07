/**
 * Implementation tests for control-flow semantics — loop-context depth
 * tracking and const-vs-non-const for-bound handling. These cover
 * internals/edges the specification test cases do not pin.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";

const SRC = 1;

function analyzeSource(source: string): string[] {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: SRC, bag });
  analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return bag.getErrors().map((d: Diagnostic) => d.code);
}

describe("RD-18 Slice 4a loop-depth tracking", () => {
  it("accepts break/continue in a nested inner loop", () => {
    const codes = analyzeSource(
      "module Main;\nfunction main(): void { let a: byte = 1; let b: byte = 1;" +
        " while (a > 0) { while (b > 0) { break; continue; } } }\n",
    );
    expect(codes).not.toContain(DiagCode.BreakOutsideLoopSwitch);
    expect(codes).not.toContain(DiagCode.ContinueOutsideLoop);
  });

  it("accepts a break guarded by an if inside a loop (if does not change depth)", () => {
    const codes = analyzeSource(
      "module Main;\nfunction main(): void { let a: byte = 1;" +
        " while (a > 0) { if (a > 0) { break; } } }\n",
    );
    expect(codes).not.toContain(DiagCode.BreakOutsideLoopSwitch);
  });

  it("rejects a break AFTER a loop closes (depth is lexically scoped, not global)", () => {
    // The `break` is a sibling of the while, back at depth 0 → E10130.
    const codes = analyzeSource(
      "module Main;\nfunction main(): void { let a: byte = 1;" +
        " while (a > 0) { a = a - 1; } break; }\n",
    );
    expect(codes).toContain(DiagCode.BreakOutsideLoopSwitch);
  });
});

describe("RD-18 Slice 4a const-vs-non-const for-bound (AR-10)", () => {
  it("skips the E10064 range check for a non-const end bound", () => {
    // A variable end bound is allowed (runtime compare) — no range check, no throw.
    const codes = analyzeSource(
      "module Main;\nlet n: byte;\nfunction main(): void { for (let i: byte = 0 to n) {} }\n",
    );
    expect(codes).not.toContain(DiagCode.ForEndBoundOutOfRange);
  });

  it("still range-checks a const end bound expressed as an arithmetic fold", () => {
    // 200 + 100 = 300, out of byte range → E10064 (evalConst folds the binary).
    const codes = analyzeSource(
      "module Main;\nfunction main(): void { for (let i: byte = 0 to 200 + 100) {} }\n",
    );
    expect(codes).toContain(DiagCode.ForEndBoundOutOfRange);
  });
});
