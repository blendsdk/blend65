/**
 * RD-18 Slice 3b expression + literal typing (Pass 3, FR-2/FR-3).
 *
 * `typeOfExpr` walks an expression, assigns every node a semantic {@link Type}
 * (memoised into `ctx.typeMap`), resolves identifiers (recording `ctx.symbolMap`
 * and emitting E10100 on a miss), and enforces the same-type arithmetic rule
 * (E10081 mixed-sign / E10080 boolean operand). Assignment expressions check
 * l-value mutability (E10191) and assignment compatibility. Every failure emits a
 * diagnostic and **poisons** with {@link ERROR_TYPE} (R114) — it never throws.
 *
 * Scope is same-type only (AR-3): implicit widening, casts, and non-arithmetic
 * operators (comparison / logical / shift) are out of the Slice-3b surface and
 * are typed defensively (operands still walked to populate `typeMap`) without a
 * result-type guarantee. This module lives in `@blend65/frontend` and imports
 * `@blend65/core` only (R15/AR-20).
 */

import {
  commonType,
  DiagCode,
  ERROR_TYPE,
  isAssignableTo,
  isError,
  isInteger,
  isSigned,
  primitive,
  typeName,
} from "@blend65/core";
import type {
  AssignExprNode,
  BinaryExprNode,
  ExprNode,
  IdentExprNode,
  IntrinsicCallExprNode,
  NumericLitExprNode,
  Scope,
  Type,
} from "@blend65/core";
import type { TypeCheckContext } from "./context.js";
import { resolveName } from "./name-resolution.js";
import { integerRange } from "./type-resolution.js";
import { evalConst } from "../const-eval.js";

/** The arithmetic operators Slice 3b types with the same-type rule (spec TS-3). */
const ARITHMETIC_OPS: ReadonlySet<string> = new Set(["+", "-", "*", "/", "%"]);

/**
 * Types `expr` (FR-2), memoising the result into `ctx.typeMap`. Recursive; never
 * throws. When `contextType` is a primitive integer it drives literal adaptation
 * (spec TS-2): a bare numeric literal takes the context type.
 *
 * @param expr The expression to type.
 * @param scope The innermost scope the expression appears in (for name lookup).
 * @param ctx The Pass-3 context (bag + maps).
 * @param contextType The declared/target type providing literal adaptation, if any.
 * @returns The resolved type ({@link ERROR_TYPE} on any failure — poison).
 */
export function typeOfExpr(
  expr: ExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
  contextType?: Type,
): Type {
  const t = computeType(expr, scope, ctx, contextType);
  ctx.typeMap.set(expr, t);
  return t;
}

/** Computes an expression's type without memoising (the {@link typeOfExpr} core). */
function computeType(
  expr: ExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
  contextType?: Type,
): Type {
  switch (expr.kind) {
    case "NumericLitExpr":
      return typeNumericLiteral(expr, contextType);
    case "BoolLitExpr":
      return primitive("boolean");
    case "IdentExpr":
      return typeIdent(expr, scope, ctx);
    case "BinaryExpr":
      return typeBinary(expr, scope, ctx);
    case "AssignExpr":
      return typeAssign(expr, scope, ctx);
    case "IntrinsicCallExpr":
      return typeIntrinsicCall(expr, scope, ctx);
    default:
      // Member / index / call / cast / unary / struct-lit / etc. are out of the
      // Slice-3b surface (owned by later slices); poison without a diagnostic.
      return ERROR_TYPE;
  }
}

/**
 * Literal typing (spec TS-2): a numeric literal adapts to a primitive-integer
 * `contextType` when one is supplied; otherwise it takes its by-value default
 * (0–255 → byte, else word). The range check (E10084) is the caller's job (it
 * knows the declared/target type) — see `checkConstRange`.
 */
function typeNumericLiteral(expr: NumericLitExprNode, contextType?: Type): Type {
  if (contextType !== undefined && contextType.kind === "primitive" && isInteger(contextType)) {
    return contextType; // literal adaptation to the declared/target type
  }
  return expr.value <= 255 ? primitive("byte") : primitive("word");
}

