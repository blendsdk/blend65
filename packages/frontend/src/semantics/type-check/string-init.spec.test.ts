/**
 * Specification tests for string-literal array initialisers.
 *
 * A string literal initialises a byte array by desugaring into the array
 * literal of its encoded bytes — bare (`= "S"`), bracketed with a fill
 * (`= ["S"; f]`), across const/let/local positions. Oversized strings,
 * mixed string/value element lists, and strings as fill values are loud
 * diagnostics; a string anywhere outside an array-initialiser position is
 * an invalid operand. There is no automatic NUL terminator.
 *
 * Byte oracles derive from the frozen spec (Ch 01 §7.2, Ch 08 §4/§12,
 * Ch 15 §3.2): PETSCII keeps `H E L L O` at their ASCII codes (`48 45 4C
 * 4C 4F`), `.` is `$2E`. Exercised through the real public path
 * (`lex`→`parse`→`analyze`) with a c64-shaped profile. Never derived from
 * running the implementation.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type {
  ArrayLitExprNode,
  ConstValue,
  Diagnostic,
  DiagnosticBag,
  LetDeclNode,
  NumericLitExprNode,
  ProgramNode,
  SemanticModel,
} from "@blend65/core";
import type { PlatformProfile } from "@blend65/core/platform";
import { lex, parse, analyze } from "../../index.js";

/** A c64-shaped canonical profile whose literals encode as PETSCII. */
const C64_PROFILE: PlatformProfile = {
  platformId: "c64",
  codeStart: 0x0801,
  codeEnd: 0xcfff,
  dataStart: 0xc000,
  dataEnd: 0xcfff,
  ramStart: 0x0801,
  ramEnd: 0xcfff,
  zpStart: 0x02,
  zpEnd: 0x8f,
  stackReserve: 16,
  maxBinarySize: 0xc7ff,
  maxRam: 0xc7ff,
  maxZp: 142,
  stackBudget: 240,
  outputFormat: "prg",
  loadAddress: 0x0801,
  cpu: "nmos6502",
  zpArgBlockSize: 8,
  defaultEncoding: "petscii",
};

/** Lexes + parses + analyzes one source against the c64-shaped profile. */
function analyzeC64(source: string): {
  diags: Diagnostic[];
  model: SemanticModel;
  ast: ProgramNode;
} {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast } = parse({ tokens, source, sourceId: 1, bag });
  const model = analyze({
    programs: [ast],
    bag,
    profile: DEFAULT_PROFILE,
    targetProfile: C64_PROFILE,
  });
  return { diags: bag.getAll(), model, ast };
}

/** The codes of all error-severity diagnostics. */
function errorCodes(diags: readonly Diagnostic[]): string[] {
  return diags.filter((d) => d.severity === "error").map((d) => d.code);
}

/** The codes of all warning-severity diagnostics. */
function warningCodes(diags: readonly Diagnostic[]): string[] {
  return diags.filter((d) => d.severity === "warning").map((d) => d.code);
}

/** Looks up a folded constant's value by symbol name. */
function constValueOf(model: SemanticModel, name: string): ConstValue | undefined {
  for (const [sym, value] of model.constValues) {
    if (sym.name === name) return value;
  }
  return undefined;
}

/** The module-level `let` declaration node named `name`. */
function moduleLet(ast: ProgramNode, name: string): LetDeclNode {
  for (const item of ast.items) {
    if (item.kind === "LetDecl" && item.name === name) return item;
  }
  throw new Error(`test source has no module let '${name}'`);
}

/** The numeric element values of an (expected desugared) array initialiser. */
function elementValues(decl: LetDeclNode): number[] {
  const init = decl.initialiser;
  expect(init?.kind).toBe("ArrayLitExpr");
  return (init as ArrayLitExprNode).elements.map((e) => {
    expect(e.kind).toBe("NumericLitExpr");
    return (e as NumericLitExprNode).value;
  });
}

const HELLO = [0x48, 0x45, 0x4c, 0x4c, 0x4f];

