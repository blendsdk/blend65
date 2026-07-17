/**
 * Specification tests for `modelToFunctionInfo` — the semantic-model-to-planner
 * wiring seam.
 *
 * Expectations derive exclusively from the language specification, the
 * `SemanticModel`/`FunctionInfo` contracts in `@blend65/core`, and the project's
 * ambiguity-resolution log — NOT from implementation logic. Immutable oracle: if
 * one fails after implementation, the implementation is wrong.
 *
 * The populated model is constructed *directly* (fixture-style, independent of
 * `analyze()`) so the adapter is exercised in isolation: a per-module `Scope`
 * carrying the `ModuleDeclNode` (so `fn.scope.node.name` is the FQN module), a
 * function `Symbol` declared in it, and a function body `Scope` holding the
 * ordered local `variable` symbols.
 *
 * Red-vs-green-guard: some cases below are **expected-red** (the stub returns
 * `[]`) while others are a **green-guard** (empty model → `[]`, re-asserting that
 * behavior must stay green through implementation).
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
import { modelToFunctionInfo, modelToModuleVars } from "./model-adapter.js";

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
 * produces, but constructed directly so the adapter is tested in isolation.
 *
 * @param moduleName The module the function is declared in (drives the FQN).
 * @param locals The function's locals, in declaration order.
 * @returns A populated model whose `callGraph.functions` holds `main`.
 */
function buildModel(
  moduleName: string,
  locals: readonly LocalSpec[],
  moduleVars: readonly LocalSpec[] = [],
): SemanticModel {
  const empty = createEmptyModel();

  const moduleDecl: ModuleDeclNode = {
    kind: "ModuleDecl",
    name: moduleName,
    nameSpan: SPAN,
    span: SPAN,
  };
  const moduleScope = createScope("module", empty.globalScope, moduleDecl);
  empty.globalScope.children.push(moduleScope);

  // Module-level scalar `variable` symbols, declared in the module scope.
  for (const mv of moduleVars) {
    const letDecl: LetDeclNode = {
      kind: "LetDecl",
      exported: false,
      name: mv.name,
      nameSpan: SPAN,
      declaredType: { kind: "PrimitiveType", name: mv.typeName, span: SPAN },
      initialiser: null,
      span: SPAN,
    };
    moduleScope.symbols.set(mv.name, {
      name: mv.name,
      kind: "variable",
      type: primitive(mv.typeName),
      decl: letDecl,
      scope: moduleScope,
      exported: false,
      mutable: true,
      byRef: false,
    });
  }

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
    type: ERROR_TYPE, // leaves the function type poisoned until type-checking assigns it
    decl: fnDecl,
    scope: moduleScope, // declared in the module scope → node.name is the module
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
    bodyScope.symbols.set(local.name, varSym); // insertion order == declaration order
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
  // The populated model projects to exactly one Main.main FunctionInfo.
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
        isIrqReachable: false,
        isIrqOnly: false,
        callees: [],
        argWindowInterferes: [],
      },
    ]);
  });

  // The empty passthrough model still yields []. GREEN-GUARD.
  it("should return [] for the empty passthrough model (ST-1b / AC-22)", () => {
    expect(modelToFunctionInfo(createEmptyModel())).toEqual([]);
  });

  // Two locals project as FrameVars in declaration order.
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

describe("Specification: modelToModuleVars (RD-18 Slice 3b, FR-4/AR-9)", () => {
  // A module-scope `variable` symbol projects to a ModuleVarInput with its
  // module name, variable name, type, and byteSize.
  it("should project a module-scope variable to a ModuleVarInput (ST-11)", () => {
    const model = buildModel("Main", [], [{ name: "g", typeName: "byte" }]);

    expect(modelToModuleVars(model)).toEqual([
      { moduleName: "Main", variableName: "g", type: primitive("byte"), size: 1 },
    ]);
  });

  // byteSize is per scalar (word → 2), preserving declaration order.
  it("should project multiple module vars with per-type byteSize in order (ST-11b)", () => {
    const model = buildModel(
      "Main",
      [],
      [
        { name: "accB", typeName: "byte" },
        { name: "accW", typeName: "word" },
      ],
    );

    expect(modelToModuleVars(model)).toEqual([
      { moduleName: "Main", variableName: "accB", type: primitive("byte"), size: 1 },
      { moduleName: "Main", variableName: "accW", type: primitive("word"), size: 2 },
    ]);
  });

  // Functions in the module scope are excluded (only `variable` symbols).
  it("should exclude function symbols from the module-var projection (ST-11c)", () => {
    const model = buildModel("Main", [{ name: "x", typeName: "byte" }]); // main only, no module vars
    expect(modelToModuleVars(model)).toEqual([]);
  });

  // The empty passthrough model yields [] (no module scopes).
  it("should return [] for the empty passthrough model (ST-11d)", () => {
    expect(modelToModuleVars(createEmptyModel())).toEqual([]);
  });
});
