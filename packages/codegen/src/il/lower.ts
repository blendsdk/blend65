/**
 * AST→IL lowering for the RD-06 gate/slice-2 surface (R29–R52 subset, R68/R69,
 * §3.5/§4.7/§4.12; registers D1/D5/D8/D9).
 *
 * `lowerToIL` walks the validated AST and emits an {@link ILProgram}. Per D1 only
 * the **gate + slice-2 surface** is lowered; every other AST node kind reaches a
 * visitor **default arm** that raises an `E90001` ICE (D6/R69) and returns a
 * poison operand so the walk continues deterministically — it **never throws**.
 * Per D5 the lowering is real and fixture-tested today; only the live façade
 * wiring (a populated `SemanticModel`) is deferred, so under the live passthrough
 * the program is empty and this returns an empty `ILProgram`.
 *
 * Two register decisions shape the textual surface:
 * - **D8** — function-header params are the plan-backed frame-slot `Location`
 *   operands, rendered verbatim (`__frame_Math_add_a: i8u`).
 * - **D9** — the `poke`/`peek` address lowers to a **symbolic `location`**
 *   (`$D020`), not a decimal immediate, keeping addresses symbolic until the
 *   ACME emitter (AR-52) and matching the printer with no change.
 */

import { IceCode, primitive, walkChildren, walkNode } from "@blend65/core";
import type {
  AstNode,
  AstVisitor,
  BinaryExprNode,
  BinaryOp,
  BlockNode,
  DiagnosticBag,
  ExprNode,
  FunctionDeclNode,
  FunctionFrame,
  IdentExprNode,
  InterruptDeclNode,
  IntrinsicCallExprNode,
  LetDeclNode,
  AssignExprNode,
  NumericLitExprNode,
  PrimitiveName,
  ProgramNode,
  ReturnStmtNode,
  SemanticModel,
  AllocationPlan,
  StmtNode,
  TypeNode,
} from "@blend65/core";

import { IL_BYTE, IL_WORD, ilTypeOfType } from "./il-type.js";
import type { ILType } from "./il-type.js";
import { imm, isTemp, loc } from "./operand.js";
import type { ILOperand } from "./operand.js";
import type { ILInstruction } from "./instruction.js";
import type { ILFunction, ILProgram } from "./cfg.js";
import { IlFunctionBuilder } from "./builder.js";

/**
 * The lowering entry point's input (§4.12, D4): the AST roots plus the RD-04
 * model and RD-05 plan that resolve types and addresses.
 */
export interface LowerInput {
  /** RD-03 AST roots. */
  readonly program: readonly ProgramNode[];
  /** RD-04 semantic model (typed AST, symbols, const values). */
  readonly model: SemanticModel;
  /** RD-05 allocation plan (frame/zp/symbol addresses). */
  readonly plan: AllocationPlan;
}

/** AST binary operators that lower to a same-width IL binary instruction. */
const BINARY_OP_TO_IL: Partial<Record<BinaryOp, ILInstruction["op"]>> = {
  "+": "add",
  "-": "sub",
  "*": "mul",
  "/": "div",
  "%": "mod",
  "&": "and",
  "|": "or",
  "^": "xor",
  "<<": "shl",
  ">>": "shr",
  "==": "eq",
  "!=": "ne",
  "<": "lt",
  "<=": "le",
  ">": "gt",
  ">=": "ge",
};

/** IL opcodes whose result is always an `IL_BYTE` 0/1 (R20). */
const COMPARISON_RESULT_OPS = new Set(["eq", "ne", "lt", "le", "gt", "ge"]);

/** Per-function lowering context threaded through the statement/expression walk. */
interface LowerCtx {
  readonly builder: IlFunctionBuilder;
  readonly fqName: string;
  readonly frame: FunctionFrame | undefined;
  readonly bag: DiagnosticBag;
}

/**
 * Lower the validated AST + model + plan to IL (D4). Never throws (R69): user
 * errors are caught upstream; this emits only `E90001` ICEs for AST shapes it
 * does not yet handle. Functions carrying an `ErrorType`/error node are skipped
 * (R68).
 *
 * @param input The AST roots, semantic model, and allocation plan.
 * @param bag The diagnostic sink for ICEs.
 * @returns The lowered, frozen {@link ILProgram}.
 */
export function lowerToIL(input: LowerInput, bag: DiagnosticBag): ILProgram {
  const functions: ILFunction[] = [];
  for (const program of input.program) {
    const moduleName = program.moduleDecl.name;
    for (const item of program.items) {
      if (item.kind === "FunctionDecl" || item.kind === "InterruptDecl") {
        if (hasErrorNode(item)) {
          continue; // R68 — skip functions tainted by an ErrorType/error node
        }
        functions.push(lowerFunction(item, moduleName, input.plan, bag));
      }
    }
  }
  return Object.freeze({
    functions: Object.freeze(functions),
    initCode: Object.freeze([]),
    constData: Object.freeze([]),
    allocationPlan: input.plan,
  });
}

