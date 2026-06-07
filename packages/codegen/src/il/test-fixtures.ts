/**
 * Hand-built lowering fixtures for the RD-06 gate/slice-2 surface (D5).
 *
 * These are **test support**, NOT part of the public IL API — they are never
 * re-exported from the `il/` barrel (07-testing-strategy.md). Each fixture is a
 * trio of real records the deferred RD-04b checker would otherwise produce:
 * a parsed AST ({@link ProgramNode}), a {@link SemanticModel} (the empty
 * passthrough model is sufficient — slice lowering reads types from the plan's
 * frame slots, D5), and an {@link AllocationPlan} carrying the frame slots whose
 * symbols/types the lowering resolves.
 *
 * The fixtures cover every ST-L scenario: the gate program (`poke`), the slice-2
 * program (`let` + `poke`), the §4.7 `add(a,b)` function, a `let` without an
 * initialiser, an unsupported-node body (`if`), and an error-carrying function.
 */

import { createEmptyModel, makeSpan, primitive } from "@blend65/core";
import type {
  AllocationPlan,
  BinaryExprNode,
  BlockNode,
  BoolLitExprNode,
  ErrorStmtNode,
  ExpressionStmtNode,
  ExprNode,
  FrameAllocation,
  FrameSlot,
  FunctionDeclNode,
  IdentExprNode,
  IfStmtNode,
  IntrinsicCallExprNode,
  LetDeclNode,
  ModuleDeclNode,
  NumericLitExprNode,
  ParameterNode,
  PrimitiveTypeNode,
  ProgramNode,
  ReturnStmtNode,
  SemanticModel,
  SourceSpan,
  StmtNode,
  Type,
  TypeNode,
} from "@blend65/core";

/** A single zero-width span reused by every synthetic node. */
const S: SourceSpan = makeSpan(0, 0, 0);

/** One trio the lowering consumes: AST roots + semantic model + allocation plan. */
export interface LoweringFixture {
  readonly program: readonly ProgramNode[];
  readonly model: SemanticModel;
  readonly plan: AllocationPlan;
}

// ── AST node constructors (terse, span-stamped) ────────────────────────────

function prim(name: PrimitiveTypeNode["name"]): PrimitiveTypeNode {
  return { kind: "PrimitiveType", name, span: S };
}

function num(value: number, raw: string): NumericLitExprNode {
  return { kind: "NumericLitExpr", value, raw, span: S };
}

function bool(value: boolean): BoolLitExprNode {
  return { kind: "BoolLitExpr", value, span: S };
}

function ident(name: string): IdentExprNode {
  return { kind: "IdentExpr", name, span: S };
}

function binary(op: BinaryExprNode["op"], left: ExprNode, right: ExprNode): BinaryExprNode {
  return { kind: "BinaryExpr", op, left, right, span: S };
}

function intrinsic(name: string, args: ExprNode[]): IntrinsicCallExprNode {
  return { kind: "IntrinsicCallExpr", name, nameSpan: S, args, typeArg: null, fieldArg: null, span: S };
}

function exprStmt(expression: ExprNode): ExpressionStmtNode {
  return { kind: "ExpressionStmt", expression, span: S };
}

function letDecl(name: string, declaredType: TypeNode | null, initialiser: ExprNode | null): LetDeclNode {
  return { kind: "LetDecl", exported: false, name, nameSpan: S, declaredType, initialiser, span: S };
}

function returnStmt(value: ExprNode | null): ReturnStmtNode {
  return { kind: "ReturnStmt", value, span: S };
}

function ifStmt(condition: ExprNode, thenBlock: BlockNode): IfStmtNode {
  return { kind: "IfStmt", condition, thenBlock, elseClause: null, span: S };
}

function errorStmt(): ErrorStmtNode {
  return { kind: "ErrorStmt", span: S };
}

function block(statements: StmtNode[]): BlockNode {
  return { kind: "Block", statements, span: S };
}

function param(name: string, paramType: TypeNode): ParameterNode {
  return { kind: "Parameter", name, nameSpan: S, paramType, span: S };
}

function fnDecl(
  name: string,
  params: ParameterNode[],
  returnType: TypeNode,
  body: BlockNode,
): FunctionDeclNode {
  return { kind: "FunctionDecl", exported: false, name, nameSpan: S, params, returnType, body, span: S };
}

function moduleDecl(name: string): ModuleDeclNode {
  return { kind: "ModuleDecl", name, nameSpan: S, span: S };
}

function programOf(moduleName: string, fn: FunctionDeclNode): ProgramNode {
  return { kind: "Program", moduleDecl: moduleDecl(moduleName), items: [fn], span: S };
}

// ── AllocationPlan construction ────────────────────────────────────────────

function slot(name: string, kind: FrameSlot["kind"], type: Type, offset: number): FrameSlot {
  return { name, kind, type, size: type.kind === "primitive" && (type.name === "word" || type.name === "sword") ? 2 : 1, offset };
}

