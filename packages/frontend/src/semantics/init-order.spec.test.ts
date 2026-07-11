/**
 * Specification tests for module-variable initialization order — per-variable
 * dependency order (frozen spec Ch 10 §5.4): an initializer reading a later-
 * declared variable initializes after it regardless of declaration order;
 * modules order by their import edges (an imported module's variables
 * initialize before the importer's, even when the importer's file is
 * discovered first); and a dependency cycle — through `let` initializers or
 * through `const` definitions — is exactly ONE circular-initializer error per
 * cycle, carrying the spec message anchored at the cycle's first-declared
 * member plus the full cycle path.
 *
 * Expectations derive from the frozen spec Ch 10 §5.4 and Ch 14 — never from
 * the implementation. Exercised through the real public path
 * (`lex`→`parse`→`analyze`).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type {
  Diagnostic,
  DiagnosticBag,
  ProgramNode,
  SemanticModel,
} from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

/** Lexes + parses each source (ids 1..n) + analyzes them together. */
function analyzeMulti(sources: readonly string[]): {
  diags: Diagnostic[];
  model: SemanticModel;
} {
  const bag: DiagnosticBag = createDiagnosticBag();
  const programs: ProgramNode[] = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  return { diags: bag.getAll(), model };
}

describe("Specification: init order — per-variable dependency order", () => {
  it("should initialize a dependency declared later BEFORE its reader", () => {
    const { diags, model } = analyzeMulti([
      "module Main;\n" +
        "let a: byte = b + 1;\n" +
        "let b: byte = 2;\n" +
        "function main(): void {}\n",
    ]);
    expect(diags).toEqual([]);
    expect(model.initOrder.map((s) => s.name)).toEqual(["b", "a"]);
  });

  it("should order an imported module's variables first even when the importer is discovered first", () => {
    // Main is the FIRST source file; its import edge to Math must still put
    // every Math variable ahead of Main's in the initialization order.
    const mainFile =
      "module Main;\n" +
      "import { scaled } from Math;\n" +
      "let combo: byte = Math.scaled + 1;\n" +
      "function main(): void {}\n";
    const mathFile =
      "module Math;\n" + "export let scaled: byte = 4;\n" + "export let other: byte = 9;\n";
    const { diags, model } = analyzeMulti([mainFile, mathFile]);

    expect(diags).toEqual([]);
    // `other` has no variable edge to `combo` — only the module-level import
    // ordering places it before Main's variables.
    expect(model.initOrder.map((s) => s.name)).toEqual(["scaled", "other", "combo"]);
  });
});

describe("Specification: init order — circular initializers", () => {
  it("should reject a let-initializer cycle with ONE error carrying the spec message + path", () => {
    const { diags, model } = analyzeMulti([
      "module Main;\n" +
        "let a: byte = b + 1;\n" +
        "let b: byte = a + 1;\n" +
        "function main(): void {}\n",
    ]);
    const circular = diags.filter((d) => d.code === DiagCode.CircularInit);
    expect(circular).toHaveLength(1);
    expect(circular[0].message).toContain(
      "Circular initializer detected — 'a' depends on itself (directly or indirectly) " +
        "through module-level initialization order",
    );
    expect(circular[0].message).toContain("cycle: a → b → a");
    expect(model.hasErrors).toBe(true);
  });

  it("should reject a const-const cycle with the same one-per-cycle shape", () => {
    const { diags } = analyzeMulti([
      "module Main;\n" +
        "const A: byte = B;\n" +
        "const B: byte = A;\n" +
        "function main(): void {}\n",
    ]);
    const circular = diags.filter((d) => d.code === DiagCode.CircularInit);
    expect(circular).toHaveLength(1);
    expect(circular[0].message).toContain("'A' depends on itself");
    expect(circular[0].message).toContain("cycle: A → B → A");
  });
});
