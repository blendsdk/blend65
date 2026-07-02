/**
 * Implementation tests for RD-17 T2 lowering (03-03).
 *
 * Edges/internals not pinned by the spec oracle: poison-statement recovery across
 * multiple statements, little-endian byte ordering for `pokew`, `offsetof`/primitive
 * `sizeof` fold values, and a completeness sweep proving every catalog intrinsic's
 * lowering strategy has a handler (no `intrinsic` reaches lowering unhandled).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, createEmptyModel, makeSpan, primitive, CORE_INTRINSICS } from "@blend65/core";
import type {
  AllocationPlan,
  ExprNode,
  FrameAllocation,
  FunctionDeclNode,
  IntrinsicCallExprNode,
  ProgramNode,
  SemanticModel,
  SourceSpan,
  StmtNode,
  StructDeclNode,
  StructType,
  TypeNode,
} from "@blend65/core";
import { lowerToIL } from "./lower.js";
import type { LowerInput } from "./lower.js";
import { isImmediate } from "./operand.js";

const S: SourceSpan = makeSpan(0, 0, 0);

const num = (v: number): ExprNode => ({ kind: "NumericLitExpr", value: v, raw: String(v), span: S });
const ident = (n: string): ExprNode => ({ kind: "IdentExpr", name: n, span: S });
const exprStmt = (e: ExprNode): StmtNode => ({ kind: "ExpressionStmt", expression: e, span: S });
const returnStmt = (v: ExprNode): StmtNode => ({ kind: "ReturnStmt", value: v, span: S });
const namedType = (n: string): TypeNode => ({ kind: "NamedType", name: n, span: S });

function call(name: string, args: ExprNode[], typeArg: TypeNode | null = null, fieldArg: { name: string; span: SourceSpan } | null = null): IntrinsicCallExprNode {
  return { kind: "IntrinsicCallExpr", name, nameSpan: S, args, typeArg, fieldArg, span: S };
}
function mainFn(statements: StmtNode[], rt: "void" | "byte" | "word" = "void"): FunctionDeclNode {
  return {
    kind: "FunctionDecl",
    exported: false,
    name: "main",
    nameSpan: S,
    params: [],
    returnType: { kind: "PrimitiveType", name: rt, span: S },
    body: { kind: "Block", statements, span: S },
    span: S,
  };
}
function programOf(fn: FunctionDeclNode): ProgramNode {
  return { kind: "Program", moduleDecl: { kind: "ModuleDecl", name: "Main", nameSpan: S, span: S }, items: [fn], span: S };
}
function emptyPlan(): AllocationPlan {
  const frame: FrameAllocation = {
    functionName: "Main.main",
    frame: { functionName: "Main.main", slots: [], totalSize: 0, isInterrupt: false, isEscaped: false, isReachable: true },
    offset: 0,
    absoluteAddress: 0,
  };
  return {
    frames: new Map([["Main.main", frame]]),
    frameRegionBase: 0, frameRegionSize: 0, peakSimultaneous: 0, sharingSaved: 0,
    zpAllocations: [], zpUsed: 0, zpBudget: 0, moduleVariables: [], moduleVariablesSize: 0,
    stackAnalysis: { maxMainDepth: 0, maxMainStackBytes: 0, maxIrqDepth: 0, maxIrqStackBytes: 0, irqOverhead: 0, totalWorstCase: 0, platformBudget: 0, exceedsWarningThreshold: false },
    symbolDefinitions: [],
    resourceData: { frameRegionBytes: 0, frameRegionPeak: 0, frameSharingSaved: 0, zpUsed: 0, zpBudget: 0, ramUsed: 0, ramBudget: 0, stackWorstCase: 0, stackBudget: 0 },
    hasErrors: false,
  };
}
function spriteModel(): SemanticModel {
  const decl: StructDeclNode = { kind: "StructDecl", exported: false, name: "Sprite", nameSpan: S, span: S, fields: [] };
  const sprite: StructType = {
    kind: "struct", name: "Sprite", decl,
    fields: new Map([
      ["x", { type: primitive("byte"), offset: 0 }],
      ["y", { type: primitive("byte"), offset: 1 }],
      ["addr", { type: primitive("word"), offset: 2 }],
    ]),
    byteSize: 4,
  };
  return { ...createEmptyModel(), structTypes: new Map([["Sprite", sprite]]) };
}
function inputOf(fn: FunctionDeclNode, model = createEmptyModel()): LowerInput {
  return { program: [programOf(fn)], model, plan: emptyPlan() };
}
function iceCount(bag: ReturnType<typeof createDiagnosticBag>): number {
  return bag.getAll().filter((d) => d.code.startsWith("E9")).length;
}

describe("T2 lowering — poison recovery", () => {
  it("recovers after an E10045 poison and still lowers a following good statement", () => {
    const bag = createDiagnosticBag();
    const fn = mainFn([
      exprStmt(call("poke", [ident("v"), num(5)])), // bad: non-constant address → E10045
      exprStmt(call("poke", [num(0xd020), num(1)])), // good: should still lower
    ]);
    const program = lowerToIL(inputOf(fn), bag);
    expect(bag.getAll().some((d) => d.code === "E10045")).toBe(true);
    expect(iceCount(bag)).toBe(0);
    const stores = (program.functions[0]?.blocks[0]?.instructions ?? []).filter((i) => i.op === "store");
    expect(stores.length).toBe(1); // the good poke's store survived
  });
});

describe("T2 lowering — pokew little-endian ordering", () => {
  it("stores low byte then high byte at addr / addr+1", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(inputOf(mainFn([exprStmt(call("pokew", [num(0x1000), num(0xabcd)]))])), bag);
    const stores = (program.functions[0]?.blocks[0]?.instructions ?? []).filter((i) => i.op === "store");
    expect(stores).toHaveLength(2);
    const first = stores[0];
    const second = stores[1];
    expect(first && first.op === "store" && isImmediate(first.a) && first.a.value).toBe(0xcd);
    expect(second && second.op === "store" && isImmediate(second.a) && second.a.value).toBe(0xab);
  });
});

describe("T2 folds — offsetof and primitive sizeof", () => {
  it("offsetof(Sprite, addr) folds to 2", () => {
    const bag = createDiagnosticBag();
    const node = call("offsetof", [], namedType("Sprite"), { name: "addr", span: S });
    const program = lowerToIL(inputOf(mainFn([returnStmt(node)], "byte"), spriteModel()), bag);
    const term = program.functions[0]?.blocks[0]?.terminator;
    const value = term?.kind === "ret" ? term.value : undefined;
    expect(value && isImmediate(value) && value.value).toBe(2);
  });

  it("sizeof(word) folds to 2 and sizeof(byte) folds to 1", () => {
    const bag = createDiagnosticBag();
    const wordNode = call("sizeof", [], { kind: "PrimitiveType", name: "word", span: S }, null);
    const byteNode = call("sizeof", [], { kind: "PrimitiveType", name: "byte", span: S }, null);
    const wProg = lowerToIL(inputOf(mainFn([returnStmt(wordNode)], "byte")), bag);
    const bProg = lowerToIL(inputOf(mainFn([returnStmt(byteNode)], "byte")), bag);
    const wVal = wProg.functions[0]?.blocks[0]?.terminator;
    const bVal = bProg.functions[0]?.blocks[0]?.terminator;
    expect(wVal?.kind === "ret" && wVal.value && isImmediate(wVal.value) && wVal.value.value).toBe(2);
    expect(bVal?.kind === "ret" && bVal.value && isImmediate(bVal.value) && bVal.value.value).toBe(1);
  });
});

describe("T2 lowering — inline-emitter completeness sweep", () => {
  // Every user-visible catalog intrinsic that lowers 'inline' must lower without
  // an ICE (i.e. it has an emitter). Constant-friendly representative calls.
  const REPRESENTATIVE: Record<string, IntrinsicCallExprNode> = {
    peek: call("peek", [num(0x10)]),
    poke: call("poke", [num(0x10), num(1)]),
    peekw: call("peekw", [num(0x10)]),
    pokew: call("pokew", [num(0x10), num(0x1234)]),
    lo: call("lo", [num(0x1234)]),
    hi: call("hi", [num(0x1234)]),
  };

  const inlineNames = CORE_INTRINSICS.filter((d) => d.loweringStrategy === "inline").map((d) => d.name);

  it.each(inlineNames)("inline intrinsic '%s' lowers without an ICE", (name) => {
    const node = REPRESENTATIVE[name];
    expect(node, `missing representative call for ${name}`).toBeDefined();
    const bag = createDiagnosticBag();
    lowerToIL(inputOf(mainFn([exprStmt(node!)])), bag);
    expect(iceCount(bag)).toBe(0);
  });

  it("every catalog intrinsic uses one of the four known strategies", () => {
    const known = new Set(["fold", "inline", "opcode", "call"]);
    for (const d of CORE_INTRINSICS) {
      expect(known.has(d.loweringStrategy), `${d.name}:${d.loweringStrategy}`).toBe(true);
    }
  });
});
