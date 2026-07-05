/**
 * Implementation tests for `modelToFunctionInfo` (RD-18 Slice 3a) — edge cases
 * beyond the ST-* spec oracles: an interrupt handler projects `isInterrupt`, a
 * function with no locals still projects (so its `__frame_*` base is emitted), and
 * a `scopeOf` miss degrades to no locals without throwing (AR-10).
 *
 * Models are constructed directly (fixture-style) so each behavior is exercised in
 * isolation. Imports `@blend65/core` only (R15/AR-20).
 */

import { describe, expect, it } from "vitest";
import { createEmptyModel, createScope, ERROR_TYPE, primitive } from "@blend65/core";
import type {
  AstNode,
  BlockNode,
  CallGraph,
  FunctionDeclNode,
  InterruptDeclNode,
  ModuleDeclNode,
  PrimitiveName,
  Scope,
  SemanticModel,
  SourceSpan,
  Symbol,
  SymbolKind,
} from "@blend65/core";
import { modelToFunctionInfo } from "./model-adapter.js";

const SPAN: SourceSpan = { sourceId: 0, start: 0, end: 0 };

/** Options for {@link buildModel}. */
interface ModelOpts {
  readonly name: string;
  readonly kind: Extract<SymbolKind, "function" | "interrupt">;
  readonly locals?: readonly { name: string; typeName: PrimitiveName }[];
  /** When `false`, the body scope is NOT registered → `scopeOf` misses (AR-10). */
  readonly registerScope?: boolean;
}

/**
 * Builds a single-function fixture model in module "Main", with the function
 * declared in a module scope (so the FQN resolves) and its locals in a body scope.
 */
function buildModel(opts: ModelOpts): SemanticModel {
  const empty = createEmptyModel();
  const moduleDecl: ModuleDeclNode = { kind: "ModuleDecl", name: "Main", nameSpan: SPAN, span: SPAN };
  const moduleScope = createScope("module", empty.globalScope, moduleDecl);

  const block: BlockNode = { kind: "Block", statements: [], span: SPAN };
  const interruptDecl: InterruptDeclNode = {
    kind: "InterruptDecl",
    exported: false,
    name: opts.name,
    nameSpan: SPAN,
    body: block,
    span: SPAN,
  };
  const functionDecl: FunctionDeclNode = {
    kind: "FunctionDecl",
    exported: false,
    name: opts.name,
    nameSpan: SPAN,
    params: [],
    returnType: { kind: "PrimitiveType", name: "void", span: SPAN },
    body: block,
    span: SPAN,
  };
  const decl: AstNode = opts.kind === "interrupt" ? interruptDecl : functionDecl;

  const fnSym: Symbol = {
    name: opts.name,
    kind: opts.kind,
    type: ERROR_TYPE,
    decl,
    scope: moduleScope,
    exported: false,
    mutable: false,
    byRef: false,
  };

  const bodyScope = createScope("function", moduleScope, decl);
  for (const local of opts.locals ?? []) {
    bodyScope.symbols.set(local.name, {
      name: local.name,
      kind: "variable",
      type: primitive(local.typeName),
      decl,
      scope: bodyScope,
      exported: false,
      mutable: true,
      byRef: false,
    });
  }

  const scopeByNode = new Map<AstNode, Scope>();
  if (opts.registerScope !== false) scopeByNode.set(decl, bodyScope);
  const callGraph: CallGraph = { functions: new Set([fnSym]), edges: new Map(), findCycles: () => [] };
  return {
    ...empty,
    callGraph,
    mainFunction: fnSym,
    scopeOf: (node) => scopeByNode.get(node) ?? empty.globalScope,
  };
}

describe("modelToFunctionInfo — internals & edges (Slice 3a)", () => {
  it("flags an interrupt handler as isInterrupt with the module-qualified name", () => {
    const [fn] = modelToFunctionInfo(buildModel({ name: "vblank", kind: "interrupt" }));
    expect(fn?.isInterrupt).toBe(true);
    expect(fn?.name).toBe("Main.vblank");
  });

  it("projects a function with no locals as locals: [] but still emits it", () => {
    expect(modelToFunctionInfo(buildModel({ name: "main", kind: "function" }))).toEqual([
      {
        name: "Main.main",
        parameters: [],
        locals: [],
        isInterrupt: false,
        isEscaped: false,
        isReachable: true,
        callees: [],
      },
    ]);
  });

  it("degrades to no locals when scopeOf misses the decl (never throws, AR-10)", () => {
    const model = buildModel({
      name: "main",
      kind: "function",
      locals: [{ name: "x", typeName: "byte" }],
      registerScope: false,
    });
    const [fn] = modelToFunctionInfo(model);
    expect(fn?.locals).toEqual([]); // scopeOf → globalScope (empty) → no variables
  });
});
