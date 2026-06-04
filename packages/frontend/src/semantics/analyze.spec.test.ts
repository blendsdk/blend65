/**
 * Specification tests for the RD-04 passthrough `analyze()` (skeleton).
 *
 * Derived exclusively from plans/rd-04-semantic-analysis/07-testing-strategy.md
 * (ST-S21..ST-S26), 03-03-passthrough-analyzer.md, and AC-01 — NOT from
 * implementation logic. They verify the end-to-end passthrough contract:
 * `parse()` → `analyze()` returns a structurally-valid empty `SemanticModel`
 * (D2), emits no diagnostics (D3), and never throws (AC-01) — for valid,
 * error-laden, and empty inputs.
 *
 * Spec-tests-first (testing.md Rule 10): authored before the implementation;
 * immutable oracle. The tests compose the REAL lexer + parser + diagnostic bag
 * (prefer real objects) through the package public barrels.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { DiagnosticBag, ProgramNode } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** A small, valid gate program (matches the RD-04 testing-strategy fixture). */
const VALID_SOURCE = `module Main;\nfunction main(): void { poke(0xD020, 5); }\n`;

/** A source that yields parser error-sentinels (no leading `module`, junk token). */
const ERROR_SOURCE = `@@@ not a program`;

/** Lexes + parses `source` through the public entry points, returning the AST. */
function parseSource(source: string, bag: DiagnosticBag): ProgramNode {
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  return ast;
}

describe("Specification: RD-04 passthrough analyze() (AC-01)", () => {
  // ST-S21 — parse a valid program then analyze: empty, error-free model.
  it("should return an empty error-free model for a valid program (ST-S21)", () => {
    const bag = createDiagnosticBag();
    const ast = parseSource(VALID_SOURCE, bag);

    const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });

    expect(model.hasErrors).toBe(false);
    expect(model.mainFunction).toBeNull();
    expect(model.globalScope.kind).toBe("global");
    expect(model.typeMap.size).toBe(0);
    expect(model.symbolMap.size).toBe(0);
  });

  // ST-S22 — analyze an AST containing parser error-sentinels: no throw.
  it("should analyze an error-laden AST without throwing (ST-S22, D3)", () => {
    const bag = createDiagnosticBag();
    const ast = parseSource(ERROR_SOURCE, bag);

    // The passthrough ignores the parser's error sentinels entirely.
    const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });

    expect(model.hasErrors).toBe(false); // analyzer adds no errors of its own (D3)
  });

  // ST-S23 — analyze with an empty programs array returns a valid empty model.
  it("should return a valid empty model for an empty programs array (ST-S23)", () => {
    const bag = createDiagnosticBag();

    const model = analyze({ programs: [], bag, profile: DEFAULT_PROFILE });

    expect(model.hasErrors).toBe(false);
    expect(model.mainFunction).toBeNull();
    expect(model.globalScope.kind).toBe("global");
  });

  // ST-S24 — analyze() adds no diagnostics to the passed bag (D3).
  it("should not add any diagnostics to the bag during analyze (ST-S24, D3)", () => {
    const bag = createDiagnosticBag();
    const ast = parseSource(VALID_SOURCE, bag);
    const before = bag.count();

    analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });

    expect(bag.count()).toBe(before); // unchanged — analyzer is silent
  });

  // ST-S25 — AnalyzeInput is constructible from { programs, bag, profile } (D6).
  it("should accept an AnalyzeInput object shape (ST-S25, D6)", () => {
    const bag = createDiagnosticBag();
    const ast = parseSource(VALID_SOURCE, bag);

    // Type-checks against AnalyzeInput; analyze returns a model.
    const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
    expect(model).toBeDefined();
    expect(typeof model.typeOf).toBe("function");
  });

  // ST-S26 — analyze is re-exported from the @blend65/frontend public entry.
  it("should re-export analyze from the frontend public barrel (ST-S26)", () => {
    expect(typeof analyze).toBe("function");
  });
});
