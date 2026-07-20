import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { ProgramNode } from "@blend65/core";
import { analyze, lex, modelNeedsPointerScratch, modelToFunctionInfo, modelToModuleVars, parse, planAllocation } from "@blend65/frontend";
import { lowerToIL } from "./lower.js";

function run(sources: string[]) {
  const bag = createDiagnosticBag();
  const programs: ProgramNode[] = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  const plan = planAllocation({ functions: modelToFunctionInfo(model), moduleVars: modelToModuleVars(model), zpUserVars: [], upstreamErrors: bag.hasErrors(), needsPointerScratch: modelNeedsPointerScratch(model) }, DEFAULT_PROFILE, bag);
  const il = lowerToIL({ program: programs, model, plan }, bag);
  return { il, diags: bag.getAll() };
}

describe("probe", () => {
  it("cross-module const address-of", () => {
    const { il, diags } = run([
      ["module Gfx;", "export const TABLE: byte[3] = [1, 2, 3];"].join("\n"),
      ["module Main;", "const LOCAL: byte[3] = [4, 5, 6];", "function main(): void {", "  let p: word = &Gfx.TABLE;", "  let i: byte = 1;", "  poke($C000, LOCAL[i]);", "}"].join("\n"),
    ]);
    console.log("DIAGS:", JSON.stringify(diags.map(d => ({ code: d.code, msg: d.message })), null, 1));
    console.log("CONSTDATA:", JSON.stringify(il.constData.map(e => ({ s: e.symbol, a: e.aligned }))));
    expect(true).toBe(true);
  });
});
