/**
 * Specification tests for aggregate expression typing (frozen spec Ch 02
 * §334 cast table, Ch 04 §5.3, Ch 07 §4/§5, Ch 08 §3/§5/§6, Ch 09 §5-§8):
 * indexing, member access, struct/array literals, enum semantics
 * (assignability/casts/comparisons), the aggregate function boundary,
 * switch-on-enum, and the array-initialisation warnings.
 *
 * Expectations derive from the frozen spec chapters — never from the
 * implementation. Exercised through the real public path
 * (`lex`→`parse`→`analyze`).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode, isIceCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode, SemanticModel } from "@blend65/core";
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

/** Wraps statements in `module Main; …decls… function main(): void { body }`. */
function program(decls: string, body: string): string {
  return `module Main;\n${decls}\nfunction main(): void {\n${body}\n}\n`;
}

describe("Specification: indexing (ST-27..ST-32)", () => {
  it("ST-27: `a[i]` on byte[10] with a byte index reads and writes the element type", () => {
    const src = program(
      "let a: byte[10];",
      "let i: byte = 2;\na[i] = 7;\nlet v: byte = a[i];",
    );
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
  });

  it("ST-28: a word index on a tier-1 (≤256 B) array is E10117, suggesting a byte cast", () => {
    const src = program("let a: byte[10];", "let w: word = 1;\nlet v: byte = a[w];");
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toContain(DiagCode.WordIndexOnSmallArray);
    const e = diags.find((d) => d.code === DiagCode.WordIndexOnSmallArray);
    expect(e!.message).toContain("<byte>");
  });

  it("ST-29: signed and boolean indexes are E10114", () => {
    const signed = program("let a: byte[10];", "let s: sbyte = 1;\nlet v: byte = a[s];");
    expect(errorCodes(analyzeMulti([signed]).diags)).toContain(DiagCode.ArrayIndexTypeMismatch);

    const bool = program("let a: byte[10];", "let v: byte = a[true];");
    expect(errorCodes(analyzeMulti([bool]).diags)).toContain(DiagCode.ArrayIndexTypeMismatch);
  });

  it("ST-30: a constant index outside 0..size-1 is E10115 with both numbers", () => {
    const src = program("let a: byte[10];", "let v: byte = a[12];");
    const { diags } = analyzeMulti([src]);
    const e = diags.find((d) => d.code === DiagCode.StaticIndexOutOfBounds);
    expect(e).toBeDefined();
    expect(e!.message).toContain("12");
    expect(e!.message).toContain("10");
  });

  it("ST-31: indexing a non-array and member access on a non-struct are E10080", () => {
    const index = program("", "let x: byte = 1;\nlet v: byte = x[0];");
    expect(errorCodes(analyzeMulti([index]).diags)).toContain(DiagCode.InvalidOperandType);

    const member = program("", "let x: word = 1;\nlet v: byte = x.f;");
    expect(errorCodes(analyzeMulti([member]).diags)).toContain(DiagCode.InvalidOperandType);
  });

  it("ST-32: a >256-byte array declaration compiles with the tier-2 advisory (W10142)", () => {
    // RETIRED ROW, superseded: this row originally pinned the interim loud
    // rejection of >256-byte arrays ("not supported yet — they need
    // pointer-tier indexing"). The pointer tier now exists, so the spec's
    // real behavior applies: the declaration is legal and carries the
    // tier-overhead advisory (Ch 08 AR-3).
    const src = program("let big: byte[300];", "");
    const { diags } = analyzeMulti([src]);
    expect(diags.some((d) => isIceCode(d.code))).toBe(false);
    expect(errorCodes(diags)).toEqual([]);
    expect(diags.some((d) => d.code === DiagCode.Tier2Overhead)).toBe(true);
  });
});

