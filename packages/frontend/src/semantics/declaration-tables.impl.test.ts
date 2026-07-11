/**
 * Implementation tests for module-keyed declaration collection internals:
 * FQN table keying, module-scope type symbols (kinds/flags), enum
 * auto-increment sequencing, dotted cross-module field types, duplicate-field
 * rejection, deterministic diagnostic ordering, and the cross-module
 * same-name regression exercised end-to-end through `analyze`.
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

const MAIN = "module Main;\nfunction main(): void { }\n";

describe("declaration tables — internals", () => {
  it("keys the tables by fully-qualified 'Module.Name'", () => {
    const src =
      "module Gfx;\nexport struct Point { x: byte; y: byte; }\nexport enum Dir { UP, DOWN }\n";
    const { diags, model } = analyzeMulti([src, MAIN]);
    expect(diags).toEqual([]);
    expect([...model.structTypes.keys()]).toEqual(["Gfx.Point"]);
    expect([...model.enumTypes.keys()]).toEqual(["Gfx.Dir"]);
  });

  it("declares struct/enum symbols in the module scope with kind + exported flags", () => {
    const src =
      "module Gfx;\nexport struct Point { x: byte; }\nenum Hidden { A }\n";
    const { diags, model } = analyzeMulti([src, MAIN]);
    expect(diags).toEqual([]);
    const gfxScope = model.globalScope.children.find(
      (c) => c.kind === "module" && c.symbols.has("Point"),
    );
    expect(gfxScope).toBeDefined();
    const point = gfxScope!.symbols.get("Point")!;
    expect(point.kind).toBe("struct");
    expect(point.exported).toBe(true);
    expect(point.type.kind).toBe("struct");
    const hidden = gfxScope!.symbols.get("Hidden")!;
    expect(hidden.kind).toBe("enum");
    expect(hidden.exported).toBe(false);
  });

  it("sequences enum auto-increment from explicit values (0,3,4,5 shape)", () => {
    const src = "module Main;\nenum Direction { UP, DOWN = 3, LEFT, RIGHT }\nfunction main(): void { }\n";
    const { diags, model } = analyzeMulti([src]);
    expect(diags).toEqual([]);
    const dir = model.enumTypes.get("Main.Direction")!;
    expect([...dir.members.entries()]).toEqual([
      ["UP", 0],
      ["DOWN", 3],
      ["LEFT", 4],
      ["RIGHT", 5],
    ]);
  });

  it("resolves a dotted cross-module struct field type", () => {
    const gfx = "module Gfx;\nexport struct Point { x: byte; y: byte; }\n";
    const game = "module Game;\nstruct Player { pos: Gfx.Point; hp: byte; }\n";
    const { diags, model } = analyzeMulti([gfx, game, MAIN]);
    expect(diags).toEqual([]);
    const player = model.structTypes.get("Game.Player")!;
    expect(player.byteSize).toBe(3);
    expect(player.fields.get("pos")!.type.kind).toBe("struct");
    expect(player.fields.get("hp")!.offset).toBe(2);
  });

  it("rejects a duplicate struct field with E10003 and keeps the first", () => {
    const src = "module Main;\nstruct S { x: byte; x: word; }\nfunction main(): void { }\n";
    const { diags, model } = analyzeMulti([src]);
    expect(diags.some((d) => d.code === DiagCode.DuplicateDecl)).toBe(true);
    const s = model.structTypes.get("Main.S")!;
    expect(s.fields.get("x")!.type).toEqual({ kind: "primitive", name: "byte" });
    expect(s.byteSize).toBe(1);
  });

  it("reports duplicate declarations deterministically, in source order", () => {
    const src =
      "module M;\nstruct A { x: byte; }\nstruct A { y: byte; }\nenum B { X }\nenum B { Y }\n";
    const { diags } = analyzeMulti([src, MAIN]);
    const dups = diags.filter((d) => d.code === DiagCode.DuplicateDecl);
    expect(dups).toHaveLength(2);
    // Source order: the duplicated struct comes before the duplicated enum.
    expect(dups[0]!.primarySpan!.start).toBeLessThan(dups[1]!.primarySpan!.start);
  });

  it("regression: two modules' same-named structs stay independently usable end-to-end", () => {
    // The historical defect: bare-name-keyed tables let the LAST module's
    // `Point` silently overwrite the first, so annotations in module A
    // resolved to B's layout.
    const modA =
      "module A;\nexport struct Point { x: byte; }\nexport let pa: Point;\n";
    const modB =
      "module B;\nexport struct Point { x: word; y: word; }\nexport let pb: Point;\n";
    const { diags, model } = analyzeMulti([modA, modB, MAIN]);
    expect(diags).toEqual([]);

    const scopes = model.globalScope.children.filter((c) => c.kind === "module");
    const symA = scopes.map((s) => s.symbols.get("pa")).find((s) => s !== undefined);
    const symB = scopes.map((s) => s.symbols.get("pb")).find((s) => s !== undefined);
    expect(symA?.type.kind).toBe("struct");
    expect(symB?.type.kind).toBe("struct");
    if (symA?.type.kind !== "struct" || symB?.type.kind !== "struct") return;
    expect(symA.type.byteSize).toBe(1);
    expect(symB.type.byteSize).toBe(4);
    expect(symA.type).not.toBe(symB.type);
  });
});
