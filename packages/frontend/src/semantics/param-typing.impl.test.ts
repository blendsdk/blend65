import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, SemanticModel, Symbol } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

/**
 * Implementation tests for the by-reference parameter surface: the
 * assignment-root walk through mixed member/index chains, signature
 * resolution edges (dotted cross-module annotations, constant-expression
 * sizes), and the containment invariant that an unsized array type never
 * escapes parameter symbols.
 */

/** Lexes + parses each source (ids 1..n) + analyzes them together. */
function analyzeMulti(sources: readonly string[]): {
  diags: Diagnostic[];
  model: SemanticModel;
} {
  const bag = createDiagnosticBag();
  const programs = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  return { diags: bag.getAll(), model };
}

/** The codes of all error-severity diagnostics. */
function errorCodes(diags: readonly Diagnostic[]): string[] {
  return diags.filter((d) => d.severity === "error").map((d) => d.code);
}

/** Every symbol reachable from the model's global scope, depth-first. */
function allSymbols(model: SemanticModel): Symbol[] {
  const out: Symbol[] = [];
  const seen = new Set<object>();
  const visit = (scope: (typeof model)["globalScope"]): void => {
    if (seen.has(scope)) return;
    seen.add(scope);
    for (const sym of scope.symbols.values()) out.push(sym);
    for (const child of scope.children) visit(child);
  };
  visit(model.globalScope);
  return out;
}

describe("root-walk through mixed chains", () => {
  it("finds the const-param root through an index-then-field chain", () => {
    const src = [
      "module Main;",
      "struct Enemy { hp: byte; }",
      "function f(es: const Enemy[3]): void { es[1].hp = 0; }",
      "function main(): void { let a: Enemy[3]; f(a); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([src]).diags)).toContain(DiagCode.ModifyConstParam);
  });

  it("does not flag by-value scalar params: no E10122 for const scalar args, no W10112 for repeats", () => {
    const src = [
      "module Main;",
      "const K: byte = 7;",
      "function f(a: byte, b: byte): byte { return a + b; }",
      "function main(): void { poke($C000, f(K, K)); }",
    ].join("\n");
    const { diags } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
    expect(diags.some((d) => d.code === DiagCode.PossibleAliasing)).toBe(false);
  });
});

describe("signature resolution edges", () => {
  it("resolves a dotted cross-module struct annotation on a parameter", () => {
    const gfx = "module Gfx;\nexport struct Sprite { x: byte; }\n";
    const main = [
      "module Main;",
      "import { Sprite } from Gfx;",
      "function move(s: Gfx.Sprite): void { s.x = 1; }",
      "function main(): void { let sp: Sprite; move(sp); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([gfx, main]).diags)).toEqual([]);
  });

  it("resolves a constant-expression-sized parameter annotation and enforces it", () => {
    const ok = [
      "module Main;",
      "const SIZE: byte = 4;",
      "function f(t: byte[SIZE]): void { t[0] = 1; }",
      "function main(): void { let a: byte[4]; f(a); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([ok]).diags)).toEqual([]);

    const mismatch = [
      "module Main;",
      "const SIZE: byte = 4;",
      "function f(t: byte[SIZE]): void { t[0] = 1; }",
      "function main(): void { let a: byte[5]; f(a); }",
    ].join("\n");
    expect(errorCodes(analyzeMulti([mismatch]).diags)).toContain(DiagCode.ArgTypeMismatch);
  });
});

describe("unsized containment", () => {
  it("keeps `size: null` on parameter symbols only — every other array symbol is sized", () => {
    const src = [
      "module Main;",
      "export const TABLE: byte[] = [3, 5, 7];",
      "let m: byte[] = [4, 5, 6];",
      "function f(d: byte[]): byte { return d[0]; }",
      "function main(): void {",
      "  let a: byte[] = [1, 2];",
      "  poke($C000, f(a));",
      "}",
    ].join("\n");
    const { diags, model } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);

    for (const sym of allSymbols(model)) {
      if (sym.type.kind !== "array") continue;
      if (sym.kind === "parameter") {
        expect(sym.type.size).toBeNull();
        expect(sym.byRef).toBe(true);
      } else {
        expect(sym.type.size).not.toBeNull();
      }
    }
  });

  it("patches byRef per finalized annotation: struct/array true, enum/scalar false", () => {
    const src = [
      "module Main;",
      "struct P { x: byte; }",
      "enum Dir { UP, DOWN }",
      "function f(p: P, d: Dir, n: byte, t: byte[2]): void { p.x = n; }",
      "function main(): void { let v: P; let a: byte[2]; f(v, Dir.UP, 1, a); }",
    ].join("\n");
    const { diags, model } = analyzeMulti([src]);
    expect(errorCodes(diags)).toEqual([]);
    const byName = new Map(
      allSymbols(model)
        .filter((s) => s.kind === "parameter")
        .map((s) => [s.name, s.byRef]),
    );
    expect(byName.get("p")).toBe(true);
    expect(byName.get("t")).toBe(true);
    expect(byName.get("d")).toBe(false);
    expect(byName.get("n")).toBe(false);
  });
});
