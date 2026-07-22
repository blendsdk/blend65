/**
 * Specification tests for the width check on `poke`'s value operand.
 *
 * `poke(addr, value)` stores exactly ONE byte. A value wider than a byte
 * cannot honour that contract without silently splitting into a second
 * store that clobbers the neighbouring address, so the frontend must reject
 * it at compile time:
 *
 * - `word` / `sword` values — in every spelling: a variable, a word-valued
 *   expression, a `peekw(...)` result, a named `word` constant — are a
 *   width narrowing: `E10154`.
 * - `boolean` values are one byte, so a width code would be wrong; they are
 *   a non-numeric KIND mismatch: `E10152`.
 * - `byte`, `sbyte`, byte-backed enum members, and in-range numeric
 *   literals fit a single byte and compile clean.
 *
 * Expectations derive from those rules alone, written before the check
 * exists (red phase). Each case compiles through the REAL lexer + parser +
 * analyzer via the public barrels.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

const SRC = 1;

/** Compiles `source` through the real frontend and returns all diagnostic codes. */
function codes(source: string): string[] {
  const bag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: SRC, bag });
  analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return bag.getAll().map((d) => d.code);
}

/** Wraps a statement list (and optional module-scope decls) in a minimal program. */
function program(body: string, moduleDecls = ""): string {
  return `module Main;\n${moduleDecls}function main(): void { ${body} }\n`;
}

describe("Specification: poke value operand width", () => {
  describe("wide values are a width narrowing (E10154)", () => {
    it("should emit E10154 when the value is a word variable", () => {
      const source = program("let w: word = 300; poke($D020, w);");
      expect(codes(source)).toContain("E10154");
    });

    it("should emit E10154 when the value is a word-valued expression", () => {
      const source = program("let w: word = 300; poke($D020, w + 1);");
      expect(codes(source)).toContain("E10154");
    });

    it("should emit E10154 when the value is a peekw result", () => {
      const source = program("poke($D020, peekw($D000));");
      expect(codes(source)).toContain("E10154");
    });

    it("should emit E10154 when the value is a named word constant", () => {
      const source = program("poke($D020, W);", "const W: word = 300;\n");
      expect(codes(source)).toContain("E10154");
    });
  });

  describe("boolean values are a kind mismatch (E10152), not a width narrowing", () => {
    it("should emit E10152 and not E10154 when the value is a boolean literal", () => {
      const result = codes(program("poke($D020, true);"));
      expect(result).toContain("E10152");
      // A boolean is one byte wide — flagging it as a width narrowing
      // would misdiagnose a kind problem as a size problem.
      expect(result).not.toContain("E10154");
    });
  });

  describe("byte-width values compile clean", () => {
    it("should emit no diagnostics when the value is a byte variable", () => {
      const source = program("let b: byte = 7; poke($D020, b);");
      expect(codes(source)).toEqual([]);
    });

    it("should emit no diagnostics when the value is an sbyte variable (same-width reinterpret)", () => {
      const source = program("let s: sbyte = 7; poke($D020, s);");
      expect(codes(source)).toEqual([]);
    });

    it("should emit no diagnostics when the value is a byte-backed enum member", () => {
      const source = program("poke($D020, Color.White);", "enum Color { Black, White }\n");
      expect(codes(source)).toEqual([]);
    });

    it("should emit no diagnostics when the value is an in-range numeric literal", () => {
      const source = program("poke($D020, 7);");
      expect(codes(source)).toEqual([]);
    });
  });
});