describe("Specification: member access & literals (ST-33..ST-38)", () => {
  const GFX =
    "struct Pos { x: byte; y: byte; }\nstruct Player { pos: Pos; hp: byte; }\n";

  it("ST-33: nested member write/read `player.pos.x` types every link", () => {
    const src = program(GFX + "let player: Player;", "player.pos.x = 5;\nlet v: byte = player.pos.x;");
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
  });

  it("ST-34: an unknown field is E10160", () => {
    const src = program(GFX + "let player: Player;", "let v: byte = player.mana;");
    expect(errorCodes(analyzeMulti([src]).diags)).toContain(DiagCode.UnknownField);
  });

  it("ST-35: struct-literal fields out of declaration order are E10097", () => {
    const src = program("struct Point { x: byte; y: byte; }", "let p: Point = Point { y: 2, x: 1 };");
    expect(errorCodes(analyzeMulti([src]).diags)).toContain(DiagCode.StructInitFieldOrder);
  });

  it("ST-36: a missing field is E10161 and an extra field is E10162", () => {
    const missing = program("struct Point { x: byte; y: byte; }", "let p: Point = Point { x: 1 };");
    expect(errorCodes(analyzeMulti([missing]).diags)).toContain(DiagCode.MissingFieldInInit);

    const extra = program(
      "struct Point { x: byte; y: byte; }",
      "let p: Point = Point { x: 1, y: 2, z: 3 };",
    );
    expect(errorCodes(analyzeMulti([extra]).diags)).toContain(DiagCode.ExtraFieldInInit);
  });

  it("ST-37: more elements than the declared size is the assignment mismatch", () => {
    const src = program("", "let a: byte[3] = [1, 2, 3, 4];");
    expect(errorCodes(analyzeMulti([src]).diags)).toContain(DiagCode.TypeMismatchAssignment);
  });

  it("ST-38: a fill without an explicit declared size is E10126", () => {
    const src = program("", "let a: byte[] = [1; 0];");
    expect(errorCodes(analyzeMulti([src]).diags)).toContain(DiagCode.FillRequiresExplicitSize);
  });
});

describe("Specification: aggregate operators & enums (ST-39..ST-43)", () => {
  const DIR = "enum Direction { UP, DOWN = 3, LEFT, RIGHT }\n";

  it("ST-39: whole-array assignment is E10119 and array comparison is E10121", () => {
    const assign = program("let a: byte[3];\nlet b: byte[3];", "a = b;");
    expect(errorCodes(analyzeMulti([assign]).diags)).toContain(DiagCode.ArrayAssignmentNotAllowed);

    const compare = program("let a: byte[3];\nlet b: byte[3];", "let e: boolean = a == b;");
    expect(errorCodes(analyzeMulti([compare]).diags)).toContain(DiagCode.ArrayComparisonNotAllowed);
  });

  it("ST-40: same-struct assignment is a copy (OK); struct comparison is E10080", () => {
    const S = "struct P { x: byte; y: byte; }\nlet a: P;\nlet b: P;";
    const assign = program(S, "b = a;");
    expect(errorCodes(analyzeMulti([assign]).diags)).toEqual([]);

    const compare = program(S, "let e: boolean = a == b;");
    expect(errorCodes(analyzeMulti([compare]).diags)).toContain(DiagCode.InvalidOperandType);
  });

  it("ST-41: byte→enum is not implicit (E10152); enum→byte is the ONLY implicit", () => {
    const bad = program(DIR, "let d: Direction = 0;");
    expect(errorCodes(analyzeMulti([bad]).diags)).toContain(DiagCode.TypeMismatchAssignment);

    const good = program(DIR, "let d: Direction = Direction.DOWN;\nlet b: byte = d;");
    expect(errorCodes(analyzeMulti([good]).diags)).toEqual([]);
  });

  it("ST-42: single-step enum casts are legal; enum→enum cross-casts are E10155", () => {
    const casts = program(
      DIR,
      "let d: Direction = Direction.UP;\nlet w: word = <word>(d);\nlet e: Direction = <Direction>(9);",
    );
    expect(errorCodes(analyzeMulti([casts]).diags)).toEqual([]);

    const cross = program(
      DIR + "enum Other { A, B }",
      "let d: Direction = Direction.UP;\nlet o: Other = <Other>(d);",
    );
    expect(errorCodes(analyzeMulti([cross]).diags)).toContain(DiagCode.InvalidCast);
  });

  it("ST-43: cross-enum comparison is E10080; same-enum ordered comparison is OK", () => {
    const cross = program(
      DIR + "enum Other { A, B }",
      "let d: Direction = Direction.UP;\nlet o: Other = Other.A;\nlet e: boolean = d == o;",
    );
    expect(errorCodes(analyzeMulti([cross]).diags)).toContain(DiagCode.InvalidOperandType);

    const ordered = program(
      DIR,
      "let d: Direction = Direction.UP;\nlet e: boolean = d < Direction.LEFT;",
    );
    expect(errorCodes(analyzeMulti([ordered]).diags)).toEqual([]);
  });
});

