/**
 * Specification tests for intrinsic lowering — folds + inline load/store.
 *
 * Derived exclusively from the frozen spec and documented intrinsic semantics —
 * never from reading the implementation (immutable oracle rule). Inspects the
 * lowered IL structurally: fold intrinsics become `immediate` operands with no
 * runtime instructions; `peek`/`poke` become inline `load`/`store` (no
 * `intrinsic`/`call`); a non-constant address becomes E10045 (not an ICE).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, createEmptyModel, makeSpan, primitive } from "@blend65/core";
import type {
  AllocationPlan,
  ExprNode,
  FrameAllocation,
  FrameSlot,
  FunctionDeclNode,
  IntrinsicCallExprNode,
  ProgramNode,
  SemanticModel,
  SourceSpan,
  StmtNode,
  StructDeclNode,
  StructType,
  Type,
  TypeNode,
} from "@blend65/core";
import { lowerToIL } from "./lower.js";
import type { LowerInput } from "./lower.js";
import type { ILInstruction } from "./instruction.js";
import { IL_BYTE, IL_WORD } from "./il-type.js";
import { isImmediate, isLocation } from "./operand.js";
import type { ILOperand } from "./operand.js";

const S: SourceSpan = makeSpan(0, 0, 0);

// ── terse AST builders ───────────────────────────────────────────────────────
const num = (value: number): ExprNode => ({ kind: "NumericLitExpr", value, raw: String(value), span: S });
const ident = (name: string): ExprNode => ({ kind: "IdentExpr", name, span: S });
const namedType = (name: string): TypeNode => ({ kind: "NamedType", name, span: S });
const exprStmt = (expression: ExprNode): StmtNode => ({ kind: "ExpressionStmt", expression, span: S });
const returnStmt = (value: ExprNode): StmtNode => ({ kind: "ReturnStmt", value, span: S });

function callArgs(name: string, args: ExprNode[]): IntrinsicCallExprNode {
  return { kind: "IntrinsicCallExpr", name, nameSpan: S, args, typeArg: null, fieldArg: null, span: S };
}
function sizeofType(typeName: string): IntrinsicCallExprNode {
  return { kind: "IntrinsicCallExpr", name: "sizeof", nameSpan: S, args: [], typeArg: namedType(typeName), fieldArg: null, span: S };
}

function mainFn(statements: StmtNode[], returnTypeName: "void" | "byte" | "word" = "void"): FunctionDeclNode {
  return {
    kind: "FunctionDecl",
    exported: false,
    name: "main",
    nameSpan: S,
    params: [],
    returnType: { kind: "PrimitiveType", name: returnTypeName, span: S },
    body: { kind: "Block", statements, span: S },
    span: S,
  };
}
function programOf(fn: FunctionDeclNode): ProgramNode {
  return { kind: "Program", moduleDecl: { kind: "ModuleDecl", name: "Main", nameSpan: S, span: S }, items: [fn], span: S };
}

// ── plan / model fixtures ────────────────────────────────────────────────────
function planWith(slots: FrameSlot[] = []): AllocationPlan {
  const frame: FrameAllocation = {
    functionName: "Main.main",
    frame: { functionName: "Main.main", slots, totalSize: 0, isInterrupt: false, isEscaped: false, isReachable: true },
    offset: 0,
    absoluteAddress: 0,
  };
  return {
    frames: new Map([["Main.main", frame]]),
    frameRegionBase: 0,
    frameRegionSize: 0,
    peakSimultaneous: 0,
    sharingSaved: 0,
    zpAllocations: [],
    zpUsed: 0,
    zpBudget: 0,
    moduleVariables: [],
    moduleVariablesSize: 0,
    stackAnalysis: {
      maxMainDepth: 0,
      maxMainStackBytes: 0,
      maxIrqDepth: 0,
      maxIrqStackBytes: 0,
      irqOverhead: 0,
      totalWorstCase: 0,
      platformBudget: 0,
      exceedsWarningThreshold: false,
    },
    symbolDefinitions: [],
    resourceData: {
      frameRegionBytes: 0,
      frameRegionPeak: 0,
      frameSharingSaved: 0,
      zpUsed: 0,
      zpBudget: 0,
      ramUsed: 0,
      ramBudget: 0,
      stackWorstCase: 0,
      stackBudget: 0,
    },
    hasErrors: false,
  };
}

/** A resolved `Sprite` struct (x: byte, y: byte, addr: word → byteSize 4). */
function spriteModel(): SemanticModel {
  const decl: StructDeclNode = { kind: "StructDecl", exported: false, name: "Sprite", nameSpan: S, span: S, fields: [] };
  const sprite: StructType = {
    kind: "struct",
    name: "Sprite",
    decl,
    fields: new Map([
      ["x", { type: primitive("byte"), offset: 0 }],
      ["y", { type: primitive("byte"), offset: 1 }],
      ["addr", { type: primitive("word"), offset: 2 }],
    ]),
    byteSize: 4,
  };
  return { ...createEmptyModel(), structTypes: new Map([["Sprite", sprite]]) };
}

/** An `arr` frame slot of type `byte[size]`. */
function arraySlot(size: number): FrameSlot {
  const type: Type = { kind: "array", element: primitive("byte"), size };
  return { name: "arr", kind: "local", type, size, offset: 0 };
}