/** Identifier typing: resolve the name; E10100 + poison on a miss. */
function typeIdent(expr: IdentExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const sym = resolveName(expr.name, scope);
  if (sym === null) {
    ctx.bag.addError(
      DiagCode.UndeclaredIdentifier,
      expr.span,
      `Undeclared identifier '${expr.name}'`,
    );
    return ERROR_TYPE;
  }
  ctx.symbolMap.set(expr, sym);
  return sym.type;
}

/**
 * Binary typing for the arithmetic operators (spec TS-3, same-type). Non-
 * arithmetic operators are out of surface: operands are still walked (to populate
 * `typeMap`) but the result poisons to {@link ERROR_TYPE}.
 */
function typeBinary(expr: BinaryExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  let lt = typeOfExpr(expr.left, scope, ctx);
  let rt = typeOfExpr(expr.right, scope, ctx);

  if (!ARITHMETIC_OPS.has(expr.op)) return ERROR_TYPE; // comparison/logical/shift → Slice 4+/6

  // Literal adaptation in expressions (spec TS-2): a bare numeric-literal operand
  // adopts the other operand's integer type so `wordVar + 1` types as word.
  if (expr.left.kind === "NumericLitExpr" && rt.kind === "primitive" && isInteger(rt)) {
    lt = rt;
    ctx.typeMap.set(expr.left, lt);
  } else if (expr.right.kind === "NumericLitExpr" && lt.kind === "primitive" && isInteger(lt)) {
    rt = lt;
    ctx.typeMap.set(expr.right, rt);
  }

  const combined = commonType(lt, rt);
  if (combined !== null) return combined; // same-type (or poison → ERROR_TYPE)

  // Not combinable in 3b — pick the diagnostic (both operands are non-poison here,
  // since a poisoned operand yields ERROR_TYPE from commonType, not null).
  emitBinaryOperandError(expr, lt, rt, ctx);
  return ERROR_TYPE;
}

/** Emits E10080 (boolean operand) or E10081 (mixed signedness) for a bad binary. */
function emitBinaryOperandError(
  expr: BinaryExprNode,
  lt: Type,
  rt: Type,
  ctx: TypeCheckContext,
): void {
  const boolean = primitive("boolean");
  const leftBool = typeName(lt) === typeName(boolean);
  const rightBool = typeName(rt) === typeName(boolean);
  if (leftBool || rightBool) {
    const offending = leftBool ? lt : rt;
    ctx.bag.addError(
      DiagCode.InvalidOperandType, // E10080 (ledger R34)
      expr.span,
      `Operator '${expr.op}' cannot be applied to type '${typeName(offending)}'`,
    );
    return;
  }
  if (isInteger(lt) && isInteger(rt) && isSigned(lt) !== isSigned(rt)) {
    ctx.bag.addError(
      DiagCode.MixedSignedUnsignedOperands, // E10081 (AC-2/AC-4 headline)
      expr.span,
      `Cannot mix signed and unsigned types in '${expr.op}' — use an explicit cast`,
    );
    return;
  }
  // Same-sign different-width (widening) and non-primitive operands are out of the
  // Slice-3b surface (deferred to Slice 6); the result already poisoned to
  // ERROR_TYPE. No 3b diagnostic code is designated, so none is emitted.
}

/**
 * Assignment typing: the target must be a mutable l-value (a `variable`; a
 * `constant` → E10191), and the value must be assignment-compatible with it
 * (same-type in 3b; otherwise E10152/E10153/E10154). Result = the target type.
 */
function typeAssign(expr: AssignExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const targetType = typeOfExpr(expr.target, scope, ctx);

  // L-value mutability: a resolved `constant` target cannot be assigned (E10191).
  if (expr.target.kind === "IdentExpr") {
    const sym = resolveName(expr.target.name, scope);
    if (sym !== null && sym.kind === "constant") {
      ctx.bag.addError(
        DiagCode.AssignToConst,
        expr.span,
        `Cannot assign to constant '${expr.target.name}'`,
      );
    }
  }

  const valueType = typeOfExpr(expr.value, scope, ctx, targetType);
  checkConstRange(expr.value, targetType, ctx);
  checkAssignable(valueType, targetType, expr.span, ctx);
  return targetType;
}

