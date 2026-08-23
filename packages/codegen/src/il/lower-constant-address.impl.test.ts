/**
 * Defensive tests for the semantic-model seam used by memory-intrinsic addresses.
 *
 * The public language contract is covered by the specification suite. These tests
 * construct narrow semantic models so malformed or non-scalar constant records
 * cannot accidentally acquire absolute-address meaning during lowering.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, createEmptyModel, makeSpan, primitive } from "@blend65/core";
import type {
  AllocationPlan,
  AstNode,
  ConstValue,
  ExprNode,
  FieldAccessExprNode,
  FrameAllocation,
  FunctionDeclNode,
  IntrinsicCallExprNode,
  ProgramNode,
  SemanticModel,
  StmtNode,
  Symbol,
  Type,
} from "@blend65/core";
import { lowerToIL } from "./lower.js";
import type { LowerInput } from "./lower.js";
import { isLocation } from "./operand.js";

const SPAN = makeSpan(0, 0, 0);

/** Builds a numeric literal expression for a lowering fixture. */
function numeric(value: number): ExprNode {
  return { kind: "NumericLitExpr", value, raw: String(value), span: SPAN };
}

/** Builds a bare identifier expression for a lowering fixture. */
function identifier(name: string): ExprNode {
  return { kind: "IdentExpr", name, span: SPAN };
}

/** Builds a qualified-name expression for a lowering fixture. */
function qualifiedIdentifier(moduleName: string, field: string): FieldAccessExprNode {
  return {
    kind: "FieldAccessExpr",
    object: identifier(moduleName),
    field,
    fieldSpan: SPAN,
    span: SPAN,
  };
}

/** Builds a memory-intrinsic expression for a lowering fixture. */
function intrinsic(name: string, args: ExprNode[]): IntrinsicCallExprNode {
  return {
    kind: "IntrinsicCallExpr",
    name,
    nameSpan: SPAN,
    args,
    typeArg: null,
    fieldArg: null,
    span: SPAN,
  };
}

/** Wraps an expression in a minimal executable program. */
function programFor(expression: ExprNode): ProgramNode {
  const statement: StmtNode = { kind: "ExpressionStmt", expression, span: SPAN };
  const main: FunctionDeclNode = {
    kind: "FunctionDecl",
    exported: false,
    name: "main",
    nameSpan: SPAN,
    params: [],
    returnType: { kind: "PrimitiveType", name: "void", span: SPAN },
    body: { kind: "Block", statements: [statement], span: SPAN },
    span: SPAN,
  };
  return {
    kind: "Program",
    moduleDecl: {
      kind: "ModuleDecl",
      name: "Main",
      nameSpan: SPAN,
      span: SPAN,
    },
    items: [main],
    span: SPAN,
  };
}