function frameAlloc(functionName: string, slots: FrameSlot[]): FrameAllocation {
  const totalSize = slots.reduce((n, s) => n + s.size, 0);
  return {
    functionName,
    frame: { functionName, slots, totalSize, isInterrupt: false, isEscaped: false, isReachable: true },
    offset: 0,
    absoluteAddress: 0,
  };
}

/** Build an {@link AllocationPlan} carrying the given frames; all else zeroed. */
function planWith(frames: ReadonlyMap<string, FrameAllocation>): AllocationPlan {
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

function fixture(program: ProgramNode, plan: AllocationPlan): LoweringFixture {
  return { program: [program], model: MODEL, plan };
}

// ── The fixtures ───────────────────────────────────────────────────────────

/**
 * Gate program: `module Main; function main(): void { poke(0xD020, 5); }`.
 * No frame slots — `poke` uses a literal address (→ symbolic location, D9) and a
 * literal value (→ immediate). Lowers to `store 5, $D020` + `ret`.
 */
export const gateFixture: LoweringFixture = fixture(
  programOf("Main", fnDecl("main", [], prim("void"), block([exprStmt(intrinsic("poke", [num(0xd020, "0xD020"), num(5, "5")]))]))),
  planWith(new Map([["Main.main", frameAlloc("Main.main", [])]])),
);

/**
 * Slice-2 program: `let c: byte = 5; poke(0xD020, c);`. The `let` materialises
 * the literal into `%0 = const i8u 5` then stores it; the `poke` loads `c` and
 * stores it to the symbolic address.
 */
export const slice2Fixture: LoweringFixture = fixture(
  programOf(
    "Main",
    fnDecl("main", [], prim("void"), block([
      letDecl("c", prim("byte"), num(5, "5")),
      exprStmt(intrinsic("poke", [num(0xd020, "0xD020"), ident("c")])),
    ])),
  ),
  planWith(new Map([["Main.main", frameAlloc("Main.main", [slot("c", "local", primitive("byte"), 0)])]])),
);

/**
 * RD-06 §4.7 function: `module Math; function add(a: byte, b: byte): byte {
 * return a + b; }`. Lowers to two loads, an `add`, and `ret %2` (left-first).
 */
export const addFixture: LoweringFixture = fixture(
  programOf(
    "Math",
    fnDecl("add", [param("a", prim("byte")), param("b", prim("byte"))], prim("byte"), block([
      returnStmt(binary("+", ident("a"), ident("b"))),
    ])),
  ),
  planWith(
    new Map([
      [
        "Math.add",
        frameAlloc("Math.add", [
          slot("a", "parameter", primitive("byte"), 0),
          slot("b", "parameter", primitive("byte"), 1),
        ]),
      ],
    ]),
  ),
);

/**
 * RD-06 comparison function: `module Math; function eq(a: byte, b: byte): byte {
 * return a == b; }`. Lowers to two loads, an `eq` (IL_BYTE 0/1 result), and
 * `ret %2`. Used by the RD-07b end-to-end golden ST-G3.
 */
export const eqFixture: LoweringFixture = fixture(
  programOf(
    "Math",
    fnDecl("eq", [param("a", prim("byte")), param("b", prim("byte"))], prim("byte"), block([
      returnStmt(binary("==", ident("a"), ident("b"))),
    ])),
  ),
  planWith(
    new Map([
      [
        "Math.eq",
        frameAlloc("Math.eq", [
          slot("a", "parameter", primitive("byte"), 0),
          slot("b", "parameter", primitive("byte"), 1),
        ]),
      ],
    ]),
  ),
);

/**
 * A `let` without an initialiser: `function main(): void { let c: byte; }`.
 * Emits NO IL for the declaration — just the void fall-through `ret`.
 */
export const letNoInitFixture: LoweringFixture = fixture(

  programOf("Main", fnDecl("main", [], prim("void"), block([letDecl("c", prim("byte"), null)]))),
  planWith(new Map([["Main.main", frameAlloc("Main.main", [slot("c", "local", primitive("byte"), 0)])]])),
);

/**
 * A function whose body holds an unsupported node (`if`): the visitor default
 * fires exactly one `E90001` ICE and never throws.
 */
export const unsupportedFixture: LoweringFixture = fixture(
  programOf("Main", fnDecl("main", [], prim("void"), block([ifStmt(bool(true), block([]))]))),
  planWith(new Map([["Main.main", frameAlloc("Main.main", [])]])),
);

/**
 * A function carrying an `ErrorType` in its signature — skipped entirely (R68),
 * so it is absent from `ILProgram.functions`.
 */
export const errorFixture: LoweringFixture = fixture(
  programOf("Main", fnDecl("main", [], { kind: "ErrorType", span: S }, block([errorStmt()]))),
  planWith(new Map()),
);