/** Lower one function/interrupt declaration into a single-block `ILFunction`. */
function lowerFunction(
  fn: FunctionDeclNode | InterruptDeclNode,
  moduleName: string,
  plan: AllocationPlan,
  bag: DiagnosticBag,
): ILFunction {
  const fqName = `${moduleName}.${fn.name}`;
  const frame = plan.frames.get(fqName)?.frame;
  const isInterrupt = fn.kind === "InterruptDecl";

  const params: ILOperand[] =
    fn.kind === "FunctionDecl"
      ? fn.params.map((p) => loc(frameSymbol(fqName, p.name), slotIlType(frame, p.name)))
      : [];
  const returnType = fn.kind === "FunctionDecl" ? typeNodeToIl(fn.returnType) : "void";

  const builder = new IlFunctionBuilder(fqName, params, returnType, isInterrupt);
  const ctx: LowerCtx = { builder, fqName, frame, bag };

  lowerBlock(fn.body, ctx);

  // Fall-through end of a function closes the entry block with `ret()` (R42).
  return builder.finish({ kind: "ret" });
}

/** Lower a block's statements in order into the current block. */
function lowerBlock(blockNode: BlockNode, ctx: LowerCtx): void {
  for (const stmt of blockNode.statements) {
    lowerStmt(stmt, ctx);
  }
}

/** Lower a single statement (gate/slice-2 surface); ICE default for the rest. */
function lowerStmt(stmt: StmtNode, ctx: LowerCtx): void {
  switch (stmt.kind) {
    case "Block":
      lowerBlock(stmt, ctx);
      return;
    case "LetDecl":
      lowerLetDecl(stmt, ctx);
      return;
    case "ExpressionStmt":
      // Lower for side effects (e.g. poke); the produced operand is discarded.
      lowerExpr(stmt.expression, ctx);
      return;
    case "ReturnStmt":
      lowerReturn(stmt, ctx);
      return;
    default:
      iceUnsupported(stmt, ctx, "statement");
  }
}

/** `let v = init;` → materialise init into a value, then store it to v's slot (R29/R30). */
function lowerLetDecl(decl: LetDeclNode, ctx: LowerCtx): void {
  if (decl.initialiser === null) {
    return; // R30 — no IL for an initialiser-less declaration
  }
  const value = materialise(lowerExpr(decl.initialiser, ctx), ctx);
  const target = loc(frameSymbol(ctx.fqName, decl.name), slotIlType(ctx.frame, decl.name));
  ctx.builder.emit({ op: "store", a: value, b: target });
}

/** `return [expr];` → terminate the block with `ret(value?)` (R42). */
function lowerReturn(stmt: ReturnStmtNode, ctx: LowerCtx): void {
  if (stmt.value === null) {
    ctx.builder.terminate({ kind: "ret" });
    return;
  }
  const value = lowerExpr(stmt.value, ctx);
  ctx.builder.terminate({ kind: "ret", value });
}

/** Lower a single expression to an operand (gate/slice-2 surface); ICE default. */
function lowerExpr(expr: ExprNode, ctx: LowerCtx): ILOperand {
  switch (expr.kind) {
    case "NumericLitExpr":
      return lowerNumericLit(expr);
    case "BoolLitExpr":
      return imm(expr.value ? 1 : 0, IL_BYTE);
    case "IdentExpr":
      return lowerIdent(expr, ctx);
    case "BinaryExpr":
      return lowerBinary(expr, ctx);
    case "AssignExpr":
      return lowerAssign(expr, ctx);
    case "IntrinsicCallExpr":
      return lowerIntrinsic(expr, ctx);
    default:
      return iceUnsupported(expr, ctx, "expression");
  }
}

/** A numeric literal folds directly to an immediate operand (R28/R45). */
function lowerNumericLit(expr: NumericLitExprNode): ILOperand {
  // No live typed model yet (D5): the slice is byte-typed, so IL_BYTE is the
  // documented default; the wider type matrix arrives with RD-04b (D1).
  return imm(expr.value, IL_BYTE);
}

/** A variable read loads its frame slot into a fresh temp (R22). */
function lowerIdent(expr: IdentExprNode, ctx: LowerCtx): ILOperand {
  const type = slotIlType(ctx.frame, expr.name);
  const dest = ctx.builder.newTemp(type);
  ctx.builder.emit({ op: "load", a: dest, b: loc(frameSymbol(ctx.fqName, expr.name), type) });
  return dest;
}

/** A same-width binary expression: evaluate left, then right, then the op (R18/R19/R33). */
function lowerBinary(expr: BinaryExprNode, ctx: LowerCtx): ILOperand {
  const op = BINARY_OP_TO_IL[expr.op];
  if (op === undefined) {
    return iceUnsupported(expr, ctx, `binary operator '${expr.op}'`);
  }
  const left = lowerExpr(expr.left, ctx); // left-first (FN-10)
  const right = lowerExpr(expr.right, ctx);
  const type: ILType = COMPARISON_RESULT_OPS.has(op) ? IL_BYTE : operandType(left);
  const dest = ctx.builder.newTemp(type);
  // The opcode is one of the binary arithmetic/bitwise/comparison families, all
  // of which share the `{dest,left,right,type}` shape.
  ctx.builder.emit({ op, dest, left, right, type } as ILInstruction);
  return dest;
}