/**
 * Intrinsic-call typing: `peek`→byte, `peekw`→word, `lo`/`hi`→byte,
 * `poke`/`pokew`→void. Arguments are always walked (to populate `typeMap` for
 * width-aware lowering). Unknown intrinsics poison without a diagnostic (the
 * intrinsic-validation pass owns their errors).
 */
function typeIntrinsicCall(
  expr: IntrinsicCallExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): Type {
  for (const arg of expr.args) typeOfExpr(arg, scope, ctx);

  switch (expr.name) {
    case "peek":
    case "lo":
    case "hi":
      return primitive("byte");
    case "peekw":
      return primitive("word");
    case "poke":
    case "pokew":
      return primitive("void");
    default:
      return ERROR_TYPE; // sizeof/offsetof/embed/etc. — out of the 3b scalar surface
  }
}

/**
 * Emits the assignment-compatibility diagnostic when `valueType` is not
 * assignable to `targetType` (AR-11 canonical codes). Same-type / poison → no
 * diagnostic. Widening (same-sign different-width) is also rejected in 3b
 * (deferred to Slice 6) and reported through the width code — no fixture reaches
 * it, so the (narrowing-worded) message never surfaces in the supported surface.
 *
 * @param valueType The type of the value being assigned.
 * @param targetType The declared/target type.
 * @param span The span to anchor the diagnostic to.
 * @param ctx The Pass-3 context.
 */
export function checkAssignable(
  valueType: Type,
  targetType: Type,
  span: AssignExprNode["span"],
  ctx: TypeCheckContext,
): void {
  if (isAssignableTo(valueType, targetType)) return; // same-type or poison → ok

  ctx.bag.addError(
    assignmentMismatchCode(valueType, targetType),
    span,
    `Cannot assign a value of type '${typeName(valueType)}' to '${typeName(targetType)}'`,
  );
}

/** Chooses the assignment-mismatch code for two non-assignable, non-poison types. */
function assignmentMismatchCode(value: Type, target: Type): string {
  const boolean = primitive("boolean");
  const valueBool = typeName(value) === typeName(boolean);
  const targetBool = typeName(target) === typeName(boolean);
  if (valueBool || targetBool) return DiagCode.TypeMismatchAssignment; // E10152 boolean↔int
  if (isInteger(value) && isInteger(target)) {
    if (isSigned(value) !== isSigned(target)) return DiagCode.SignedUnsignedMismatch; // E10153
    return DiagCode.WidthNarrowingNoCast; // E10154 (narrowing; widening deferred to Slice 6)
  }
  return DiagCode.TypeMismatchAssignment; // E10152 — generic mismatch fallback
}

/**
 * Range/div-by-zero check for a constant-foldable value against a target integer
 * type (FR-6): folds `expr`; a constant out of the target's range → E10084; a
 * constant division/remainder by zero → E10082. Non-constant / non-integer-target
 * expressions are skipped (checked dynamically or out of surface).
 *
 * @param expr The value expression.
 * @param targetType The declared/target integer type.
 * @param ctx The Pass-3 context.
 */
export function checkConstRange(expr: ExprNode, targetType: Type, ctx: TypeCheckContext): void {
  const folded = evalConst(expr);
  if (folded.kind === "divByZero") {
    ctx.bag.addError(
      DiagCode.ConstDivisionByZero, // E10082
      folded.span,
      "Division by zero in constant expression",
    );
    return;
  }
  if (folded.kind !== "value" || typeof folded.value !== "number") return;
  if (isError(targetType)) return;
  const range = integerRange(targetType);
  if (range === null) return; // boolean/void/non-integer target — no range check
  if (folded.value < range.min || folded.value > range.max) {
    ctx.bag.addError(
      DiagCode.ValueOutOfRange, // E10084
      expr.span,
      `Value ${folded.value} out of range for type '${typeName(targetType)}' ` +
        `(range: ${range.min} to ${range.max})`,
    );
  }
}
