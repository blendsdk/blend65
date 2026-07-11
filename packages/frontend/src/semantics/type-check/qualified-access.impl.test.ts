/**
 * Implementation tests for qualified-access edges — a platform-namespace head
 * is not a user module (undeclared, E10100), exported-only qualification holds
 * even from inside the module itself (E10012), an imported module variable
 * aliases the SAME symbol and projects exactly ONE planner slot under its
 * home module (no phantom importer-side slot), an `a.b.c` chain stays on the
 * silent field-access path, and assigning to a qualified function member is
 * rejected loudly.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode, IceCode } from "@blend65/core";
import type {
  Diagnostic,
  DiagnosticBag,
  ExpressionStmtNode,
  FunctionDeclNode,
  LetDeclNode,
  ModuleDeclNode,
  ProgramNode,
  SemanticModel,
} from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";
import { modelToModuleVars } from "../../sfa/model-adapter.js";

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

describe("qualified-access edges", () => {
  it("treats a platform-namespace head as undeclared — qualification is a user-module feature", () => {
    // `c64` is a platform namespace, not a user module; with no value symbol
    // and no user module of that name in scope, the head is undeclared.
    const { diags } = analyzeMulti([
      "module Main;\nfunction main(): void { c64.border(1); }\n",
    ]);
    expect(errorCodes(diags)).toEqual([DiagCode.UndeclaredIdentifier]);
  });

  it("rejects qualifying a non-exported member even from inside the same module", () => {
    const { diags } = analyzeMulti([
      "module Main;\n" +
        "function helper(): byte { return 1; }\n" +
        "function main(): void { let x: byte = Main.helper(); }\n",
    ]);
    expect(errorCodes(diags)).toEqual([DiagCode.ImportNonExported]);
  });

  it("projects an imported module variable as ONE slot under its home module (same-Symbol aliasing)", () => {
    const { diags, model, programs } = analyzeMulti([
      "module Main;\n" +
        "import { scaled } from Math;\n" +
        "function main(): void { let x: byte = scaled; }\n",
      "module Math;\nexport let scaled: byte;\n",
    ]);
    expect(diags).toEqual([]);

    // The bare use in Main resolves to the very symbol Math's scope declares.
    const mainFn = programs[0].items.find(
      (i): i is FunctionDeclNode => i.kind === "FunctionDecl" && i.name === "main",
    );
    const letX = mainFn?.body.statements.find(
      (s): s is LetDeclNode => s.kind === "LetDecl" && s.name === "x",
    );
    if (letX?.initialiser == null) throw new Error("fixture must declare 'let x = scaled'");
    const mathScope = model.globalScope.children.find(
      (c) =>
        c.kind === "module" &&
        c.node?.kind === "ModuleDecl" &&
        (c.node as ModuleDeclNode).name === "Math",
    );
    const declared = mathScope?.symbols.get("scaled");
    expect(declared).toBeDefined();
    expect(model.symbolOf(letX.initialiser)).toBe(declared);

    // Exactly ONE planner slot, under the declaring module — the alias in
    // Main's scope must not project a second slot.
    const slots = modelToModuleVars(model).filter((v) => v.variableName === "scaled");
    expect(slots).toHaveLength(1);
    expect(slots[0].moduleName).toBe("Math");
  });

  it("keeps an a.b.c chain on the silent field-access path", () => {
    const { diags } = analyzeMulti([
      "module Main;\n" +
        "function main(): void { let a: byte = 1; let x: byte = a.b.c; }\n",
    ]);
    expect(diags).toEqual([]);
  });

  it("rejects assigning to a qualified function member loudly", () => {
    const { diags, programs } = analyzeMulti([
      "module Main;\nfunction main(): void { Math.add = 5; }\n",
      "module Math;\nexport function add(a: byte, b: byte): byte { return a + b; }\n",
    ]);
    expect(errorCodes(diags)).toEqual([IceCode.Unexpected]);
    // The rejection is the function-reference limitation, anchored at the target.
    const ice = diags.find((d) => d.code === IceCode.Unexpected);
    expect(ice?.message).toContain("not supported yet");
    const mainFn = programs[0].items.find(
      (i): i is FunctionDeclNode => i.kind === "FunctionDecl" && i.name === "main",
    );
    const stmt = mainFn?.body.statements[0];
    expect((stmt as ExpressionStmtNode).expression.kind).toBe("AssignExpr");
  });
});
