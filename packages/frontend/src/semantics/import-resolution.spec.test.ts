/**
 * Specification tests for user-module import resolution — importing a
 * non-exported function is rejected (E10012), and a valid exported-function
 * import resolves so the call types normally and the cross-module call edge
 * lands in the model's call graph.
 *
 * Expectations derive from the frozen spec Ch 10 §4 — never from the
 * implementation. Exercised through the real public path
 * (`lex`→`parse`→`analyze`) over multiple source files.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { Diagnostic, DiagnosticBag, SemanticModel } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

/** Lexes + parses each source (ids 1..n) + analyzes them together. */
function analyzeMulti(sources: readonly string[]): {
  diags: Diagnostic[];
  model: SemanticModel;
} {
  const bag: DiagnosticBag = createDiagnosticBag();
  const programs = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  return { diags: bag.getAll(), model };
}

const MATH_EXPORTED =
  "module Math;\n" +
  "export function add(a: byte, b: byte): byte { return a + b; }\n";

const MATH_PRIVATE =
  "module Math;\n" + "function add(a: byte, b: byte): byte { return a + b; }\n";

const MAIN_IMPORTS =
  "module Main;\n" +
  "import { add } from Math;\n" +
  "function main(): void { let r: byte = add(1, 2); }\n";

describe("Specification: user-module import resolution", () => {
  it("should reject importing a non-exported function with E10012 naming it", () => {
    const { diags } = analyzeMulti([MAIN_IMPORTS, MATH_PRIVATE]);
    const codes = diags.map((d) => d.code);
    expect(codes).toContain(DiagCode.ImportNonExported);
    const nonExported = diags.find((d) => d.code === DiagCode.ImportNonExported);
    expect(nonExported?.message).toContain("add");
    expect(nonExported?.message).toContain("Math");
  });

  it("should resolve a valid exported import, type the call, and record the call edge", () => {
    const { diags, model } = analyzeMulti([MAIN_IMPORTS, MATH_EXPORTED]);
    expect(diags).toEqual([]);

    const fns = [...model.callGraph.functions];
    const mainSym = fns.find((f) => f.name === "main");
    const addSym = fns.find((f) => f.name === "add");
    expect(mainSym).toBeDefined();
    expect(addSym).toBeDefined();
    if (mainSym === undefined || addSym === undefined) return;

    // The edge targets the very symbol declared in Math (aliased, not copied).
    const callees = model.callGraph.edges.get(mainSym);
    expect(callees?.has(addSym)).toBe(true);
  });
});
