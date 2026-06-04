/**
 * Specification tests for the RD-04 scope/symbol/call-graph/model vocabulary
 * (skeleton).
 *
 * Derived exclusively from plans/rd-04-semantic-analysis/07-testing-strategy.md
 * (ST-S13..ST-S20) and 03-02-scope-symbol-model.md — NOT from implementation
 * logic. They verify the §4.2/§4.3/§4.7/§4.8/§4.10 shapes are constructible and
 * that the passthrough `createEmptyModel()` returns the documented empty model
 * (D2): no errors, no main, a lone global scope, empty maps, and query helpers
 * that return the documented safe values.
 *
 * Spec-tests-first (testing.md Rule 10): authored before the implementation;
 * immutable oracle.
 */

import { describe, expect, it } from "vitest";
import { makeSpan } from "../index.js";
import type { SourceSpan, AstNode, ExprNode, IdentExprNode } from "../index.js";
import {
  primitive,
  createScope,
  emptyCallGraph,
  createEmptyModel,
} from "../index.js";
import type { Scope, Symbol as SemSymbol, ConstValue } from "../index.js";

/** A zero-width span for the synthetic AST nodes used as symbol/expr provenance. */
const SPAN: SourceSpan = makeSpan(0, 0, 0);

/** A bare identifier expression used to probe the model's query helpers. */
const IDENT: IdentExprNode = { kind: "IdentExpr", name: "x", span: SPAN };

describe("Specification: RD-04 scope / symbol / const-value / call-graph", () => {
  // ST-S13 — createScope builds an empty global scope.
  it("should create an empty global scope (ST-S13)", () => {
    const scope = createScope("global", null, null);
    expect(scope.kind).toBe("global");
    expect(scope.parent).toBeNull();
    expect(scope.children).toEqual([]);
    expect(scope.symbols.size).toBe(0);
    expect(scope.node).toBeNull();
  });

  // ST-S14 — a Symbol literal builds against the Symbol/SymbolKind interface.
  it("should construct a Symbol against the §4.3 interface (ST-S14)", () => {
    const scope: Scope = createScope("global", null, null);
    const sym: SemSymbol = {
      name: "counter",
      kind: "variable",
      type: primitive("byte"),
      decl: IDENT as AstNode,
      scope,
      exported: false,
      mutable: true,
      byRef: false,
    };
    expect(sym.name).toBe("counter");
    expect(sym.kind).toBe("variable");
    expect(sym.byRef).toBe(false);
  });

  // ST-S15 — a ConstValue literal builds.
  it("should construct a ConstValue { type, value } (ST-S15)", () => {
    const cv: ConstValue = { type: primitive("byte"), value: 42 };
    expect(cv.value).toBe(42);
    expect(cv.type.kind).toBe("primitive");
  });

  // ST-S16 — the empty call graph has no functions, edges, or cycles.
  it("should build an empty call graph with no cycles (ST-S16)", () => {
    const cg = emptyCallGraph();
    expect(cg.functions.size).toBe(0);
    expect(cg.edges.size).toBe(0);
    expect(cg.findCycles()).toEqual([]);
  });
});

describe("Specification: RD-04 createEmptyModel() passthrough (D2)", () => {
  // ST-S17 — the empty model's overall shape.
  it("should return an empty, error-free model with a lone global scope (ST-S17)", () => {
    const model = createEmptyModel();
    expect(model.hasErrors).toBe(false);
    expect(model.mainFunction).toBeNull();
    expect(model.globalScope.kind).toBe("global");
    expect(model.typeMap.size).toBe(0);
    expect(model.symbolMap.size).toBe(0);
    expect(model.constValues.size).toBe(0);
    expect(model.structTypes.size).toBe(0);
    expect(model.enumTypes.size).toBe(0);
    expect(model.initOrder.length).toBe(0);
  });

  // ST-S18 — typeOf returns the ERROR_TYPE poison.
  it("should return ERROR_TYPE from typeOf for any expr (ST-S18)", () => {
    const model = createEmptyModel();
    expect(model.typeOf(IDENT as ExprNode).kind).toBe("error");
  });

  // ST-S19 — symbolOf returns null.
  it("should return null from symbolOf for any node (ST-S19)", () => {
    const model = createEmptyModel();
    expect(model.symbolOf(IDENT as AstNode)).toBeNull();
  });

  // ST-S20 — scopeOf returns the model's own globalScope (same reference).
  it("should return the model's globalScope from scopeOf (ST-S20)", () => {
    const model = createEmptyModel();
    expect(model.scopeOf(IDENT as AstNode)).toBe(model.globalScope);
  });
});
