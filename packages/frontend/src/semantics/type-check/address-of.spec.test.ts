/**
 * Specification tests for the address-of operator (`&`) — frozen spec Ch 04 §8
 * and Ch 06 §8. `&` yields the operand's compile-time memory address as a
 * `word` for every addressable operand: module-level and local `let`
 * variables, functions and interrupt functions (in-module or as a qualified
 * exported `Module.fn`), and `const` aggregates (they own a data-section
 * image). Taking a function's address marks it address-taken, which the SFA
 * projection surfaces as `isEscaped` so the function's frame is always
 * allocated. Non-addressable operands reject: an inlined scalar constant has
 * no storage (E10047), a parameter has no stable home of its own (E10048),
 * struct fields and array elements are not yet addressable (E10042), and
 * anything else — literals, calls, arbitrary expressions — has no address at
 * all (E10049).
 *
 * Expectations derive from the frozen spec chapters — never from the
 * implementation. Exercised through the real public path
 * (`lex`→`parse`→`analyze`) over one or more source files.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode, primitive } from "@blend65/core";
import type {
  Diagnostic,
  DiagnosticBag,
  ExprNode,
  ExpressionStmtNode,
  FunctionDeclNode,
  IntrinsicCallExprNode,
  LetDeclNode,
  ProgramNode,
  SemanticModel,
} from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";
import { modelToFunctionInfo } from "../../sfa/model-adapter.js";

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

/** Every error-severity diagnostic code, in bag order. */
function errorCodes(diags: readonly Diagnostic[]): string[] {
  return diags.filter((d) => d.severity === "error").map((d) => d.code);
}

/** The named function declaration of a program. */
function fnOf(program: ProgramNode, name: string): FunctionDeclNode {
  const fn = program.items.find(
    (i): i is FunctionDeclNode => i.kind === "FunctionDecl" && i.name === name,
  );
  if (fn === undefined) throw new Error(`fixture must declare function ${name}`);
  return fn;
}

/** The initialiser expression of `let <name> …` inside the named function. */
function initIn(program: ProgramNode, fnName: string, letName: string): ExprNode {
  const decl = fnOf(program, fnName).body.statements.find(
    (s): s is LetDeclNode => s.kind === "LetDecl" && s.name === letName,
  );
  if (decl?.initialiser == null) {
    throw new Error(`fixture must declare 'let ${letName} = …' in ${fnName}`);
  }
  return decl.initialiser;
}

const WORD = primitive("word");

describe("Specification: address-of yields word for addressable operands", () => {
  it("ST-1: &moduleVar and &localVar type as word and compile clean", () => {
    const { diags, model, programs } = analyzeMulti([
      [
        "module Main;",
        "let m: byte = 0;",
        "function main(): void {",
        "  let a: word = &m;",
        "  let l: byte = 2;",
        "  let b: word = &l;",
        "}",
      ].join("\n"),
    ]);
    expect(errorCodes(diags)).toEqual([]);
    expect(model.typeOf(initIn(programs[0], "main", "a"))).toEqual(WORD);
    expect(model.typeOf(initIn(programs[0], "main", "b"))).toEqual(WORD);
  });

  it("ST-2: pokew($FFFE, &onIRQ) compiles — an interrupt handler's address is a word value", () => {
    const { diags, model, programs } = analyzeMulti([
      [
        "module Main;",
        "interrupt function onIRQ() { }",
        "function main(): void {",
        "  pokew($FFFE, &onIRQ);",
        "}",
      ].join("\n"),
    ]);
    expect(errorCodes(diags)).toEqual([]);
    const stmt = fnOf(programs[0], "main").body.statements[0] as ExpressionStmtNode;
    const call = stmt.expression as IntrinsicCallExprNode;
    expect(model.typeOf(call.args[1])).toEqual(WORD);
  });

  it("ST-3: &fn types word and marks the function address-taken (isEscaped in the projection)", () => {
    const { diags, model, programs } = analyzeMulti([
      [
        "module Main;",
        "function helper(): void { }",
        "function main(): void {",
        "  let h: word = &helper;",
        "}",
      ].join("\n"),
    ]);
    expect(errorCodes(diags)).toEqual([]);
    expect(model.typeOf(initIn(programs[0], "main", "h"))).toEqual(WORD);
    const infos = modelToFunctionInfo(model);
    expect(infos.find((f) => f.name === "Main.helper")?.isEscaped).toBe(true);
    expect(infos.find((f) => f.name === "Main.main")?.isEscaped).toBe(false);
  });

  it("ST-4: &Math.fn (qualified exported fn) types word cross-module without the function-reference rejection", () => {
    const { diags, model, programs } = analyzeMulti([
      ["module Math;", "export function fn(): byte { return 1; }"].join("\n"),
      ["module Main;", "function main(): void {", "  let h: word = &Math.fn;", "}"].join("\n"),
    ]);
    expect(errorCodes(diags)).toEqual([]);
    expect(model.typeOf(initIn(programs[1], "main", "h"))).toEqual(WORD);
    const infos = modelToFunctionInfo(model);
    expect(infos.find((f) => f.name === "Math.fn")?.isEscaped).toBe(true);
  });

  it("ST-10: &constAggregate types word — const arrays own a data-section address", () => {
    const { diags, model, programs } = analyzeMulti([
      [
        "module Main;",
        "const T: byte[3] = [1, 2, 3];",
        "function main(): void {",
        "  let a: word = &T;",
        "}",
      ].join("\n"),
    ]);
    expect(errorCodes(diags)).toEqual([]);
    expect(model.typeOf(initIn(programs[0], "main", "a"))).toEqual(WORD);
  });
});

describe("Specification: address-of rejects non-addressable operands", () => {
  it("ST-5: &constScalar is rejected — inlined constants have no storage", () => {
    const { diags } = analyzeMulti([
      [
        "module Main;",
        "const K: byte = 5;",
        "function main(): void {",
        "  let a: word = &K;",
        "}",
      ].join("\n"),
    ]);
    expect(errorCodes(diags)).toContain(DiagCode.AddressOfConstScalar);
  });

  it("ST-6: &parameter is rejected — copy to a local first", () => {
    const { diags } = analyzeMulti([
      [
        "module Main;",
        "function f(p: byte): void {",
        "  let w: word = &p;",
        "}",
        "function main(): void { f(1); }",
      ].join("\n"),
    ]);
    expect(errorCodes(diags)).toContain(DiagCode.AddressOfParameter);
  });

  it("ST-7: &arr[i] and &s.field are rejected — element/field address-of is not supported yet", () => {
    const { diags } = analyzeMulti([
      [
        "module Main;",
        "struct Pos { x: byte; y: byte; }",
        "let arr: byte[4];",
        "let s: Pos;",
        "function main(): void {",
        "  let a: word = &arr[1];",
        "  let b: word = &s.x;",
        "}",
      ].join("\n"),
    ]);
    const codes = errorCodes(diags);
    expect(codes.filter((c) => c === DiagCode.AddressOfElementDeferred)).toHaveLength(2);
  });

  it("ST-8: &literal and &(expression) are rejected — only named entities have addresses", () => {
    const { diags } = analyzeMulti([
      [
        "module Main;",
        "function main(): void {",
        "  let x: byte = 1;",
        "  let y: byte = 2;",
        "  let a: word = &42;",
        "  let b: word = &(x + y);",
        "}",
      ].join("\n"),
    ]);
    const codes = errorCodes(diags);
    expect(codes.filter((c) => c === DiagCode.AddressOfNonAddressable)).toHaveLength(2);
  });
});
