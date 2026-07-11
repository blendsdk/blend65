/**
 * Specification tests for the unified const/type evaluation engine (frozen
 * spec Ch 02 TS-21, Ch 03 VAR-6, Ch 07 SR-2/SR-6/SR-7, Ch 08 §2.2/§4/§9,
 * Ch 12 §3.3):
 *
 * - Array sizes are constant expressions that may reference module constants
 *   and `sizeof`/`length` query results, independent of declaration order.
 * - Struct layouts, enum values, and module constants form one mutually
 *   recursive evaluation domain: any definition cycle is rejected with ONE
 *   path-carrying diagnostic — E10165 for a pure struct-field cycle, E10194
 *   when a constant participates.
 * - Const arrays must be fully initialised (E10113) with compile-time
 *   constant elements (E10193); their images encode words little-endian.
 * - `sizeof`/`offsetof`/`length` fold to compile-time constants typed by
 *   representability: value ≤255 → byte, ≥256 → word.
 *
 * Expectations derive from the frozen spec chapters — never from the
 * implementation.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode, SemanticModel, Symbol } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

/** Lexes + parses each source (ids 1..n) + analyzes them together. */
function analyzeMulti(sources: readonly string[]): {
  diags: Diagnostic[];
  model: SemanticModel;
  programs: ProgramNode[];
} {
  const bag: DiagnosticBag = createDiagnosticBag();
  const programs = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  return { diags: bag.getAll(), model, programs };
}

/** The codes of all error-severity diagnostics. */
function errorCodes(diags: readonly Diagnostic[]): string[] {
  return diags.filter((d) => d.severity === "error").map((d) => d.code);
}

/** Finds a module-scope symbol by name across all module scopes. */
function moduleSymbol(model: SemanticModel, name: string): Symbol | undefined {
  for (const scope of model.globalScope.children) {
    if (scope.kind !== "module") continue;
    const sym = scope.symbols.get(name);
    if (sym !== undefined && sym.scope === scope) return sym;
  }
  return undefined;
}

const MAIN_FN = "function main(): void { }\n";

