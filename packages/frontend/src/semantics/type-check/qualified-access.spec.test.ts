/**
 * Specification tests for qualified module access — `Module.member` as a call,
 * a value read, and an assignment target. Exported declarations are reachable
 * with full qualification WITHOUT an import (frozen spec Ch 10 §4.4); only
 * exported members qualify (non-exported → E10012); an unknown head that is
 * neither a value in scope nor a user module is undeclared (E10100); a value
 * symbol shadowing a module name wins (innermost binding — the access stays
 * on the silent struct-field path); writes to a qualified const are rejected
 * (E10191); a function member in value position is an explicit
 * not-supported-yet internal error, never a silent miscompile; and a
 * qualified call edge feeds the same call graph as a bare call, so a
 * cross-module cycle through one qualified edge is still one recursion error
 * with the full path.
 *
 * Expectations derive from the frozen spec Ch 10 §4-§5 and Ch 14 — never from
 * the implementation. Exercised through the real public path
 * (`lex`→`parse`→`analyze`) over one or more source files.
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  DEFAULT_PROFILE,
  DiagCode,
  ERROR_TYPE,
  IceCode,
  primitive,
} from "@blend65/core";
import type {
  Diagnostic,
  DiagnosticBag,
  ExprNode,
  ExpressionStmtNode,
  FunctionDeclNode,
  LetDeclNode,
  ModuleDeclNode,
  ProgramNode,
  Scope,
  SemanticModel,
  Symbol,
} from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";

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

/** The initialiser expression of `let <name> …` inside a program's `main`. */
function initInMain(program: ProgramNode, name: string): ExprNode {
  const decl = fnOf(program, "main").body.statements.find(
    (s): s is LetDeclNode => s.kind === "LetDecl" && s.name === name,
  );
  if (decl?.initialiser == null) throw new Error(`fixture must declare 'let ${name} = …'`);
  return decl.initialiser;
}

/** The `index`-th expression-statement expression inside a program's `main`. */
function exprStmtInMain(program: ProgramNode, index: number): ExprNode {
  const stmts = fnOf(program, "main").body.statements.filter(
    (s): s is ExpressionStmtNode => s.kind === "ExpressionStmt",
  );
  const stmt = stmts[index];
  if (stmt === undefined) throw new Error("fixture is missing an expression statement");
  return stmt.expression;
}

/** The module scope named `name` hanging off the model's global scope. */
function moduleScopeOf(model: SemanticModel, name: string): Scope {
  const scope = model.globalScope.children.find(
    (c) =>
      c.kind === "module" &&
      c.node?.kind === "ModuleDecl" &&
      (c.node as ModuleDeclNode).name === name,
  );
  if (scope === undefined) throw new Error(`model has no module scope '${name}'`);
  return scope;
}

/** The function symbol named `name` in the model's call graph. */
function fnSymOf(model: SemanticModel, name: string): Symbol {
  const sym = [...model.callGraph.functions].find((s) => s.name === name);
  if (sym === undefined) throw new Error(`call graph has no function '${name}'`);
  return sym;
}

const MATH_ADD =
  "module Math;\n" +
  "export function add(a: byte, b: byte): byte { return a + b; }\n";

describe("Specification: qualified access — calls", () => {
  it("should type an import-less qualified call and record the cross-module call edge", () => {
    const mainFile =
      "module Main;\n" + "function main(): void { let r: byte = Math.add(1, 2); }\n";
    const { diags, model, programs } = analyzeMulti([mainFile, MATH_ADD]);

    expect(diags).toEqual([]);
    expect(model.typeOf(initInMain(programs[0], "r"))).toEqual(primitive("byte"));

    // The qualified call lands in the call graph exactly like a bare call.
    const mainSym = fnSymOf(model, "main");
    const addSym = fnSymOf(model, "add");
    expect(model.callGraph.edges.get(mainSym)?.has(addSym)).toBe(true);
  });

  it("should reject qualifying a non-exported member with E10012 naming member and module", () => {
    const mathPrivate =
      "module Math;\n" + "function helper(): byte { return 1; }\n";
    const mainFile = "module Main;\n" + "function main(): void { Math.helper(); }\n";
    const { diags } = analyzeMulti([mainFile, mathPrivate]);

    expect(errorCodes(diags)).toEqual([DiagCode.ImportNonExported]);
    const nonExported = diags.find((d) => d.code === DiagCode.ImportNonExported);
    expect(nonExported?.message).toContain("'helper'");
    expect(nonExported?.message).toContain("'Math'");
    expect(nonExported?.message).toContain("not exported");
  });

  it("should reject an unknown qualified head with E10100 on the head's span", () => {
    const mainFile = "module Main;\n" + "function main(): void { Nope.fn(); }\n";
    const { diags } = analyzeMulti([mainFile]);

    expect(errorCodes(diags)).toEqual([DiagCode.UndeclaredIdentifier]);
    const undeclared = diags.find((d) => d.code === DiagCode.UndeclaredIdentifier);
    expect(undeclared?.message).toContain("Nope");
    // The diagnostic anchors to the head identifier, not the whole expression.
    const span = undeclared?.primarySpan;
    expect(span).toBeDefined();
    if (span == null) return;
    expect(mainFile.slice(span.start, span.end)).toBe("Nope");
  });

  it("should let a local value symbol shadow a module name silently (innermost binding wins)", () => {
    const mainFile =
      "module Main;\n" +
      "function main(): void { let Math: byte = 1; Math.add(1, 2); }\n";
    const { diags, model, programs } = analyzeMulti([mainFile, MATH_ADD]);

    // No undeclared/not-exported/duplicate errors — the access stays on the
    // silent (future struct-field) poison path.
    expect(diags).toEqual([]);
    expect(model.typeOf(exprStmtInMain(programs[0], 0))).toEqual(ERROR_TYPE);

    // And no phantom call edge to the shadowed module's function.
    const mainSym = fnSymOf(model, "main");
    const addSym = fnSymOf(model, "add");
    expect(model.callGraph.edges.get(mainSym)?.has(addSym) ?? false).toBe(false);
  });
});

