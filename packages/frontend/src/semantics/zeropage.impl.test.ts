/**
 * Implementation tests for zeropage internals: deterministic projection
 * order across modules, struct-typed fields finalizing through annotation
 * resolution, collisions against function names, initializer cycles through
 * a zeropage variable, and unsized-array inference parity.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, ProgramNode, SemanticModel } from "@blend65/core";
import { lex, parse } from "../index.js";
import { analyze } from "./analyze.js";
import { modelToZpUserVars } from "../sfa/model-adapter.js";

/** Analyzes sources and returns the model + diagnostics. */
function analyzeMulti(sources: string[]): {
  model: SemanticModel;
  diags: Diagnostic[];
  hasErrors: boolean;
} {
  const bag = createDiagnosticBag();
  const programs: ProgramNode[] = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  return { model, diags: bag.getAll(), hasErrors: bag.hasErrors() };
}

describe("zeropage internals", () => {
  it("projects user vars in module order then declaration order", () => {
    const { model, hasErrors } = analyzeMulti([
      ["module Snd;", "zeropage { volume: byte; tick: byte; }"].join("\n"),
      ["module Main;", "zeropage { count: byte; }", "function main(): void { }"].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(modelToZpUserVars(model).map((v) => v.name)).toEqual([
      "__zp_Snd_volume",
      "__zp_Snd_tick",
      "__zp_Main_count",
    ]);
  });

  it("finalizes a struct-typed field through annotation resolution (2-byte projection)", () => {
    const { model, hasErrors } = analyzeMulti([
      [
        "module Main;",
        "struct Pos { x: byte; y: byte; }",
        "zeropage { p: Pos; }",
        "function main(): void { p.x = 1; }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(modelToZpUserVars(model)).toEqual([{ name: "__zp_Main_p", size: 2 }]);
  });

  it("rejects a field colliding with a function name (E10003)", () => {
    const { diags } = analyzeMulti([
      ["module Main;", "function tick(): void { }", "zeropage { tick: byte; }", "function main(): void { }"].join("\n"),
    ]);
    expect(diags.map((d) => d.code)).toContain(DiagCode.DuplicateDecl);
  });

  it("rejects an initializer cycle through a zeropage variable (E10194)", () => {
    const { diags } = analyzeMulti([
      [
        "module Main;",
        "zeropage { a: byte = b + 1; }",
        "let b: byte = a + 1;",
        "function main(): void { }",
      ].join("\n"),
    ]);
    expect(diags.map((d) => d.code)).toContain(DiagCode.CircularInit);
  });

  it("applies unsized-array parity: element list infers, no initializer rejects (E10126)", () => {
    const inferred = analyzeMulti([
      ["module Main;", "zeropage { xs: byte[] = [1, 2]; }", "function main(): void { }"].join("\n"),
    ]);
    expect(inferred.hasErrors).toBe(false);
    expect(modelToZpUserVars(inferred.model)).toEqual([{ name: "__zp_Main_xs", size: 2 }]);

    const bare = analyzeMulti([
      ["module Main;", "zeropage { xs: byte[]; }", "function main(): void { }"].join("\n"),
    ]);
    expect(bare.diags.map((d) => d.code)).toContain(DiagCode.FillRequiresExplicitSize);
  });
});