describe("Specification: the aggregate function boundary (ST-44, ST-44a, ST-44b)", () => {
  it("ST-44: struct returns are E10093, array returns E10120, aggregate params compile (by-ref)", () => {
    const structRet =
      "module Main;\nstruct P { x: byte; }\nfunction f(): P { }\nfunction main(): void { }\n";
    expect(errorCodes(analyzeMulti([structRet]).diags)).toContain(DiagCode.StructReturnNotAllowed);

    const arrayRet =
      "module Main;\nfunction f(): byte[2] { }\nfunction main(): void { }\n";
    expect(errorCodes(analyzeMulti([arrayRet]).diags)).toContain(DiagCode.ArrayReturnNotAllowed);

    // RETIRED SUB-ROW, superseded: the aggregate-parameter assertion here
    // originally pinned the interim loud rejection ("not supported yet —
    // they need by-reference passing"). By-reference parameters now exist
    // (FN-3), so a struct parameter compiles cleanly; only the RETURN
    // rejections above are permanent.
    const param =
      "module Main;\nstruct P { x: byte; }\nfunction f(p: P): void { p.x = 1; }\nfunction main(): void { let v: P; f(v); }\n";
    const paramResult = analyzeMulti([param]);
    expect(paramResult.diags.some((d) => isIceCode(d.code))).toBe(false);
    expect(errorCodes(paramResult.diags)).toEqual([]);
  });

  it("ST-44a: an aggregate literal in statement position is E10157", () => {
    const src = program("struct Point { x: byte; y: byte; }", "Point { x: 1, y: 2 };");
    expect(errorCodes(analyzeMulti([src]).diags)).toContain(
      DiagCode.ExpressionStatementNotACall,
    );
  });

  it("ST-44b: a string array-initialiser is loudly rejected until strings land", () => {
    const src = program("", 'let a: byte[10] = "HELLO";');
    expect(analyzeMulti([src]).diags.some((d) => isIceCode(d.code))).toBe(true);
  });
});

describe("Specification: switch-on-enum & warnings (ST-45..ST-48)", () => {
  const DIR = "enum Direction { UP, DOWN = 3, LEFT, RIGHT }\n";

  it("ST-45: a non-exhaustive enum switch without default compiles clean", () => {
    const src = program(
      DIR,
      "let d: Direction = Direction.DOWN;\nlet x: byte = 0;\n" +
      "switch (d) { case Direction.DOWN: x = 1; default: x = 2; }",
    );
    expect(errorCodes(analyzeMulti([src]).diags)).toEqual([]);
  });

  it("ST-46: a bare integer case on an enum discriminant is E10077", () => {
    const src = program(
      DIR,
      "let d: Direction = Direction.DOWN;\nlet x: byte = 0;\n" +
      "switch (d) { case 3: x = 1; default: x = 2; }",
    );
    expect(errorCodes(analyzeMulti([src]).diags)).toContain(DiagCode.CaseValueTypeMismatch);
  });

  it("ST-47: an enum-member case on a byte discriminant is OK (enum widens to byte)", () => {
    const src = program(
      DIR,
      "let b: byte = 3;\nlet x: byte = 0;\n" +
      "switch (b) { case Direction.DOWN: x = 1; default: x = 2; }",
    );
    expect(errorCodes(analyzeMulti([src]).diags)).toEqual([]);
  });

  it("ST-48: partial init is W10140 and a missing initialiser is W10141 — both compile", () => {
    const partial = program("", "let a: byte[5] = [1, 2];");
    const partialResult = analyzeMulti([partial]);
    expect(errorCodes(partialResult.diags)).toEqual([]);
    expect(partialResult.diags.some((d) => d.code === DiagCode.PartialArrayInit)).toBe(true);

    const missing = program("", "let a: byte[5];");
    const missingResult = analyzeMulti([missing]);
    expect(errorCodes(missingResult.diags)).toEqual([]);
    expect(missingResult.diags.some((d) => d.code === DiagCode.UninitializedArray)).toBe(true);
  });
});
