/**
 * Specification tests for `modelToFunctionInfo` — the RD-04→RD-05 wiring seam
 * (RD-18 Slice 3a, FR-2).
 *
 * Expectations derive exclusively from `01-requirements.md` AC-1, the component
 * spec `03-02-model-adapter.md`, the `SemanticModel`/`FunctionInfo` contracts in
 * `@blend65/core`, and the Ambiguity Register (AR-6/7/9/10/13) — NOT from
 * implementation logic. Immutable oracle: if one fails after implementation, the
 * implementation is wrong.
 *
 * The populated model is constructed *directly* (fixture-style, independent of
 * `analyze()`) so the adapter is exercised in isolation (07 §Test Data): a
 * per-module `Scope` carrying the `ModuleDeclNode` (so `fn.scope.node.name` is the
 * FQN module — AR-13), a function `Symbol` declared in it, and a function body
 * `Scope` holding the ordered local `variable` symbols.
 *
 * Red-vs-green-guard (07 §PF-003): ST-1 / ST-1c are **expected-red** (the stub
 * returns `[]`); ST-1b is a **green-guard** (empty model → `[]`, re-asserting
 * RD-05 AC-22 — must stay green through implementation).
 */

import { describe, expect, it } from "vitest";
import { createEmptyModel, createScope, primitive } from "@blend65/core";
import { ERROR_TYPE } from "@blend65/core";
import type {
  AstNode,
  CallGraph,
  FunctionDeclNode,
  LetDeclNode,
  ModuleDeclNode,
  PrimitiveName,
  Scope,
  SemanticModel,
  SourceSpan,
  Symbol,
} from "@blend65/core";
import { modelToFunctionInfo } from "./model-adapter.js";

/** A zero-width span for the synthetic decl nodes in these fixtures. */
const SPAN: SourceSpan = { sourceId: 0, start: 0, end: 0 };

/** One local's shape for {@link buildModel}. */
interface LocalSpec {
  readonly name: string;
  readonly typeName: PrimitiveName;
}

/**
 * Builds a fixture {@link SemanticModel} with a single `main` function in
 * `moduleName` and the given locals — mirroring the populated shape `analyze()`
 * produces (03-01) but constructed directly so the adapter is tested in isolation.
 *
 * @param moduleName The module the function is declared in (drives the FQN).
 * @param locals The function's locals, in declaration order.
 * @returns A populated model whose `callGraph.functions` holds `main`.
 */
function buildModel(moduleName: string, locals: readonly LocalSpec[]): SemanticModel {
  const empty = createEmptyModel();

  const moduleDecl: ModuleDeclNode = {
    kind: "ModuleDecl",
    name: moduleName,
    nameSpan: SPAN,
    span: SPAN,
  };
  const moduleScope = createScope("module", empty.globalScope, moduleDecl);
  empty.globalScope.children.push(moduleScope);

  const fnDecl: FunctionDeclNode = {
    kind: "FunctionDecl",
    exported: false,
    name: "main",
    nameSpan: SPAN,
    params: [],
    returnType: { kind: "PrimitiveType", name: "void", span: SPAN },
    body: { kind: "Block", statements: [], span: SPAN },
    span: SPAN,
  };
  const mainSym: Symbol = {
    name: "main",
    kind: "function",
    type: ERROR_TYPE, // 3a leaves the function type poisoned; 3b assigns it (PF-006)
    decl: fnDecl,
    scope: moduleScope, // declared in the module scope → node.name is the module (AR-13)
    exported: false,
    mutable: false,
    byRef: false,
  };
  moduleScope.symbols.set("main", mainSym);

  const bodyScope = createScope("function", moduleScope, fnDecl);
  moduleScope.children.push(bodyScope);
  for (const local of locals) {
    const letDecl: LetDeclNode = {
      kind: "LetDecl",
      exported: false,
      name: local.name,
      nameSpan: SPAN,
      declaredType: { kind: "PrimitiveType", name: local.typeName, span: SPAN },
      initialiser: null,
      span: SPAN,
    };
    const varSym: Symbol = {
      name: local.name,
      kind: "variable",
      type: primitive(local.typeName),
      decl: letDecl,
      scope: bodyScope,
      exported: false,
      mutable: true,
      byRef: false,
    };
    bodyScope.symbols.set(local.name, varSym); // insertion order == declaration order (AR-6)
  }

  const scopeByNode = new Map<AstNode, Scope>([[fnDecl, bodyScope]]);
  const callGraph: CallGraph = {
    functions: new Set([mainSym]),
    edges: new Map(),
    findCycles: () => [],
  };
  return {
    ...empty,
    callGraph,
    mainFunction: mainSym,
    scopeOf: (node) => scopeByNode.get(node) ?? empty.globalScope,
  };
}

describe("Specification: modelToFunctionInfo (RD-18 Slice 3a, FR-2)", () => {
  // ST-1 — the populated 3a model projects to exactly one Main.main FunctionInfo.
  it("should project the populated 3a model to one Main.main with the local x (ST-1)", () => {
    const model = buildModel("Main", [{ name: "x", typeName: "byte" }]);

    expect(modelToFunctionInfo(model)).toEqual([
      {
        name: "Main.main",
        parameters: [],
        locals: [{ name: "x", type: primitive("byte"), byRef: false }],
        isInterrupt: false,
        isEscaped: false,
        isReachable: true,
        callees: [],
      },
    ]);
  });

  // ST-1b — the empty passthrough model still yields [] (RD-05 AC-22 preserved). GREEN-GUARD.
  it("should return [] for the empty passthrough model (ST-1b / AC-22)", () => {
    expect(modelToFunctionInfo(createEmptyModel())).toEqual([]);
  });

  // ST-1c — two locals project as FrameVars in declaration order (AR-6).
  it("should project two locals a,b as FrameVars in declaration order (ST-1c)", () => {
    const model = buildModel("Main", [
      { name: "a", typeName: "byte" },
      { name: "b", typeName: "word" },
    ]);

    const [fn] = modelToFunctionInfo(model);
    expect(fn?.locals).toEqual([
      { name: "a", type: primitive("byte"), byRef: false },
      { name: "b", type: primitive("word"), byRef: false },
    ]);
  });
});
