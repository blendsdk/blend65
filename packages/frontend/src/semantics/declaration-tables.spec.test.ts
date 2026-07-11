/**
 * Specification tests for module-keyed struct/enum declaration tables and
 * aggregate type-annotation resolution (frozen spec Ch 07/08/09/10):
 *
 * - Two different modules may each declare a struct with the same name — the
 *   declarations are distinct types (Ch 10 module namespaces), never a silent
 *   collision.
 * - Within ONE module (including across its files) all top-level names share
 *   one namespace: duplicate type names and type-vs-value collisions are
 *   duplicate declarations (E10003).
 * - `void` is not a value type: struct fields and array elements of type
 *   `void` are rejected (E10156).
 * - Enum member values must be compile-time constants (E10230) in 0..255
 *   (E10143, including auto-increment overflow); duplicate VALUES are legal
 *   aliases (Ch 09 EN-5).
 * - Named-type annotations resolve module-locally, through imports, and via
 *   the dotted `Mod.Type` form; unknown names are E10151 and non-exported
 *   cross-module types are E10012.
 *
 * Expectations derive from the frozen spec chapters — never from the
 * implementation. Exercised through the real public path
 * (`lex`→`parse`→`analyze`) over one or more source files.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
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

const MAIN = "module Main;\nfunction main(): void { }\n";

describe("Specification: module-keyed declaration tables", () => {
  it("ST-7: two modules may each declare `struct Point` — distinct types, no collision", () => {
    const modA = "module A;\nexport struct Point { x: byte; }\nlet pa: Point;\n";
    const modB = "module B;\nexport struct Point { x: word; y: word; }\nlet pb: Point;\n";
    const { diags, model } = analyzeMulti([modA, modB, MAIN]);
    expect(diags).toEqual([]);

    const pointA = model.structTypes.get("A.Point");
    const pointB = model.structTypes.get("B.Point");
    expect(pointA).toBeDefined();
    expect(pointB).toBeDefined();
    // The layouts stay distinct: 1 byte vs 4 bytes.
    expect(pointA!.byteSize).toBe(1);
    expect(pointB!.byteSize).toBe(4);
  });

  it("ST-8: the same module declaring `struct Foo` in two files is a duplicate declaration (E10003)", () => {
    const file1 = "module M;\nexport struct Foo { x: byte; }\n";
    const file2 = "module M;\nexport struct Foo { x: byte; y: byte; }\n";
    const { diags } = analyzeMulti([file1, file2, MAIN]);
    expect(errorCodes(diags)).toEqual([DiagCode.DuplicateDecl]);
  });

  it("ST-9: a struct name colliding with a variable in the same module is E10003 (one namespace)", () => {
    const src = "module M;\nstruct S { x: byte; }\nlet S: byte;\n" + "function main(): void { }\n";
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([DiagCode.DuplicateDecl]);
  });

  it("ST-12: a `void` struct field is rejected (E10156)", () => {
    const src = "module Main;\nstruct S { v: void; }\nfunction main(): void { }\n";
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toContain(DiagCode.VoidTypeNotAllowed);
  });

  it("ST-12: a `void` array element type is rejected (E10156)", () => {
    const src = "module Main;\nlet a: void[2];\nfunction main(): void { }\n";
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toContain(DiagCode.VoidTypeNotAllowed);
  });

  it("ST-13: a non-constant enum member value is E10230", () => {
    const src =
      "module Main;\nlet x: byte = 1;\nenum E { A = x }\nfunction main(): void { }\n";
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toContain(DiagCode.EnumValueNotConst);
  });

  it("ST-14: auto-increment past 255 is E10143", () => {
    const src = "module Main;\nenum E { A = 255, B }\nfunction main(): void { }\n";
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toContain(DiagCode.EnumBackingOutOfRange);
  });

  it("ST-15: duplicate enum VALUES are legal aliases — compiles clean, E10142 never fires", () => {
    const src =
      "module Main;\nenum E { OK = 0, READY = 0, MAX = 3, COUNT = 3 }\nfunction main(): void { }\n";
    const { diags, model } = analyzeMulti([src]);
    expect(diags).toEqual([]);
    const e = model.enumTypes.get("Main.E");
    expect(e).toBeDefined();
    expect(e!.members.get("OK")).toBe(0);
    expect(e!.members.get("READY")).toBe(0);
    expect(e!.members.get("COUNT")).toBe(3);
  });

  it("ST-16: an unknown named element type is E10151", () => {
    const src = "module Main;\nlet a: Unknown[2];\nfunction main(): void { }\n";
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toContain(DiagCode.UnknownType);
  });

  it("ST-16: a dotted annotation naming a non-exported type is E10012", () => {
    const gfx = "module Gfx;\nstruct Hidden { x: byte; }\n";
    const main = "module Main;\nlet p: Gfx.Hidden;\nfunction main(): void { }\n";
    const { diags } = analyzeMulti([gfx, main]);
    expect(errorCodes(diags)).toContain(DiagCode.ImportNonExported);
  });

  it("resolves an imported struct type in an annotation (`import { Point } from Gfx`)", () => {
    const gfx = "module Gfx;\nexport struct Point { x: byte; y: byte; }\n";
    const main =
      "module Main;\nimport { Point } from Gfx;\nlet p: Point;\nfunction main(): void { }\n";
    const { diags, model } = analyzeMulti([gfx, main]);
    expect(diags).toEqual([]);
    expect(model.structTypes.get("Gfx.Point")).toBeDefined();
    // Exactly one Point type exists — the import aliased it, never re-keyed it.
    const pointKeys = [...model.structTypes.keys()].filter((k) => k.endsWith(".Point"));
    expect(pointKeys).toEqual(["Gfx.Point"]);
  });
});