function lower(input: LowerInput): { instrs: readonly ILInstruction[]; ret: ILOperand | undefined; bag: ReturnType<typeof createDiagnosticBag> } {
  const bag = createDiagnosticBag();
  const program = lowerToIL(input, bag);
  const block = program.functions[0]?.blocks[0];
  const terminator = block?.terminator;
  return {
    instrs: block?.instructions ?? [],
    ret: terminator?.kind === "ret" ? terminator.value : undefined,
    bag,
  };
}

const inputOf = (fn: FunctionDeclNode, plan = planWith(), model = createEmptyModel()): LowerInput => ({
  program: [programOf(fn)],
  model,
  plan,
});

const ops = (instrs: readonly ILInstruction[]): string[] => instrs.map((i) => i.op);

describe("Specification: RD-17 T2 lowering (ST-19..ST-23, ST-34)", () => {
  it("ST-19: poke($D020, 5) → inline store, no intrinsic/call op (AC-08)", () => {
    const { instrs, bag } = lower(inputOf(mainFn([exprStmt(callArgs("poke", [num(0xd020), num(5)]))])));
    expect(ops(instrs)).toContain("store");
    expect(ops(instrs)).not.toContain("intrinsic");
    expect(ops(instrs)).not.toContain("call");
    const store = instrs.find((i) => i.op === "store");
    expect(store && store.op === "store" && isLocation(store.b) && store.b.symbol).toBe("$D020");
    expect(store && store.op === "store" && isImmediate(store.a) && store.a.value).toBe(5);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-19: peek($D021) → inline load, no intrinsic/call op (AC-08)", () => {
    const { instrs, bag } = lower(inputOf(mainFn([exprStmt(callArgs("peek", [num(0xd021)]))])));
    expect(ops(instrs)).toContain("load");
    expect(ops(instrs)).not.toContain("intrinsic");
    const load = instrs.find((i) => i.op === "load");
    expect(load && load.op === "load" && isLocation(load.b) && load.b.symbol).toBe("$D021");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-20: pokew($0314, $1234) → two little-endian byte stores ($34→$314, $12→$315)", () => {
    const { instrs, bag } = lower(inputOf(mainFn([exprStmt(callArgs("pokew", [num(0x0314), num(0x1234)]))])));
    const stores = instrs.filter((i) => i.op === "store");
    expect(stores).toHaveLength(2);
    const [loStore, hiStore] = stores;
    expect(loStore && loStore.op === "store" && isImmediate(loStore.a) && loStore.a.value).toBe(0x34);
    expect(loStore && loStore.op === "store" && isLocation(loStore.b) && loStore.b.symbol).toBe("$314");
    expect(hiStore && hiStore.op === "store" && isImmediate(hiStore.a) && hiStore.a.value).toBe(0x12);
    expect(hiStore && hiStore.op === "store" && isLocation(hiStore.b) && hiStore.b.symbol).toBe("$315");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-21: sizeof(Sprite) folds to immediate 4 with zero runtime instructions (AC-09)", () => {
    const { instrs, ret, bag } = lower(inputOf(mainFn([returnStmt(sizeofType("Sprite"))], "byte"), planWith(), spriteModel()));
    expect(instrs).toHaveLength(0); // the fold emits no runtime code
    expect(ret && isImmediate(ret) && ret.value).toBe(4);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-22: length(arr) for byte[300] folds to 300 with result type word (AR-P15)", () => {
    const { instrs, ret, bag } = lower(
      inputOf(mainFn([returnStmt(callArgs("length", [ident("arr")]))], "word"), planWith([arraySlot(300)])),
    );
    expect(instrs).toHaveLength(0);
    expect(ret && isImmediate(ret) && ret.value).toBe(300);
    expect(ret && isImmediate(ret) && ret.type).toEqual(IL_WORD);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-34: length(arr) for byte[256] (exact boundary) folds to 256 with result type word", () => {
    const { ret } = lower(
      inputOf(mainFn([returnStmt(callArgs("length", [ident("arr")]))], "word"), planWith([arraySlot(256)])),
    );
    expect(ret && isImmediate(ret) && ret.value).toBe(256);
    expect(ret && isImmediate(ret) && ret.type).toEqual(IL_WORD);
  });

  it("ST-22 companion: length(arr) for byte[255] folds with result type byte", () => {
    const { ret } = lower(
      inputOf(mainFn([returnStmt(callArgs("length", [ident("arr")]))], "byte"), planWith([arraySlot(255)])),
    );
    expect(ret && isImmediate(ret) && ret.value).toBe(255);
    expect(ret && isImmediate(ret) && ret.type).toEqual(IL_BYTE);
  });

  it("ST-23: poke(v, 5) with a variable address → E10045, no ICE, compilation continues (AR-P5)", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(inputOf(mainFn([exprStmt(callArgs("poke", [ident("v"), num(5)]))])), bag);
    const codes = bag.getAll().map((d) => d.code);
    expect(codes).toContain("E10045");
    expect(codes.filter((c) => c.startsWith("E9"))).toHaveLength(0); // NO ICE
    expect(program.functions).toHaveLength(1); // lowering continued
  });
});
