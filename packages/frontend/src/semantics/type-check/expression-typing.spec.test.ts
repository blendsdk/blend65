/**
 * Specification tests for RD-18 Slice 3b expression/literal typing (Pass 3, FR-2).
 *
 * Expectations derive exclusively from the **frozen spec** (Ch 02 type system:
 * TS-2 literal typing, TS-3 same-type ops, TS-5 mixed-signedness §5.1) and the
 * plan's testing strategy (ST-1, ST-3, ST-4, ST-5, ST-6, ST-9) + the AR-11
 * diagnostic-code table — NOT from implementation logic. Immutable oracle.
 *
 * The type engine is exercised through the REAL public path (`lex` → `parse` →
 * `analyze`); assertions read `model.typeOf(expr)` and the diagnostic bag.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode, primitive } from "@blend65/core";
import type {
  BinaryExprNode,
  Diagnostic,
  DiagnosticBag,
  ExprNode,
  FunctionDeclNode,
  LetDeclNode,
  ProgramNode,
} from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** Lexes + parses `source` through the public entry points, returning the AST. */
function parseSource(source: string, bag: DiagnosticBag): ProgramNode {
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  return ast;
}

/** The `main` `FunctionDecl` of a parsed program. */
function mainOf(program: ProgramNode): FunctionDeclNode {
  const fn = program.items.find(
    (i): i is FunctionDeclNode => i.kind === "FunctionDecl" && i.name === "main",
  );
  if (fn === undefined) throw new Error("fixture must declare main");
  return fn;
}

/** The `let <name> …` declaration inside `main`'s body. */
function letInMain(program: ProgramNode, name: string): LetDeclNode {
  const decl = mainOf(program).body.statements.find(
    (s): s is LetDeclNode => s.kind === "LetDecl" && s.name === name,
  );
  if (decl === undefined) throw new Error(`fixture must declare 'let ${name}'`);
  return decl;
}

/** The (required-present) initialiser of a `let` fixture declaration. */
function initOf(decl: LetDeclNode): ExprNode {
  if (decl.initialiser === null) throw new Error(`'let ${decl.name}' must have an initialiser`);
  return decl.initialiser;
}

/** Narrows an expression to a {@link BinaryExprNode}. */
function asBinary(expr: ExprNode): BinaryExprNode {
  if (expr.kind !== "BinaryExpr") throw new Error("expected a BinaryExpr");
  return expr;
}

/** The error codes recorded on the bag, in the bag's sorted order. */
function errorCodes(bag: DiagnosticBag): string[] {
  return bag.getErrors().map((d: Diagnostic) => d.code);
}

describe("Specification: RD-18 Slice 3b expression typing (FR-2)", () => {
  // ST-1 — literal typing (TS-2): value/context default type recorded in typeMap.
  it("should type numeric literals by value + context (ST-1, TS-2)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void { let a: byte = 5; let w: word = 300; }\n",
      bag,
    );
    const model = analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    // 5 in a byte context → byte; 300 in a word context → word (fits, TS-2).
    expect(model.typeOf(initOf(letInMain(program, "a")))).toEqual(primitive("byte"));
    expect(model.typeOf(initOf(letInMain(program, "w")))).toEqual(primitive("word"));
    expect(bag.hasErrors()).toBe(false);
  });

  // ST-3 — same-type arithmetic (TS-3): T OP T → T.
  it("should type same-type binary arithmetic as that type (ST-3, TS-3)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void {" +
        " let a: byte = 1; let b: byte = 2; let r: byte = a + b;" +
        " let x: word = 1; let y: word = 2; let rw: word = x + y; }\n",
      bag,
    );
    const model = analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(model.typeOf(asBinary(initOf(letInMain(program, "r"))))).toEqual(primitive("byte"));
    expect(model.typeOf(asBinary(initOf(letInMain(program, "rw"))))).toEqual(primitive("word"));
    expect(bag.hasErrors()).toBe(false);
  });

  // ST-4 — mixed signedness (TS-5, §5.1) → E10081 + poison; never throws (AC-2/AC-4).
  it("should reject byte + sbyte with E10081 and not throw (ST-4, AC-4)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void {" +
        " let a: byte = 5; let s: sbyte = -1; let r: byte = a + s; }\n",
      bag,
    );

    let model!: ReturnType<typeof analyze>;
    expect(() => {
      model = analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });
    }).not.toThrow();

    expect(errorCodes(bag)).toContain(DiagCode.MixedSignedUnsignedOperands); // E10081
    expect(bag.hasErrors()).toBe(true);
    // Poison: the mixed `+` result is ErrorType (no follow-on typing crash).
    expect(model.typeOf(asBinary(initOf(letInMain(program, "r")))).kind).toBe("error");
  });

  // ST-5 — a boolean operand in arithmetic → E10080 (InvalidOperandType, ledger
  // R34 / AR-11; NOT E10151 = UnknownType).
  it("should reject a boolean operand in arithmetic with E10080 (ST-5, AR-11)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void {" +
        " let a: byte = 5; let f: boolean = true; let r: byte = a + f; }\n",
      bag,
    );
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(errorCodes(bag)).toContain(DiagCode.InvalidOperandType); // E10080
    expect(errorCodes(bag)).not.toContain(DiagCode.UnknownType); // NOT E10151
  });

  // ST-6 — an undeclared identifier reference → E10100 + poison.
  it("should report an undeclared identifier with E10100 (ST-6)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void { let r: byte = 0; r = undefinedName; }\n",
      bag,
    );
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(errorCodes(bag)).toContain(DiagCode.UndeclaredIdentifier); // E10100
  });

  // ST-9 — poison suppression (R114/AC-13): `undef + b` emits EXACTLY ONE
  // diagnostic (E10100), no cascade from the poisoned `+`.
  it("should emit exactly one diagnostic for a poisoned expression (ST-9, R114)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void { let b: byte = 1; let r: byte = undef + b; }\n",
      bag,
    );
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    expect(errorCodes(bag)).toEqual([DiagCode.UndeclaredIdentifier]); // exactly one: E10100
  });
});