/** Builds the allocation plan needed by the minimal `main` fixture. */
function emptyPlan(): AllocationPlan {
  const frame: FrameAllocation = {
    functionName: "Main.main",
    frame: {
      functionName: "Main.main",
      slots: [],
      totalSize: 0,
      isInterrupt: false,
      isEscaped: false,
      isReachable: true,
    },
    offset: 0,
    absoluteAddress: 0,
  };
  return {
    frames: new Map([["Main.main", frame]]),
    dataBase: 0,
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

/**
 * Resolves one expression to a synthetic symbol and optional constant value.
 *
 * The query closures are overridden together with their backing maps so the
 * fixture behaves like a real semantic model instead of relying on map access
 * that production lowering never performs directly.
 */
function modelWithSymbol(
  expression: ExprNode,
  kind: Symbol["kind"],
  type: Type,
  constValue?: ConstValue,
): SemanticModel {
  const base = createEmptyModel();
  const symbol: Symbol = {
    name: "ADDRESS",
    kind,
    type,
    decl: expression,
    scope: base.globalScope,
    exported: false,
    mutable: kind !== "constant",
    byRef: false,
  };
  const symbolMap = new Map<AstNode, Symbol>([[expression, symbol]]);
  const constValues = new Map<Symbol, ConstValue>();
  if (constValue !== undefined) constValues.set(symbol, constValue);

  return {
    ...base,
    symbolMap,
    constValues,
    typeOf: (candidate) => (candidate === expression ? type : base.typeOf(candidate)),
    symbolOf: (candidate) => symbolMap.get(candidate) ?? null,
  };
}

/** Lowers one expression and returns the diagnostics and emitted instructions. */
function lowerExpression(expression: ExprNode, model: SemanticModel) {
  const bag = createDiagnosticBag();
  const input: LowerInput = {
    program: [programFor(expression)],
    model,
    plan: emptyPlan(),
  };
  const lowered = lowerToIL(input, bag);
  return {
    diagnostics: bag.getAll(),
    instructions: lowered.functions[0]?.blocks[0]?.instructions ?? [],
  };
}

/** Proves a rejected address is diagnosed without emitting a memory store. */
function expectAddressRejected(address: ExprNode, model: SemanticModel): void {
  const result = lowerExpression(intrinsic("poke", [address, numeric(5)]), model);
  expect(result.diagnostics.map(({ code }) => code)).toContain("E10045");
  expect(result.diagnostics.some(({ code }) => code.startsWith("E9"))).toBe(false);
  expect(result.instructions.some(({ op }) => op === "store")).toBe(false);
}

describe("memory-intrinsic constant-address guards", () => {
  it("should accept a qualified scalar-integer constant as a direct absolute location", () => {
    const address = qualifiedIdentifier("Hardware", "BORDER");
    const word = primitive("word");
    const model = modelWithSymbol(address, "constant", word, { type: word, value: 0xd020 });
    const result = lowerExpression(intrinsic("poke", [address, numeric(5)]), model);
    const store = result.instructions.find(({ op }) => op === "store");

    expect(result.diagnostics).toEqual([]);
    expect(store?.op === "store" && isLocation(store.b) && store.b.symbol).toBe("$D020");
  });

  it("should reject a constant whose evaluated value is missing", () => {
    const address = identifier("ADDRESS");
    expectAddressRejected(address, modelWithSymbol(address, "constant", primitive("word")));
  });

  it("should reject a boolean constant even though it is scalar", () => {
    const address = identifier("ADDRESS");
    const boolean = primitive("boolean");
    const model = modelWithSymbol(address, "constant", boolean, {
      type: boolean,
      value: true,
    });
    expectAddressRejected(address, model);
  });

  it("should reject an aggregate constant whose numeric field is only a sentinel", () => {
    const address = identifier("ADDRESS");
    const bytes: Type = { kind: "array", element: primitive("byte"), size: 2 };
    const model = modelWithSymbol(address, "constant", bytes, {
      type: bytes,
      value: 0,
      bytes: Uint8Array.from([0x20, 0xd0]),
    });
    expectAddressRejected(address, model);
  });

  it("should reject a scalar-typed constant record that carries an aggregate image", () => {
    const address = identifier("ADDRESS");
    const word = primitive("word");
    const model = modelWithSymbol(address, "constant", word, {
      type: word,
      value: 0xd020,
      bytes: Uint8Array.from([0x20, 0xd0]),
    });
    expectAddressRejected(address, model);
  });

  it.each([-1, 0x10000])("should reject out-of-range named integer constant %d", (value) => {
    const address = identifier("ADDRESS");
    const type = value < 0 ? primitive("sword") : primitive("word");
    const model = modelWithSymbol(address, "constant", type, { type, value });

    expectAddressRejected(address, model);
  });

  it.each([-1, 0x10000])("should reject out-of-range numeric literal %d", (value) => {
    const address = numeric(value);

    expectAddressRejected(address, createEmptyModel());
  });

  it("should reject a runtime variable even when a forged constant value exists", () => {
    const address = identifier("ADDRESS");
    const word = primitive("word");
    const model = modelWithSymbol(address, "variable", word, { type: word, value: 0xd020 });
    expectAddressRejected(address, model);
  });

  it("should reject a composed expression when its exact call-site fact is missing", () => {
    const address = identifier("ADDRESS");
    const word = primitive("word");
    const model = modelWithSymbol(address, "constant", word, { type: word, value: 0xd020 });
    const composed: ExprNode = {
      kind: "BinaryExpr",
      op: "+",
      left: address,
      right: numeric(1),
      span: SPAN,
    };
    expectAddressRejected(composed, model);
  });

  it("should accept a composed expression when analysis recorded its exact call-site fact", () => {
    const address = identifier("ADDRESS");
    const word = primitive("word");
    const base = modelWithSymbol(address, "constant", word, { type: word, value: 0xd020 });
    const composed: ExprNode = {
      kind: "BinaryExpr",
      op: "+",
      left: address,
      right: numeric(1),
      span: SPAN,
    };
    const call = intrinsic("poke", [composed, numeric(5)]);
    const model: SemanticModel = {
      ...base,
      constantIntrinsicAddresses: new Map([[call, 0xd021]]),
    };
    const result = lowerExpression(call, model);
    const store = result.instructions.find(({ op }) => op === "store");

    expect(result.diagnostics).toEqual([]);
    expect(store?.op === "store" && isLocation(store.b) && store.b.symbol).toBe("$D021");
  });

  it("should not reuse a fact recorded for a different call node", () => {
    const address = identifier("ADDRESS");
    const composed: ExprNode = {
      kind: "BinaryExpr",
      op: "+",
      left: address,
      right: numeric(1),
      span: SPAN,
    };
    const actualCall = intrinsic("poke", [composed, numeric(5)]);
    const otherCall = intrinsic("poke", [composed, numeric(5)]);
    const base = createEmptyModel();
    const model: SemanticModel = {
      ...base,
      constantIntrinsicAddresses: new Map([[otherCall, 0xd021]]),
    };
    const result = lowerExpression(actualCall, model);

    expect(result.diagnostics.map(({ code }) => code)).toContain("E10045");
    expect(result.instructions.some(({ op }) => op === "store")).toBe(false);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0xd020 + 0.5])(
    "should reject malformed semantic address fact %s",
    (fact) => {
      const composed: ExprNode = {
        kind: "BinaryExpr",
        op: "+",
        left: numeric(0xd020),
        right: numeric(1),
        span: SPAN,
      };
      const call = intrinsic("poke", [composed, numeric(5)]);
      const model: SemanticModel = {
        ...createEmptyModel(),
        constantIntrinsicAddresses: new Map([[call, fact]]),
      };
      const result = lowerExpression(call, model);

      expect(result.diagnostics.map(({ code }) => code)).toContain("E10045");
      expect(result.instructions.some(({ op }) => op === "store")).toBe(false);
    },
  );

  it.each([-1, 0x10000])("should reject out-of-range semantic address fact %d", (fact) => {
    const composed: ExprNode = {
      kind: "BinaryExpr",
      op: "+",
      left: numeric(0xd020),
      right: numeric(1),
      span: SPAN,
    };
    const call = intrinsic("poke", [composed, numeric(5)]);
    const model: SemanticModel = {
      ...createEmptyModel(),
      constantIntrinsicAddresses: new Map([[call, fact]]),
    };
    const result = lowerExpression(call, model);

    expect(result.diagnostics.map(({ code }) => code)).toContain("E10045");
    expect(result.instructions.some(({ op }) => op === "store")).toBe(false);
  });
});
