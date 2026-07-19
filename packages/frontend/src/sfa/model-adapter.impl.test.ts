/**
 * Implementation tests for `modelToFunctionInfo` — edge cases beyond the spec
 * oracles: an interrupt handler projects `isInterrupt`, a function with no locals
 * still projects (so its `__frame_*` base is emitted), a `scopeOf` miss degrades
 * to no locals without throwing, and the awkward positions a short-circuit can
 * occupy relative to a condition.
 *
 * The projection cases construct models directly (fixture-style) so each
 * behavior is exercised in isolation; the slot-position cases need real
 * statements and real expression types, so those run the real pipeline.
 * Imports `@blend65/core` and this package only — never `@blend65/codegen`.
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  createEmptyModel,
  createScope,
  DEFAULT_PROFILE,
  ERROR_TYPE,
  primitive,
} from "@blend65/core";
import type {
  AstNode,
  BlockNode,
  CallGraph,
  DiagnosticBag,
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
import { analyze, lex, parse } from "../index.js";
import { modelToFunctionInfo } from "./model-adapter.js";

const SPAN: SourceSpan = { sourceId: 0, start: 0, end: 0 };

/** Lexes + parses + analyzes `source`; expects an ERROR-free model (warnings ok). */
function analyzeClean(source: string): SemanticModel {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast } = parse({ tokens, source, sourceId: 1, bag });
  const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  expect(bag.getErrors()).toEqual([]);
  return model;
}

/** The synthetic short-circuit slot names in `Main.main`'s projected locals, in order. */
function mainSyntheticSlots(model: SemanticModel): readonly string[] {
  const main = modelToFunctionInfo(model).find((fn) => fn.name === "Main.main");
  expect(main).toBeDefined();
  return (main?.locals ?? []).filter((l) => l.name.startsWith("0sc")).map((l) => l.name);
}

/** Options for {@link buildModel}. */
interface ModelOpts {
  readonly name: string;
  readonly kind: Extract<SymbolKind, "function" | "interrupt">;
  readonly locals?: readonly { name: string; typeName: PrimitiveName }[];
  /** When `false`, the body scope is NOT registered → `scopeOf` misses. */
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
        isIrqReachable: false,
        isIrqOnly: false,
        callees: [],
        argWindowInterferes: [],
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

/**
 * Where a short-circuit sits decides whether it needs a slot, so these cover
 * the awkward positions: nested inside each other, inside a loop condition,
 * back in value position one edge below a condition, and in the module
 * initializer stream (which has no enclosing statement at all).
 */
describe("Synthetic slot positions", () => {
  it("claims nothing for a && and || nested inside one if condition", () => {
    const model = analyzeClean(
      [
        "module Main;",
        "function main(): void {",
        "  let a: boolean = true;",
        "  let b: boolean = false;",
        "  let c: boolean = true;",
        "  if (a && (b || c)) { poke($D020, 1); }",
        "}",
      ].join("\n"),
    );
    expect(mainSyntheticSlots(model)).toEqual([]);
  });

  it("claims nothing for a && in a while condition but does inside its body", () => {
    const model = analyzeClean(
      [
        "module Main;",
        "function main(): void {",
        "  let a: boolean = true;",
        "  let b: boolean = false;",
        "  let n: byte = 0;",
        "  while (a && b) { n = (a && b) ? 1 : 2; }",
        "}",
      ].join("\n"),
    );
    // The body's `?:` claims, and so does the `&&` in its condition — that one
    // is a conditional's condition child, which is value position.
    expect(mainSyntheticSlots(model)).toEqual(["0sc0", "0sc1"]);
  });

  it("claims for a && buried under a comparison inside an if condition", () => {
    const model = analyzeClean(
      [
        "module Main;",
        "function main(): void {",
        "  let a: boolean = true;",
        "  let b: boolean = true;",
        "  if ((a && b) == true) { poke($D020, 1); }",
        "}",
      ].join("\n"),
    );
    // A comparison's operands are value position: the comparison fuses into the
    // branch, but its left operand still has to BE a value first.
    expect(mainSyntheticSlots(model)).toEqual(["0sc0"]);
  });

  it("claims for a short-circuit in a module initializer (no enclosing statement)", () => {
    const model = analyzeClean(
      [
        "module Main;",
        "let a: boolean = true;",
        "let flag: boolean = a && true;",
        "function main(): void { poke($D020, 1); }",
      ].join("\n"),
    );
    const init = modelToFunctionInfo(model).find((fn) => fn.name === "__init");
    expect(init?.locals.map((l) => l.name)).toEqual(["0sc0"]);
  });
});
