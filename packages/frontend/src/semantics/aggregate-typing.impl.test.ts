/**
 * Implementation tests for aggregate expression typing internals: mixed
 * index/member chain torture, poison propagation (one root cause), typeMap
 * completeness over aggregate nodes, cross-module member chains, and an
 * adversarial sweep (deep nesting, huge sizes, cyclic + malformed combos)
 * that must produce clean diagnostics — never a crash.
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

describe("aggregate typing — chains and completeness", () => {
  it("types a mixed chain `world.rooms[i].door.keys[j]` end-to-end", () => {
    const src =
      "module Main;\n" +
      "struct Door { keys: byte[4]; locked: boolean; }\n" +
      "struct Room { door: Door; id: byte; }\n" +
      "struct World { rooms: Room[3]; }\n" +
      "let world: World;\n" +
      "function main(): void {\n" +
      "  let i: byte = 1;\n  let j: byte = 2;\n" +
      "  world.rooms[i].door.keys[j] = 9;\n" +
      "  let v: byte = world.rooms[i].door.keys[j];\n" +
      "}\n";
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
  });

  it("stamps typeMap for every link of a nested chain", () => {
    const src =
      "module Main;\n" +
      "struct Pos { x: byte; y: byte; }\nstruct Player { pos: Pos; }\n" +
      "let player: Player;\n" +
      "function main(): void { let v: byte = player.pos.x; }\n";
    const { model, programs } = analyzeMulti([src]);
    // Walk to the initialiser chain: player.pos.x
    const main = programs[0]!.items.find((i) => i.kind === "FunctionDecl" && i.name === "main");
    if (main?.kind !== "FunctionDecl") throw new Error("expected main");
    const letStmt = main.body.statements[0]!;
    if (letStmt.kind !== "LetDecl" || letStmt.initialiser === null) throw new Error("shape");
    const outer = letStmt.initialiser; // player.pos.x
    if (outer.kind !== "FieldAccessExpr") throw new Error("shape");
    const inner = outer.object; // player.pos
    if (inner.kind !== "FieldAccessExpr") throw new Error("shape");
    expect(model.typeOf(outer).kind).toBe("primitive");
    expect(model.typeOf(inner).kind).toBe("struct");
    expect(model.typeOf(inner.object).kind).toBe("struct");
  });

  it("poisons once — a bad head does not cascade through the chain", () => {
    const src =
      "module Main;\n" +
      "function main(): void { let v: byte = ghost.pos.x[2].y; }\n";
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([DiagCode.UndeclaredIdentifier]);
  });

  it("resolves cross-module chains: imported struct, Mod.Enum.Member, Mod.arr[i]", () => {
    const gfx =
      "module Gfx;\n" +
      "export struct Point { x: byte; y: byte; }\n" +
      "export enum Dir { UP, DOWN = 3 }\n" +
      "export const TABLE: byte[4] = [10, 20, 30; 5];\n";
    const main =
      "module Main;\n" +
      "import { Point } from Gfx;\n" +
      "let p: Point;\n" +
      "function main(): void {\n" +
      "  p.x = <byte>(Gfx.Dir.DOWN);\n" +
      "  let i: byte = 1;\n" +
      "  let t: byte = Gfx.TABLE[i];\n" +
      "}\n";
    const { diags } = analyzeMulti([gfx, main]);
    expect(errorCodes(diags)).toEqual([]);
  });

  it("rejects writes through a const aggregate root (E10191)", () => {
    const src =
      "module Main;\n" +
      "const T: byte[3] = [1, 2, 3];\n" +
      "function main(): void { T[0] = 9; }\n";
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toContain(DiagCode.AssignToConst);
  });
});

describe("aggregate typing — adversarial sweep (clean diagnostics, never a crash)", () => {
  it("survives deep literal nesting", () => {
    const depth = 30;
    const open = "[".repeat(depth);
    const close = "]".repeat(depth);
    const src = `module Main;\nlet a: byte[2] = ${open}1${close};\nfunction main(): void { }\n`;
    expect(() => analyzeMulti([src])).not.toThrow();
  });

  it("survives huge declared sizes without evaluating forever", () => {
    const src =
      "module Main;\nlet a: byte[65535];\nlet b: word[40000];\nfunction main(): void { }\n";
    const { diags } = analyzeMulti([src]);
    expect(diags.length).toBeGreaterThan(0); // loud tier rejection, not silence
  });

  it("survives a cyclic + malformed combination in one program", () => {
    const src =
      "module Main;\n" +
      "struct A { b: B; }\nstruct B { a: A; }\n" +
      "const N: byte = sizeof(A);\n" +
      "let x: byte[N];\n" +
      "let y: Unknown[2];\n" +
      "enum E { M = x }\n" +
      "function main(): void { let v: byte = x[|]; }\n";
    expect(() => analyzeMulti([src])).not.toThrow();
    const { diags } = analyzeMulti([src]);
    expect(diags.filter((d) => d.code === DiagCode.RecursiveStructLayout)).toHaveLength(1);
  });

  it("survives a 200-level member-access chain", () => {
    const chain = "p" + ".x".repeat(200);
    const src =
      "module Main;\nstruct P { x: byte; }\nlet p: P;\n" +
      `function main(): void { let v: byte = ${chain}; }\n`;
    expect(() => analyzeMulti([src])).not.toThrow();
  });
});
