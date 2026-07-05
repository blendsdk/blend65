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
import type {
  AstNode,
  DiagnosticBag,
  FunctionDeclNode,
  ModuleDeclNode,
  ProgramNode,
} from "@blend65/core";
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
  // ST-S21 — parse a valid program then analyze. RD-18 Slice 3a populated the
  // function surface (main + call graph) for a program with a `main`; RD-18
  // Slice 3b now also populates the type map (poke's literal args are typed),
  // superseding the 3a empty-maps passthrough (D5→populated, AR-12) — parallel to
  // the 3a `mainFunction` edit below. `symbolMap` stays empty here only because
  // VALID_SOURCE contains no identifier references. The analyzer stays error-free.
  it("should populate the function surface and the type map (ST-S21, AR-9/AR-12)", () => {
    const bag = createDiagnosticBag();
    const ast = parseSource(VALID_SOURCE, bag);

    const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });

    expect(model.hasErrors).toBe(false);
    expect(model.mainFunction?.name).toBe("main"); // 3a populates the entry (was: toBeNull)
    expect(model.callGraph.functions.size).toBe(1);
    expect(model.globalScope.kind).toBe("global");
    expect(model.typeMap.size).toBeGreaterThan(0); // 3b — poke's literal args are typed
    expect(model.symbolMap.size).toBe(0); // VALID_SOURCE has no identifier references
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

// ───────────────────────────────────────────────────────────────────────────
// RD-18 Slice 3a — the populated-model wiring (FR-1; AR-9/10/13)
// ───────────────────────────────────────────────────────────────────────────

/** The Slice 3a fixture: one `main` with a single local `byte`. */
const SLICE3A_SOURCE = `module Main;\nfunction main(): void { let x: byte = 5; poke(0xD020, x); }\n`;

/** A function-free, intrinsic-free program (a lone struct declaration). */
const FUNCTION_FREE_SOURCE = `module Data;\nstruct Point { x: byte; y: byte; }\n`;

/** Narrows a scope's introducing node to a {@link ModuleDeclNode}. */
function isModuleDecl(node: AstNode | null): node is ModuleDeclNode {
  return node !== null && node.kind === "ModuleDecl";
}

/** The `main` `FunctionDecl` in a parsed program. */
function mainDeclOf(program: ProgramNode): FunctionDeclNode {
  const decl = program.items.find(
    (item): item is FunctionDeclNode => item.kind === "FunctionDecl" && item.name === "main",
  );
  if (decl === undefined) throw new Error("test fixture must declare main");
  return decl;
}

describe("Specification: RD-18 Slice 3a analyze() population (FR-1)", () => {
  // ST-3 — analyze() on the 3a fixture returns a populated model.
  it("should populate main, mainFunction, module scope, and the body scope (ST-3)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(SLICE3A_SOURCE, bag);

    const model = analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    // main ∈ callGraph.functions and mainFunction is set to it.
    expect(model.callGraph.functions.size).toBe(1);
    const main = [...model.callGraph.functions][0];
    expect(main?.name).toBe("main");
    expect(model.mainFunction).toBe(main);

    // main.scope is the module scope whose node.name === "Main" (AR-13).
    expect(main?.scope.kind).toBe("module");
    const modNode = main?.scope.node ?? null;
    expect(isModuleDecl(modNode) ? modNode.name : null).toBe("Main");

    // scopeOf(mainDecl) → the body scope containing the local `x` (AR-10).
    const bodyScope = model.scopeOf(mainDeclOf(program));
    expect(bodyScope.kind).toBe("function");
    expect(bodyScope.symbols.get("x")?.kind).toBe("variable");
  });

  // ST-4 — a function-free, intrinsic-free program keeps the empty passthrough.
  it("should keep the empty passthrough for a function-free program (ST-4 / AR-9)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(FUNCTION_FREE_SOURCE, bag);
    const before = bag.count();

    let model!: ReturnType<typeof analyze>;
    expect(() => {
      model = analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });
    }).not.toThrow();

    expect(model.callGraph.functions.size).toBe(0);
    expect(model.mainFunction).toBeNull();
    expect(bag.count()).toBe(before); // no diagnostics from population
  });
});
