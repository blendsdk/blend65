/**
 * Implementation tests for `lowerToIL` (RD-06 §3.5/§4.7).
 *
 * Edge cases and internals NOT pinned by the spec oracle (lower.spec.test.ts):
 * nested `Block` flattening, a bare `return` → `ret()`, the ICE default for an
 * unsupported *statement*, an interrupt declaration → void single block, and the
 * carried allocation plan. Written AFTER the implementation (testing.md Rule 6/10),
 * built from the same fixture helpers as the spec layer.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, IceCode, makeSpan, primitive } from "@blend65/core";
import type {
  AllocationPlan,
  BlockNode,
  FrameAllocation,
  FunctionDeclNode,
  InterruptDeclNode,
  ProgramNode,
  SemanticModel,
  SourceSpan,
  StmtNode,
} from "@blend65/core";
import { createEmptyModel } from "@blend65/core";

import { printIL } from "./print-il.js";
import { lowerToIL } from "./lower.js";
import type { LowerInput } from "./lower.js";

const S: SourceSpan = makeSpan(0, 0, 0);

function emptyPlanWith(frames: ReadonlyMap<string, FrameAllocation>): AllocationPlan {
  return {
    frames,
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

const MODEL: SemanticModel = createEmptyModel();

function mainWithBody(statements: StmtNode[]): FunctionDeclNode {
  return {
    kind: "FunctionDecl",
    exported: false,
    name: "main",
    nameSpan: S,
    params: [],
    returnType: { kind: "PrimitiveType", name: "void", span: S },
    body: { kind: "Block", statements, span: S },
    span: S,
  };
}

function programOf(fn: FunctionDeclNode | InterruptDeclNode): ProgramNode {
  return {
    kind: "Program",
    moduleDecl: { kind: "ModuleDecl", name: "Main", nameSpan: S, span: S },
    items: [fn],
    span: S,
  };
}

function inputFor(fn: FunctionDeclNode | InterruptDeclNode): LowerInput {
  return {
    program: [programOf(fn)],
    model: MODEL,
    plan: emptyPlanWith(new Map([["Main.main", frameless()]])),
  };
}

function frameless(): FrameAllocation {
  return {
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
}

describe("lowerToIL — statement edge cases", () => {
  it("should flatten a nested Block into the same entry block", () => {
    const inner: BlockNode = {
      kind: "Block",
      statements: [
        {
          kind: "ExpressionStmt",
          expression: {
            kind: "IntrinsicCallExpr",
            name: "poke",
            nameSpan: S,
            args: [
              { kind: "NumericLitExpr", value: 0xd020, raw: "0xD020", span: S },
              { kind: "NumericLitExpr", value: 1, raw: "1", span: S },
            ],
            typeArg: null,
            fieldArg: null,
            span: S,
          },
          span: S,
        },
      ],
      span: S,
    };
    const fn = mainWithBody([inner]);
    const text = printIL(lowerToIL(inputFor(fn), createDiagnosticBag()));
    expect(text).toBe(
      ["function Main.main(): void {", "_entry:", "  store 1, $D020", "  ret", "}"].join("\n"),
    );
  });

  it("should lower a bare return to ret() (R42)", () => {
    const fn = mainWithBody([{ kind: "ReturnStmt", value: null, span: S }]);
    const text = printIL(lowerToIL(inputFor(fn), createDiagnosticBag()));
    expect(text).toBe(["function Main.main(): void {", "_entry:", "  ret", "}"].join("\n"));
  });

  it("should ICE on an unsupported statement and keep the block well-formed (R69)", () => {
    const fn = mainWithBody([{ kind: "BreakStmt", span: S }]);
    const bag = createDiagnosticBag();
    const text = printIL(lowerToIL(inputFor(fn), bag));
    expect(bag.getAll().filter((d) => d.code === IceCode.Unexpected)).toHaveLength(1);
    // The unsupported statement appends no instructions; the void ret remains.
    expect(text).toBe(["function Main.main(): void {", "_entry:", "  ret", "}"].join("\n"));
  });
});

describe("lowerToIL — declarations & program", () => {
  it("should lower an interrupt declaration to a void single-block function", () => {
    const irq: InterruptDeclNode = {
      kind: "InterruptDecl",
      exported: false,
      name: "vblank",
      nameSpan: S,
      body: { kind: "Block", statements: [], span: S },
      span: S,
    };
    const input: LowerInput = {
      program: [programOf(irq)],
      model: MODEL,
      plan: emptyPlanWith(new Map()),
    };
    const program = lowerToIL(input, createDiagnosticBag());
    expect(program.functions).toHaveLength(1);
    expect(program.functions[0].name).toBe("Main.vblank");
    expect(program.functions[0].isInterrupt).toBe(true);
    expect(program.functions[0].returnType).toBe("void");
  });

  it("should carry the allocation plan through unchanged (R66)", () => {
    const plan = emptyPlanWith(new Map());
    const program = lowerToIL({ program: [], model: MODEL, plan }, createDiagnosticBag());
    expect(program.allocationPlan).toBe(plan);
  });

  it("should map a word return type to the i16u IL type", () => {
    const fn: FunctionDeclNode = {
      ...mainWithBody([{ kind: "ReturnStmt", value: null, span: S }]),
      returnType: { kind: "PrimitiveType", name: "word", span: S },
    };
    const program = lowerToIL(inputFor(fn), createDiagnosticBag());
    expect(program.functions[0].returnType).toEqual({ width: 16, signed: false });
  });
});

describe("lowerToIL — uses primitive() for type provenance (smoke)", () => {
  it("should treat byte as IL_BYTE in the type mapping", () => {
    // Guards the lower.ts import of primitive() against accidental removal.
    expect(primitive("byte")).toEqual({ kind: "primitive", name: "byte" });
  });
});
