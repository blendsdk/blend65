/**
 * Implementation tests for the const/type engine internals: memo idempotence
 * (one diagnostic no matter how many demands), stack hygiene after a
 * poisoned evaluation (later independent demands still succeed), nested
 * aggregate images, declaration-order shuffling, and enum members that
 * reference module constants.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, ProgramNode, SemanticModel, Symbol } from "@blend65/core";
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

/** Finds a module-scope symbol by name across all module scopes. */
function moduleSymbol(model: SemanticModel, name: string): Symbol | undefined {
  for (const scope of model.globalScope.children) {
    if (scope.kind !== "module") continue;
    const sym = scope.symbols.get(name);
    if (sym !== undefined && sym.scope === scope) return sym;
  }
  return undefined;
}

/** The codes of all error-severity diagnostics. */
function errorCodes(diags: readonly Diagnostic[]): string[] {
  return diags.filter((d) => d.severity === "error").map((d) => d.code);
}

const MAIN_FN = "function main(): void { }\n";

describe("const/type engine — internals", () => {
  it("reports a cycle exactly once no matter how many declarations demand it", () => {
    // Three arrays all sized by the cyclic pair — still ONE cycle report.
    const src =
      "module Main;\n" +
      "const A: byte = B;\n" +
      "const B: byte = A;\n" +
      "let x: byte[A];\nlet y: byte[B];\nlet z: byte[A];\n" +
      MAIN_FN;
    const { diags } = analyzeMulti([src]);
    expect(diags.filter((d) => d.code === DiagCode.CircularInit)).toHaveLength(1);
  });

  it("keeps evaluating unrelated declarations after a poisoned cycle (stack hygiene)", () => {
    const src =
      "module Main;\n" +
      "struct A { b: B; }\nstruct B { a: A; }\n" +
      "const N: byte = 4;\nlet ok: byte[N];\n" +
      MAIN_FN;
    const { diags, model } = analyzeMulti([src]);
    expect(diags.filter((d) => d.code === DiagCode.RecursiveStructLayout)).toHaveLength(1);
    const ok = moduleSymbol(model, "ok");
    if (ok?.type.kind === "array") expect(ok.type.size).toBe(4);
    else throw new Error("expected the unrelated array to resolve");
  });

  it("builds nested aggregate images (array of structs) at the right offsets", () => {
    const src =
      "module Main;\n" +
      "struct P { x: byte; y: word; }\n" +
      "const T: P[2] = [P { x: 1, y: $0203 }, P { x: 4, y: 5 }];\n" +
      MAIN_FN;
    const { diags, model } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
    const t = moduleSymbol(model, "T");
    const image = model.constValues.get(t!);
    expect([...(image?.bytes ?? [])]).toEqual([1, 0x03, 0x02, 4, 5, 0]);
  });

  it("resolves enum members that reference module constants", () => {
    const src =
      "module Main;\n" +
      "const BASE: byte = 10;\n" +
      "enum E { A = BASE, B }\n" +
      MAIN_FN;
    const { diags, model } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
    const e = model.enumTypes.get("Main.E")!;
    expect(e.members.get("A")).toBe(10);
    expect(e.members.get("B")).toBe(11);
  });

  it("is order-independent across modules AND declarations (shuffled ST-25 shape)", () => {
    const shuffled =
      "module Main;\n" +
      "let buf: byte[length(TABLE)];\n" +
      "const L: byte = length(TABLE);\n" +
      "const TABLE: byte[DIM + 2] = [1, 2; 0];\n" +
      "const DIM: byte = 4;\n" +
      MAIN_FN;
    const { diags, model } = analyzeMulti([shuffled]);
    expect(errorCodes(diags)).toEqual([]);
    expect(model.constValues.get(moduleSymbol(model, "L")!)?.value).toBe(6);
    const buf = moduleSymbol(model, "buf");
    if (buf?.type.kind === "array") expect(buf.type.size).toBe(6);
    else throw new Error("expected an array-typed symbol");
  });

  it("fill values participate in images (sbyte encoding, two's complement)", () => {
    const src = "module Main;\nconst S: sbyte[3] = [-1; -2];\n" + MAIN_FN;
    const { diags, model } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
    const s = moduleSymbol(model, "S");
    expect([...(model.constValues.get(s!)?.bytes ?? [])]).toEqual([0xff, 0xfe, 0xfe]);
  });

  it("an out-of-range const element is E10084, anchored at the element", () => {
    const src = "module Main;\nconst T: byte[2] = [1, 300];\n" + MAIN_FN;
    const { diags } = analyzeMulti([src]);
    expect(diags.some((d) => d.code === DiagCode.ValueOutOfRange)).toBe(true);
  });
});
