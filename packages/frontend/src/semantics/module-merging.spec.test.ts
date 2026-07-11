/**
 * Specification tests for module merging — multiple source files declaring the
 * same module name contribute their declarations to ONE shared module scope
 * (frozen spec Ch 10 §1: a module may span several files), so a bare
 * cross-file call inside the module resolves without an import, and a
 * duplicate top-level name across the module's files is a normal duplicate
 * declaration (E10003) — never an internal compiler error.
 *
 * Expectations derive from the frozen spec Ch 10 — never from the
 * implementation. Exercised through the real public path
 * (`lex`→`parse`→`analyze`) over multiple source files.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode, primitive } from "@blend65/core";
import type {
  Diagnostic,
  DiagnosticBag,
  ExprNode,
  FunctionDeclNode,
  LetDeclNode,
  ModuleDeclNode,
  ProgramNode,
  SemanticModel,
} from "@blend65/core";
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

/** The initialiser expression of `let <name> …` inside a program's `main`. */
function initInMain(program: ProgramNode, name: string): ExprNode {
  const fn = program.items.find(
    (i): i is FunctionDeclNode => i.kind === "FunctionDecl" && i.name === "main",
  );
  if (fn === undefined) throw new Error("fixture must declare main");
  const decl = fn.body.statements.find(
    (s): s is LetDeclNode => s.kind === "LetDecl" && s.name === name,
  );
  if (decl?.initialiser == null) throw new Error(`fixture must declare 'let ${name} = …'`);
  return decl.initialiser;
}

describe("Specification: module merging across files", () => {
  it("should merge two files of the same module into ONE scope with a working cross-file bare call", () => {
    const mathFile1 =
      "module Math;\n" + "export function f(): byte { return 1; }\n";
    // `f()` is a bare call to a function declared in the module's OTHER file —
    // legal because both files contribute to one module scope.
    const mathFile2 =
      "module Math;\n" + "export function g(): byte { return f() + 1; }\n";
    const mainFile =
      "module Main;\n" +
      "import { f, g } from Math;\n" +
      "function main(): void { let a: byte = f(); let b: byte = g(); }\n";

    const { diags, model, programs } = analyzeMulti([mathFile1, mathFile2, mainFile]);
    expect(diags).toEqual([]);

    // Both Math functions were declared into the SAME module scope.
    const fns = [...model.callGraph.functions];
    const fSym = fns.find((s) => s.name === "f");
    const gSym = fns.find((s) => s.name === "g");
    expect(fSym).toBeDefined();
    expect(gSym).toBeDefined();
    if (fSym === undefined || gSym === undefined) return;
    expect(fSym.scope).toBe(gSym.scope);
    expect(fSym.scope.kind).toBe("module");

    // Exactly ONE module scope named Math hangs off the global scope.
    const mathScopes = model.globalScope.children.filter(
      (c) =>
        c.kind === "module" &&
        c.node?.kind === "ModuleDecl" &&
        (c.node as ModuleDeclNode).name === "Math",
    );
    expect(mathScopes).toHaveLength(1);

    // Both imported calls in Main type as the callees' byte return type.
    expect(model.typeOf(initInMain(programs[2], "a"))).toEqual(primitive("byte"));
    expect(model.typeOf(initInMain(programs[2], "b"))).toEqual(primitive("byte"));
  });

  it("should reject a duplicate top-level name across two files of one module with E10003 on the second declaration", () => {
    const mFile1 = "module M;\n" + "export function f(): byte { return 1; }\n";
    const mFile2 = "module M;\n" + "export function f(): byte { return 2; }\n";
    const mainFile = "module Main;\n" + "function main(): void {}\n";

    const { diags } = analyzeMulti([mFile1, mFile2, mainFile]);
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors.map((d) => d.code)).toEqual([DiagCode.DuplicateDecl]);
    const dup = errors[0];
    expect(dup.message).toContain("f");
    // The duplicate is reported at the SECOND file's declaration.
    expect(dup.primarySpan?.sourceId).toBe(2);
  });
});
