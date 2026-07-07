/**
 * Implementation tests for the scope tree (skeleton).
 *
 * Where `semantic-model.spec.test.ts` pins the empty-global-scope contract,
 * these tests exercise `createScope` internals: nesting scopes, wiring
 * parent/child links, and populating the symbol map — the mechanics the
 * future checker relies on.
 *
 * Written after implementation, filed as `*.impl.test.ts` per the project's
 * spec-vs-impl test convention.
 */

import { describe, expect, it } from "vitest";
import { makeSpan } from "../index.js";
import type { SourceSpan, AstNode, IdentExprNode } from "../index.js";
import { createScope, primitive } from "../index.js";
import type { Scope, Symbol as SemSymbol } from "../index.js";

const SPAN: SourceSpan = makeSpan(0, 0, 0);
const IDENT: IdentExprNode = { kind: "IdentExpr", name: "x", span: SPAN };

describe("scope — createScope nesting and wiring", () => {
  it("should default a fresh scope to empty children and symbols", () => {
    const scope = createScope("function", null, IDENT as AstNode);
    expect(scope.kind).toBe("function");
    expect(scope.node).toBe(IDENT);
    expect(scope.children).toEqual([]);
    expect(scope.symbols.size).toBe(0);
  });

  it("should allow a child scope to reference its parent", () => {
    const global = createScope("global", null, null);
    const fn = createScope("function", global, IDENT as AstNode);
    expect(fn.parent).toBe(global);
    // The tree is wired explicitly by callers; createScope leaves children empty.
    global.children.push(fn);
    expect(global.children).toContain(fn);
  });

  it("should support nested block scopes forming a chain to global", () => {
    const global = createScope("global", null, null);
    const fn = createScope("function", global, IDENT as AstNode);
    const block = createScope("block", fn, IDENT as AstNode);
    expect(block.parent).toBe(fn);
    expect(block.parent?.parent).toBe(global);
    expect(block.parent?.parent?.parent).toBeNull();
  });

  it("should allow symbols to be inserted into the scope map", () => {
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
    scope.symbols.set(sym.name, sym);
    expect(scope.symbols.size).toBe(1);
    expect(scope.symbols.get("counter")).toBe(sym);
  });
});
