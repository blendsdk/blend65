/**
 * Specification tests for character-literal typing and encoding.
 *
 * A character literal is a `byte` constant everywhere a byte is expected —
 * expressions, initialisers, case labels, array sizes, element stores — with
 * its value produced by the target platform's character encoding. An
 * unmappable character is a loud diagnostic naming the code point and the
 * encoding, never a silently baked wrong byte.
 *
 * Byte oracles derive from the frozen spec (Ch 01 §7.2, Ch 08, Ch 15 §3.2):
 * PETSCII maps `a`→`$C1`, space→`$20`, `A`/`H` keep their ASCII codes.
 * Exercised through the real public path (`lex`→`parse`→`analyze`) with a
 * hand-rolled c64-shaped target profile. Never derived from running the
 * implementation.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type {
  ConstValue,
  Diagnostic,
  DiagnosticBag,
  ExprNode,
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

/** The initialiser of the first `let` statement inside `main`'s body. */
function firstLocalLetInitialiser(ast: ProgramNode): ExprNode {
  for (const item of ast.items) {
    if (item.kind !== "FunctionDecl") continue;
    for (const stmt of item.body.statements) {
      if (stmt.kind === "LetDecl" && stmt.initialiser !== null) return stmt.initialiser;
    }
  }
  throw new Error("test source has no initialised local let");
}

/** The codes of all error-severity diagnostics. */
function errorCodes(diags: readonly Diagnostic[]): string[] {
  return diags.filter((d) => d.severity === "error").map((d) => d.code);
}

/** Looks up a folded constant's value by symbol name. */
function constValueOf(model: SemanticModel, name: string): ConstValue | undefined {
  for (const [sym, value] of model.constValues) {
    if (sym.name === name) return value;
  }
  return undefined;
}

describe("Specification: char literals as byte constants", () => {
  it("folds a const char initialiser to its encoded byte", () => {
    const { diags, model } = analyzeC64(
      "module Main;\nconst SPACE: byte = ' ';\nfunction main(): void {}\n",
    );
    expect(errorCodes(diags)).toEqual([]);
    expect(constValueOf(model, "SPACE")?.value).toBe(0x20);
  });

  it("accepts a char-valued const where a const byte is required (array size)", () => {
    const { diags } = analyzeC64(
      "module Main;\nconst SPACE: byte = ' ';\nlet arr: byte[SPACE];\nfunction main(): void {}\n",
    );
    expect(errorCodes(diags)).toEqual([]);
  });

  it("accepts a char literal as a local byte initialiser and types it as byte", () => {
    const { diags, model, ast } = analyzeC64(
      "module Main;\nfunction main(): void {\nlet ch: byte = 'A';\n}\n",
    );
    expect(errorCodes(diags)).toEqual([]);
    // The literal must genuinely type as byte — a silently poisoned literal
    // would also produce zero diagnostics.
    expect(model.typeOf(firstLocalLetInitialiser(ast))).toEqual({
      kind: "primitive",
      name: "byte",
    });
  });

  it("collides an encoded char case label with its numeric duplicate", () => {
    const { diags } = analyzeC64(
      "module Main;\nfunction main(): void {\nlet x: byte = 0;\nswitch (x) {\ncase 'A': { }\ncase $41: { }\n}\n}\n",
    );
    expect(errorCodes(diags)).toContain(DiagCode.DuplicateCaseValue);
  });

  it("rejects an unmappable character naming the code point and the encoding", () => {
    const { diags } = analyzeC64(
      "module Main;\nfunction main(): void {\nlet c: byte = 'é';\n}\n",
    );
    const e = diags.find((d) => d.code === DiagCode.UnencodableCharacter);
    expect(e, "expected an unencodable-character diagnostic").toBeDefined();
    expect(e?.message).toContain("U+00E9");
    expect(e?.message).toContain("petscii");
  });

  it("accepts a char literal as an array element store and types it as byte", () => {
    const { diags, model, ast } = analyzeC64(
      "module Main;\nlet label: byte[6];\nfunction main(): void {\nlet v: byte = 'H';\nlabel[0] = v;\nlabel[1] = 'H';\n}\n",
    );
    expect(errorCodes(diags)).toEqual([]);
    expect(model.typeOf(firstLocalLetInitialiser(ast))).toEqual({
      kind: "primitive",
      name: "byte",
    });
  });
});