describe("Specification: qualified access — value reads and writes", () => {
  it("should type a qualified read of an exported module variable as the SAME declared symbol", () => {
    const mathVar = "module Math;\n" + "export let scaled: byte;\n";
    const mainFile =
      "module Main;\n" + "function main(): void { let x: byte = Math.scaled; }\n";
    const { diags, model, programs } = analyzeMulti([mainFile, mathVar]);

    expect(diags).toEqual([]);
    const read = initInMain(programs[0], "x");
    expect(model.typeOf(read)).toEqual(primitive("byte"));

    // Identity, not a copy: the resolved symbol IS the one Math's scope declares.
    const declared = moduleScopeOf(model, "Math").symbols.get("scaled");
    expect(declared).toBeDefined();
    expect(model.symbolOf(read)).toBe(declared);
  });

  it("should accept a qualified write to an exported module variable with strict type checks", () => {
    const mathVar = "module Math;\n" + "export let base: word;\n";
    const mainFile =
      "module Main;\n" + "function main(): void { Math.base = $0103; }\n";
    const { diags, model, programs } = analyzeMulti([mainFile, mathVar]);

    expect(diags).toEqual([]);

    // The write target resolved to the declared module variable.
    const assign = exprStmtInMain(programs[0], 0);
    if (assign.kind !== "AssignExpr") throw new Error("fixture must assign");
    const declared = moduleScopeOf(model, "Math").symbols.get("base");
    expect(declared).toBeDefined();
    expect(model.symbolOf(assign.target)).toBe(declared);
  });

  it("should reject a qualified write to an exported const with E10191", () => {
    const mathConst = "module Math;\n" + "export const SCALE: byte = 5;\n";
    const mainFile =
      "module Main;\n" + "function main(): void { Math.SCALE = 5; }\n";
    const { diags } = analyzeMulti([mainFile, mathConst]);

    expect(errorCodes(diags)).toEqual([DiagCode.AssignToConst]);
  });

  it("should reject a qualified function member in value position with an explicit not-supported error", () => {
    const mainFile =
      "module Main;\n" + "function main(): void { let x: byte = Math.add; }\n";
    const { diags } = analyzeMulti([mainFile, MATH_ADD]);

    expect(errorCodes(diags)).toEqual([IceCode.Unexpected]);
    const ice = diags.find((d) => d.code === IceCode.Unexpected);
    expect(ice?.message).toContain("function reference");
    expect(ice?.message).toContain("not supported yet");
  });
});

describe("Specification: qualified access — call-graph parity", () => {
  it("should report ONE recursion error with the full path when a cycle closes through a qualified call", () => {
    // Main.f calls imported g; Math.g calls Main.f back with full qualification.
    const mainFile =
      "module Main;\n" +
      "import { g } from Math;\n" +
      "export function f(): byte { return g(); }\n" +
      "function main(): void {}\n";
    const mathFile =
      "module Math;\n" + "export function g(): byte { return Main.f(); }\n";
    const { diags } = analyzeMulti([mainFile, mathFile]);

    const recursion = diags.filter((d) => d.code === DiagCode.RecursionDetected);
    expect(recursion).toHaveLength(1);
    expect(recursion[0].message).toContain("f → g → f");
  });
});