/** `target = rhs` → materialise rhs and store it to the target's slot (R31). */
function lowerAssign(expr: AssignExprNode, ctx: LowerCtx): ILOperand {
  if (expr.op !== "=" || expr.target.kind !== "IdentExpr") {
    return iceUnsupported(expr, ctx, "assignment");
  }
  const value = materialise(lowerExpr(expr.value, ctx), ctx);
  const name = expr.target.name;
  ctx.builder.emit({
    op: "store",
    a: value,
    b: loc(frameSymbol(ctx.fqName, name), slotIlType(ctx.frame, name)),
  });
  return value;
}

/** Lower the supported memory intrinsics `poke`/`peek` (R46, D9). */
function lowerIntrinsic(expr: IntrinsicCallExprNode, ctx: LowerCtx): ILOperand {
  switch (expr.name) {
    case "poke": {
      const address = addressLocation(expr.args[0], ctx);
      const value = lowerExpr(expr.args[1], ctx);
      ctx.builder.emit({ op: "store", a: value, b: address });
      return imm(0, IL_BYTE); // void result, discarded by the ExpressionStmt
    }
    case "peek": {
      const address = addressLocation(expr.args[0], ctx);
      const dest = ctx.builder.newTemp(IL_BYTE);
      ctx.builder.emit({ op: "load", a: dest, b: address });
      return dest;
    }
    default:
      return iceUnsupported(expr, ctx, `intrinsic '${expr.name}'`);
  }
}

/**
 * Lower an address argument to a **symbolic `location`** (D9). A numeric literal
 * becomes a `$HEX` symbol so it prints verbatim while staying address-symbolic
 * through the IL (AR-52). Anything else is not yet supported → ICE.
 */
function addressLocation(arg: ExprNode | undefined, ctx: LowerCtx): ILOperand {
  if (arg !== undefined && arg.kind === "NumericLitExpr") {
    return loc(`$${arg.value.toString(16).toUpperCase()}`, IL_WORD);
  }
  return iceUnsupported(arg ?? ({ kind: "ErrorExpr", span: { sourceId: 0, start: 0, end: 0 } } as AstNode), ctx, "intrinsic address argument");
}

/** Wrap a non-temp value in a `const` temp so it can flow into a `store` (R28). */
function materialise(value: ILOperand, ctx: LowerCtx): ILOperand {
  if (isTemp(value)) {
    return value;
  }
  const dest = ctx.builder.newTemp(operandType(value));
  ctx.builder.emit({ op: "const", dest, src: value });
  return dest;
}

/** Emit the R69 ICE for an unsupported node and return a deterministic poison operand. */
function iceUnsupported(node: AstNode, ctx: LowerCtx, what: string): ILOperand {
  ctx.bag.addICE(
    IceCode.Unexpected,
    node.span,
    `IL lowering: unsupported ${what} node '${node.kind}'`,
  );
  return imm(0, IL_BYTE);
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** The sanitized frame-slot symbol for a variable (`__frame_<Module_fn>_<var>`). */
function frameSymbol(fqName: string, varName: string): string {
  return `__frame_${fqName.replaceAll(".", "_")}_${varName}`;
}

/** The IL type of a named frame slot, defaulting to `IL_BYTE` when absent. */
function slotIlType(frame: FunctionFrame | undefined, varName: string): ILType {
  const slot = frame?.slots.find((s) => s.name === varName);
  return slot ? ilTypeOfType(slot.type) : IL_BYTE;
}

/** The IL type carried by any operand. */
function operandType(operand: ILOperand): ILType {
  return operand.type;
}

/** Map a syntactic return type to an IL type, or `"void"`. */
function typeNodeToIl(node: TypeNode): ILType | "void" {
  if (node.kind === "PrimitiveType") {
    if (node.name === "void") {
      return "void";
    }
    return ilTypeOfType(primitive(node.name as PrimitiveName));
  }
  // NamedType (struct/enum) and ArrayType travel by-ref as a 16-bit address.
  return IL_WORD;
}

/**
 * Deep-scan a declaration subtree for any error sentinel (`ErrorExpr`/
 * `ErrorStmt`/`ErrorType`) — the R68 "carries an ErrorType" test. Uses the core
 * traversal helpers with a uniform visitor so no node kind is missed.
 */
function hasErrorNode(root: AstNode): boolean {
  let found = false;
  const visit = (node: AstNode): void => {
    if (node.kind === "ErrorExpr" || node.kind === "ErrorStmt" || node.kind === "ErrorType") {
      found = true;
      return;
    }
    walkChildren(node, visitor);
  };
  const visitor = new Proxy({} as AstVisitor<void>, { get: () => visit });
  walkNode(root, visitor);
  return found;
}