describe("Specification: bare string initialisers", () => {
  it("folds an unsized const string to a sized const image with the encoded bytes", () => {
    const { diags, model } = analyzeC64(
      'module Main;\nconst MSG: byte[] = "HELLO";\nfunction main(): void {}\n',
    );
    expect(errorCodes(diags)).toEqual([]);
    const value = constValueOf(model, "MSG");
    expect(value).toBeDefined();
    expect(value?.type).toEqual({ kind: "array", element: { kind: "primitive", name: "byte" }, size: 5 });
    expect(Array.from(value?.bytes ?? [])).toEqual(HELLO);
  });

  it("keeps the partial-initialisation advisory for a short string on a sized array", () => {
    const { diags } = analyzeC64(
      'module Main;\nfunction main(): void {\nlet n: byte[10] = "HELLO";\n}\n',
    );
    expect(errorCodes(diags)).toEqual([]);
    expect(warningCodes(diags)).toContain(DiagCode.PartialArrayInit);
  });

  it("rejects a string longer than the declared size, naming both counts", () => {
    const { diags } = analyzeC64(
      'module Main;\nlet q: byte[3] = "HELLO";\nfunction main(): void {}\n',
    );
    const e = diags.find((d) => d.code === DiagCode.StringExceedsArraySize);
    expect(e, "expected the oversized-string diagnostic").toBeDefined();
    expect(e?.message).toContain("5 bytes");
    expect(e?.message).toContain("3");
  });

  it("adds no automatic terminator: an explicit NUL escape is the last byte", () => {
    const { diags, model } = analyzeC64(
      'module Main;\nconst Z: byte[] = "HI\\0";\nfunction main(): void {}\n',
    );
    expect(errorCodes(diags)).toEqual([]);
    const value = constValueOf(model, "Z");
    expect(Array.from(value?.bytes ?? [])).toEqual([0x48, 0x49, 0x00]);
  });

  it("infers a mutable string-initialised let's size from the string", () => {
    const { diags, model, ast } = analyzeC64(
      'module Main;\nlet label: byte[] = "SCORE:";\nfunction main(): void {\nlabel[0] = 1;\n}\n',
    );
    expect(errorCodes(diags)).toEqual([]);
    const sym = model.symbolOf(moduleLet(ast, "label"));
    expect(sym?.type).toEqual({
      kind: "array",
      element: { kind: "primitive", name: "byte" },
      size: 6,
    });
  });
});

describe("Specification: bracketed string initialisers with fills", () => {
  it("expands the string and completes the remainder with the fill, warning-free", () => {
    const { diags, ast } = analyzeC64(
      'module Main;\nlet o: byte[10] = ["HELLO"; 0];\nfunction main(): void {}\n',
    );
    expect(errorCodes(diags)).toEqual([]);
    expect(warningCodes(diags)).toEqual([]);
    expect(elementValues(moduleLet(ast, "o"))).toEqual(HELLO);
  });

  it("accepts a char literal as the fill of a bracketed string initialiser", () => {
    const { diags, ast } = analyzeC64(
      "module Main;\nlet p: byte[8] = [\"HI\"; '.'];\nfunction main(): void {}\n",
    );
    expect(errorCodes(diags)).toEqual([]);
    expect(warningCodes(diags)).toEqual([]);
    expect(elementValues(moduleLet(ast, "p"))).toEqual([0x48, 0x49]);
    const fill = moduleLet(ast, "p").initialiser as ArrayLitExprNode;
    expect(fill.fill?.kind).toBe("NumericLitExpr");
    expect((fill.fill as NumericLitExprNode).value).toBe(0x2e);
  });
});

describe("Specification: illegal string-initialiser shapes", () => {
  it("rejects two strings in one element list", () => {
    const { diags } = analyzeC64(
      'module Main;\nlet a: byte[10] = ["HELLO","WORLD"];\nfunction main(): void {}\n',
    );
    expect(errorCodes(diags)).toContain(DiagCode.MixedStringValueInit);
  });

  it("rejects a string mixed with value elements", () => {
    const { diags } = analyzeC64(
      'module Main;\nlet b: byte[10] = [1,"HI",3];\nfunction main(): void {}\n',
    );
    expect(errorCodes(diags)).toContain(DiagCode.MixedStringValueInit);
  });

  it("rejects a string as a fill value", () => {
    const { diags } = analyzeC64(
      'module Main;\nlet y: byte[5] = [1, 2; "HI"];\nfunction main(): void {}\n',
    );
    expect(errorCodes(diags)).toContain(DiagCode.MixedStringValueInit);
  });

  it("rejects a string outside an array-initialiser position as an invalid operand", () => {
    const { diags } = analyzeC64(
      'module Main;\nfunction main(): void {\npoke($0400, "A");\n}\n',
    );
    expect(errorCodes(diags)).toContain(DiagCode.InvalidOperandType);
  });
});
