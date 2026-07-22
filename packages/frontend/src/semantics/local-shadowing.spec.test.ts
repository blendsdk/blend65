/**
 * Specification tests for local-name reuse inside a function body.
 *
 * Reusing a name draws a hard line between two situations:
 *
 * - **Nested reuse (shadowing) is rejected.** A local that shadows a
 *   module-level variable, one of the function's own parameters, or an
 *   in-scope local of an enclosing block hides a live binding and is
 *   diagnosed (`E10101`). Declaring the same name twice in one and the
 *   same scope is a duplicate declaration (`E10003`), and a nested `for`
 *   loop that reuses its enclosing loop's counter name gets its own
 *   loop-specific diagnostic (`E10062`).
 * - **Sibling reuse is legal and silent.** The `if` arm and the `else`
 *   arm (or two sequential loops) each declaring their own `t` never
 *   coexist, so they share one frame slot — the byte-frugal layout a
 *   hand-coder wants. Diagnosing it would reject idiomatic code, so
 *   those programs must compile with NO diagnostic at all.
 *
 * Expectations derive from those rules alone, written before the checks
 * exist (red phase). Each case compiles through the REAL lexer + parser +
 * analyzer via the public barrels.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

const SRC = 1;

/** Compiles `source` through the real frontend and returns all diagnostics. */
function diagnose(source: string): Diagnostic[] {
  const bag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: SRC, bag });
  analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return bag.getAll();
}

/** Compiles `source` and returns just the diagnostic codes. */
function codes(source: string): string[] {
  return diagnose(source).map((d) => d.code);
}

describe("Specification: local shadowing and same-scope reuse", () => {
  describe("nested reuse is shadowing (E10101)", () => {
    it("should emit E10101 when a function local shadows a module-level variable", () => {
      const source = [
        "module Main;",
        "let g: byte = 1;",
        "function main(): void {",
        "  let g: byte = 2;",
        "}",
        "",
      ].join("\n");
      expect(codes(source)).toContain("E10101");
    });

    it("should emit E10101 when a function local shadows one of its own parameters", () => {
      const source = [
        "module Main;",
        "function f(a: byte): void {",
        "  let a: byte = 1;",
        "}",
        "function main(): void {",
        "  f(1);",
        "}",
        "",
      ].join("\n");
      expect(codes(source)).toContain("E10101");
    });

    it("should emit E10101 when a nested-block local shadows an in-scope local of the enclosing block", () => {
      const source = [
        "module Main;",
        "function main(): void {",
        "  let c: boolean = true;",
        "  let t: byte = 1;",
        "  if (c) {",
        "    let t: word = 300;",
        "  }",
        "}",
        "",
      ].join("\n");
      expect(codes(source)).toContain("E10101");
    });
  });

  describe("same-scope reuse is a duplicate declaration (E10003)", () => {
    it("should emit E10003 when two locals share one name in one and the same scope", () => {
      const source = [
        "module Main;",
        "function main(): void {",
        "  let t: byte = 1;",
        "  let t: word = 2;",
        "}",
        "",
      ].join("\n");
      expect(codes(source)).toContain("E10003");
    });
  });

  describe("nested loop-counter reuse (E10062)", () => {
    it("should emit E10062 when a nested for loop reuses its enclosing loop's counter name", () => {
      const source = [
        "module Main;",
        "function main(): void {",
        "  for (let i: byte = 0 to 9) {",
        "    for (let i: byte = 0 to 4) {",
        "    }",
        "  }",
        "}",
        "",
      ].join("\n");
      expect(codes(source)).toContain("E10062");
    });
  });

  describe("sibling reuse is legal and produces no diagnostic", () => {
    it("should compile clean when the if arm and the else arm each declare the same local name", () => {
      // The two `t`s never coexist: they share one frame slot, and
      // diagnosing the reuse would reject idiomatic byte-frugal code.
      const source = [
        "module Main;",
        "function main(): void {",
        "  let c: boolean = true;",
        "  if (c) {",
        "    let t: word = 300;",
        "  } else {",
        "    let t: byte = 5;",
        "  }",
        "}",
        "",
      ].join("\n");
      const cs = codes(source);
      expect(cs).not.toContain("E10101");
      expect(cs).not.toContain("E10003");
      expect(cs).not.toContain("E10062");
      expect(cs).toEqual([]);
    });

    it("should compile clean when two sequential for loops reuse one counter name as siblings", () => {
      // The loop-counter diagnostic is for NESTED reuse only — sibling
      // counters are exactly the slot-sharing case the layout wants.
      const source = [
        "module Main;",
        "function main(): void {",
        "  for (let i: byte = 0 to 9) {",
        "  }",
        "  for (let i: word = 0 to 9) {",
        "  }",
        "}",
        "",
      ].join("\n");
      const cs = codes(source);
      expect(cs).not.toContain("E10101");
      expect(cs).not.toContain("E10003");
      expect(cs).not.toContain("E10062");
      expect(cs).toEqual([]);
    });
  });
});