describe("Specification: unified const/type engine", () => {
  it("ST-17: a const-expression array size `byte[N * 2 + 2]` sizes the array", () => {
    const src = `module Main;\nconst N: byte = 3;\nlet a: byte[N * 2 + 2];\n${MAIN_FN}`;
    const { diags, model } = analyzeMulti([src]);
    expect(diags).toEqual([]);
    const a = moduleSymbol(model, "a");
    expect(a?.type.kind).toBe("array");
    if (a?.type.kind === "array") expect(a.type.size).toBe(8);
  });

  it("ST-18: `byte[sizeof(P)]` sizes from the packed struct layout (no padding)", () => {
    const src = `module Main;\nstruct P { x: byte; y: word; }\nlet a: byte[sizeof(P)];\n${MAIN_FN}`;
    const { diags, model } = analyzeMulti([src]);
    expect(diags).toEqual([]);
    const a = moduleSymbol(model, "a");
    if (a?.type.kind === "array") expect(a.type.size).toBe(3);
    else throw new Error("expected an array-typed symbol");
  });

  it("ST-19: declaration order does not matter — const AFTER the array using it", () => {
    const src = `module Main;\nlet a: byte[N * 2 + 2];\nconst N: byte = 3;\n${MAIN_FN}`;
    const { diags, model } = analyzeMulti([src]);
    expect(diags).toEqual([]);
    const a = moduleSymbol(model, "a");
    if (a?.type.kind === "array") expect(a.type.size).toBe(8);
    else throw new Error("expected an array-typed symbol");
  });

  it("ST-20: a const↔layout cycle is ONE E10194 whose path names both participants", () => {
    const src = `module Main;\nconst N: byte = sizeof(S);\nstruct S { a: byte[N]; }\n${MAIN_FN}`;
    const { diags } = analyzeMulti([src]);
    const cycles = diags.filter((d) => d.code === DiagCode.CircularInit);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.message).toContain("N");
    expect(cycles[0]!.message).toContain("S");
    expect(diags.filter((d) => d.code === DiagCode.RecursiveStructLayout)).toHaveLength(0);
  });

  it("ST-10: an indirect struct cycle is ONE E10165 with the path `A → B → A`", () => {
    const src = `module Main;\nstruct A { b: B; }\nstruct B { a: A; }\n${MAIN_FN}`;
    const { diags } = analyzeMulti([src]);
    const cycles = diags.filter((d) => d.code === DiagCode.RecursiveStructLayout);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.message).toContain("A");
    expect(cycles[0]!.message).toContain("B");
  });

  it("ST-11: a self-referential struct is ONE E10165 (a one-element cycle)", () => {
    const src = `module Main;\nstruct S { s: S; }\n${MAIN_FN}`;
    const { diags } = analyzeMulti([src]);
    expect(diags.filter((d) => d.code === DiagCode.RecursiveStructLayout)).toHaveLength(1);
  });

  it("ST-21: a zero size is E10111 and a runtime size is E10110", () => {
    const zero = `module Main;\nlet a: byte[0];\n${MAIN_FN}`;
    expect(errorCodes(analyzeMulti([zero]).diags)).toContain(DiagCode.ArraySizeZero);

    const runtime = `module Main;\nlet n: byte = 3;\nlet a: byte[n];\n${MAIN_FN}`;
    expect(errorCodes(analyzeMulti([runtime]).diags)).toContain(DiagCode.ArraySizeNotConst);
  });

  it("ST-22: a partially-initialised const array without fill is E10113", () => {
    const src = `module Main;\nconst T: byte[4] = [1, 2];\n${MAIN_FN}`;
    expect(errorCodes(analyzeMulti([src]).diags)).toContain(DiagCode.ConstArrayNotFullyInit);
  });

  it("ST-23: a non-constant const-array element is E10193", () => {
    const src = `module Main;\nlet x: byte = 1;\nconst T: byte[2] = [1, x];\n${MAIN_FN}`;
    expect(errorCodes(analyzeMulti([src]).diags)).toContain(DiagCode.NonConstInit);
  });

  it("ST-24: a const word-array image encodes little-endian (`34 12 05 00`)", () => {
    const src = `module Main;\nconst W: word[2] = [$1234, 5];\n${MAIN_FN}`;
    const { diags, model } = analyzeMulti([src]);
    expect(diags).toEqual([]);
    const w = moduleSymbol(model, "W");
    expect(w).toBeDefined();
    const image = model.constValues.get(w!);
    expect(image).toBeDefined();
    expect(image!.bytes).toBeDefined();
    expect([...image!.bytes!]).toEqual([0x34, 0x12, 0x05, 0x00]);
  });

  it("ST-25: length/offsetof/sizeof fold in const initialisers and size positions", () => {
    const src =
      "module Main;\n" +
      "struct Point { x: byte; y: byte; }\n" +
      "enum Direction { UP, DOWN }\n" +
      "const TABLE: byte[6] = [1, 2, 3; 0];\n" +
      "const L: byte = length(TABLE);\n" +
      "const O: byte = offsetof(Point, y);\n" +
      "const S: byte = sizeof(Direction);\n" +
      "let buf: byte[length(TABLE)];\n" +
      MAIN_FN;
    const { diags, model } = analyzeMulti([src]);
    expect(diags).toEqual([]);
    expect(model.constValues.get(moduleSymbol(model, "L")!)?.value).toBe(6);
    expect(model.constValues.get(moduleSymbol(model, "O")!)?.value).toBe(1);
    expect(model.constValues.get(moduleSymbol(model, "S")!)?.value).toBe(1);
    const buf = moduleSymbol(model, "buf");
    if (buf?.type.kind === "array") expect(buf.type.size).toBe(6);
    else throw new Error("expected an array-typed symbol");
  });

  it("ST-26: `let n: byte = length(a);` on a 10-element array types byte (value-dependent)", () => {
    const src =
      "module Main;\n" +
      "let a: byte[10];\n" +
      "function main(): void { let n: byte = length(a); }\n";
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
  });

  it("ST-26a: `length` on byte[255] stays byte-typed (boundary, representable)", () => {
    const src =
      "module Main;\n" +
      "let b: byte[255];\n" +
      "function main(): void { let n: byte = length(b); }\n";
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
  });

  it("ST-26b: `length` on byte[256] folds to 256, types word, and narrows only with a cast", () => {
    const src =
      "module Main;\n" +
      "let b: byte[256];\n" +
      "function main(): void { let n: byte = length(b); }\n";
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toContain(DiagCode.WidthNarrowingNoCast);

    const wide =
      "module Main;\n" +
      "let b: byte[256];\n" +
      "function main(): void { let n: word = length(b); }\n";
    expect(errorCodes(analyzeMulti([wide]).diags)).toEqual([]);
  });
});
