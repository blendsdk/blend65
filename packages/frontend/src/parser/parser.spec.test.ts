import { describe, expect, it } from "vitest";
import { DiagCode, createDiagnosticBag } from "@blend65/core";
import type { DiagnosticBag } from "@blend65/core";
import { lex } from "../index.js";
// Import through the package PUBLIC entry so this tier also pins that `parse`
// is re-exported from `@blend65/frontend` (FR-47, AC-01).
import { parse } from "../index.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/**
 * Lexes `source` then parses it through the public `parse()` entry, threading
 * the source text into the `ParseInput` object (AR-8) so identifier lexemes
 * resolve via the cursor's single `lexeme()` site.
 */
function parseSource(source: string, bag: DiagnosticBag) {
  const { tokens } = lex(SRC, source, bag);
  return parse({ tokens, source, sourceId: SRC, bag });
}

describe("parser public contract — Phase 2 (ST-P5..P8)", () => {
  it("re-exports `parse` from the @blend65/frontend public entry", () => {
    expect(typeof parse).toBe("function");
  });

  // ----- ST-P5: minimal program (FR-12/13, AC-11) -----
  it("ST-P5: `module Main;` → ProgramNode, name 'Main', no items, no errors", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource("module Main;", bag);
    expect(ast.kind).toBe("Program");
    expect(ast.moduleDecl.kind).toBe("ModuleDecl");
    expect(ast.moduleDecl.name).toBe("Main");
    expect(ast.items).toEqual([]);
    expect(hasErrors).toBe(false);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-P5: dotted module name `module Game.Engine;` resolves the full path", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource("module Game.Engine;", bag);
    expect(ast.moduleDecl.name).toBe("Game.Engine");
    expect(hasErrors).toBe(false);
  });

  // ----- ST-P6: missing module (FR-13, AC-08) -----
  it("ST-P6: source with no `module` → E10001, ProgramNode still returned", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource("function main(): void { }", bag);
    expect(ast.kind).toBe("Program");
    expect(ast.moduleDecl.kind).toBe("ModuleDecl");
    expect(hasErrors).toBe(true);
    expect(bag.getAll().some((d) => d.code === DiagCode.MissingModuleDecl)).toBe(true);
  });

  // ----- ST-P7: second module (FR-13, AC-08) -----
  it("ST-P7: two `module` declarations → E10002 on the second; one ProgramNode", () => {
    const bag = createDiagnosticBag();
    const { ast } = parseSource("module A;\nmodule B;", bag);
    expect(ast.kind).toBe("Program");
    expect(ast.moduleDecl.name).toBe("A");
    expect(bag.getAll().some((d) => d.code === DiagCode.ModuleDeclNotFirst)).toBe(true);
  });

  // ----- ST-P8: import (FR-14, AC-01) -----
  it("ST-P8: `import { a, b } from Foo.Bar;` → ImportStmtNode with symbols + path", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource("module M;\nimport { a, b } from Foo.Bar;", bag);
    expect(hasErrors).toBe(false);
    expect(ast.items).toHaveLength(1);
    const imp = ast.items[0]!;
    expect(imp.kind).toBe("ImportStmt");
    if (imp.kind !== "ImportStmt") {
      throw new Error("expected ImportStmt");
    }
    expect(imp.symbols.map((s) => s.name)).toEqual(["a", "b"]);
    expect(imp.modulePath).toBe("Foo.Bar");
  });

  // ----- Determinism (AC-16, foreshadow ST-P9) -----
  it("parse() never throws and always returns a ParseResult", () => {
    const bag = createDiagnosticBag();
    expect(() => parseSource("module M;", bag)).not.toThrow();
  });
});
