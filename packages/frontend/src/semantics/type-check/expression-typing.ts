/**
 * Expression and literal typing (Pass 3).
 *
 * `typeOfExpr` walks an expression, assigns every node a semantic {@link Type}
 * (memoised into `ctx.typeMap`), resolves identifiers (recording `ctx.symbolMap`
 * and emitting E10100 on a miss), and types the full operator surface:
 * arithmetic/bitwise (mixed-width same-sign operands auto-promote to the wider
 * type; mixed-sign → E10081, boolean operand → E10080), shifts (result = the
 * left type; a signed amount → E10083; a constant amount at or beyond the
 * width → W10174), comparisons (result `boolean`; ordered comparison on
 * booleans → E10080), logical `&&`/`||` (boolean operands only), unary
 * `- ! ~` (negating an unsigned → E10087), casts (integer↔integer only;
 * boolean → E10086, void/aggregate → E10155), the conditional operator
 * (non-boolean condition → E10134; incompatible arms → E10088), and compound
 * assignment (expanded-form semantics; the result must assign back to the
 * target). Assignment expressions check l-value mutability (E10191) and
 * assignment compatibility. Every failure emits a diagnostic and **poisons**
 * with {@link ERROR_TYPE} instead of throwing.
 *
 * An expression's type comes from its operands, never from the destination —
 * narrow arithmetic feeding a wider target evaluates at the narrow width first
 * and only then widens, which is why the intermediate-overflow advisories
 * (W10160/W10161) exist. This module lives in `@blend65/frontend` and imports
 * `@blend65/core` only, keeping the frontend independent of codegen.
 */

import {
  bitWidth,
  commonType,
  DiagCode,
  ERROR_TYPE,
  IceCode,
  isAssignableTo,
  isError,
  isInteger,
  isSigned,
  isUnsigned,
  primitive,
  typeName,
} from "@blend65/core";
import type {
  AssignExprNode,
  AstNode,
  BinaryExprNode,
  CallExprNode,
  CastExprNode,
  ConditionalExprNode,
  ExprNode,
  FieldAccessExprNode,
  FunctionDeclNode,
  IdentExprNode,
  IntrinsicCallExprNode,
  NumericLitExprNode,
  Scope,
  SourceSpan,
  Symbol,
  Type,
  UnaryExprNode,
} from "@blend65/core";
import type { FnSignature, TypeCheckContext } from "./context.js";
import { enclosingFunctionSymbol, resolveName, resolveQualified } from "./name-resolution.js";
import { integerRange, resolveTypeNode } from "./type-resolution.js";
import { evalConst, fromBits, toBits } from "../const-eval.js";
import type { ConstRefResolver } from "../const-eval.js";

/** The arithmetic operators (integer operands; common-type result). */
const ARITHMETIC_OPS: ReadonlySet<string> = new Set(["+", "-", "*", "/", "%"]);

/** The bitwise operators (integer operands; common-type result). */
const BITWISE_OPS: ReadonlySet<string> = new Set(["&", "|", "^"]);

/** The shift operators (integer left, unsigned right; left-type result). */
const SHIFT_OPS: ReadonlySet<string> = new Set(["<<", ">>"]);

/** The comparison operators (always produce `boolean`). */
const COMPARISON_OPS: ReadonlySet<string> = new Set(["==", "!=", "<", "<=", ">", ">="]);

/** The logical operators (boolean operands; short-circuit at runtime). */
const LOGICAL_OPS: ReadonlySet<string> = new Set(["&&", "||"]);

/**
 * The arithmetic operators the intermediate-overflow advisories watch. The
 * hazard is a value growing past the narrow width, so `+ - *` qualify while
 * `/`/`%` (never larger than their operands) and the bitwise class do not.
 */
const INTERMEDIATE_OVERFLOW_OPS: ReadonlySet<string> = new Set(["+", "-", "*"]);

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
    case "UnaryExpr":
      return typeUnary(expr, scope, ctx, contextType);
    case "CastExpr":
      return typeCast(expr, scope, ctx);
    case "ConditionalExpr":
      return typeConditional(expr, scope, ctx, contextType);
    case "AssignExpr":
      return typeAssign(expr, scope, ctx);
    case "IntrinsicCallExpr":
      return typeIntrinsicCall(expr, scope, ctx);
    case "CallExpr":
      return typeCall(expr, scope, ctx);
    case "FieldAccessExpr":
      return typeFieldAccess(expr, scope, ctx);
    default:
      // Index / struct-lit / etc. are not yet handled here; poison without a
      // diagnostic.
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
 * Binary typing, dispatched by operator class. Operands are always walked
 * (populating `typeMap`); each class applies its own operand rule and result
 * type (see the module header). Unknown operator shapes poison defensively.
 */
function typeBinary(expr: BinaryExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  if (LOGICAL_OPS.has(expr.op)) return typeLogicalBinary(expr, scope, ctx);
  if (SHIFT_OPS.has(expr.op)) return typeShiftBinary(expr, scope, ctx);
  if (COMPARISON_OPS.has(expr.op)) return typeComparisonBinary(expr, scope, ctx);
  if (ARITHMETIC_OPS.has(expr.op) || BITWISE_OPS.has(expr.op)) {
    return typeIntegerBinary(expr, scope, ctx);
  }
  // Unknown operator shape — walk operands for map coverage, poison silently.
  typeOfExpr(expr.left, scope, ctx);
  typeOfExpr(expr.right, scope, ctx);
  return ERROR_TYPE;
}

/**
 * Types both operands with cross-operand literal adaptation: a bare
 * numeric-literal operand adopts the other operand's integer type so
 * `wordVar + 1` types as word. Applies to every integer-operand class.
 */
function typeAdaptedOperands(
  expr: BinaryExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): { lt: Type; rt: Type } {
  let lt = typeOfExpr(expr.left, scope, ctx);
  let rt = typeOfExpr(expr.right, scope, ctx);

  if (expr.left.kind === "NumericLitExpr" && rt.kind === "primitive" && isInteger(rt)) {
    lt = rt;
    ctx.typeMap.set(expr.left, lt);
  } else if (expr.right.kind === "NumericLitExpr" && lt.kind === "primitive" && isInteger(lt)) {
    rt = lt;
    ctx.typeMap.set(expr.right, rt);
  }
  return { lt, rt };
}

/**
 * Arithmetic (`+ - * / %`) and bitwise (`& | ^`) typing: integer operands
 * only (a boolean operand → E10080), same-sign widths promote to the wider
 * type, mixed signedness → E10081.
 */
function typeIntegerBinary(expr: BinaryExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const { lt, rt } = typeAdaptedOperands(expr, scope, ctx);
  if (isError(lt) || isError(rt)) return ERROR_TYPE; // cascade suppression

  // Boolean is not numeric — reject before the common-type rule (which would
  // otherwise accept boolean OP boolean as a same-type pair).
  if (typeName(lt) === "boolean" || typeName(rt) === "boolean") {
    emitBinaryOperandError(expr.op, expr.span, lt, rt, ctx);
    return ERROR_TYPE;
  }

  const combined = commonType(lt, rt);
  if (combined !== null) return combined; // same-type or promoted

  emitBinaryOperandError(expr.op, expr.span, lt, rt, ctx);
  return ERROR_TYPE;
}

/**
 * Comparison typing: the result is always `boolean`. Integer operands follow
 * the arithmetic mixing rules (promotion in, mixed sign → E10081); booleans
 * support only `==`/`!=` — an ordered comparison on booleans, or a
 * boolean/integer mix, is E10080.
 */
function typeComparisonBinary(
  expr: BinaryExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): Type {
  const { lt, rt } = typeAdaptedOperands(expr, scope, ctx);
  if (isError(lt) || isError(rt)) return ERROR_TYPE; // cascade suppression

  const leftBool = typeName(lt) === "boolean";
  const rightBool = typeName(rt) === "boolean";
  if (leftBool && rightBool) {
    if (expr.op === "==" || expr.op === "!=") return primitive("boolean");
    emitBinaryOperandError(expr.op, expr.span, lt, rt, ctx); // ordered on boolean
    return ERROR_TYPE;
  }
  if (leftBool || rightBool) {
    emitBinaryOperandError(expr.op, expr.span, lt, rt, ctx); // boolean vs integer
    return ERROR_TYPE;
  }

  if (commonType(lt, rt) === null) {
    emitBinaryOperandError(expr.op, expr.span, lt, rt, ctx); // mixed sign / non-primitive
    return ERROR_TYPE;
  }
  return primitive("boolean");
}

/**
 * Logical `&&`/`||` typing: both operands must be `boolean` (E10080
 * otherwise); the result is `boolean`. Short-circuit evaluation is a language
 * guarantee realised at lowering — typing only enforces the operand rule.
 */
function typeLogicalBinary(expr: BinaryExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const lt = typeOfExpr(expr.left, scope, ctx);
  const rt = typeOfExpr(expr.right, scope, ctx);
  if (isError(lt) || isError(rt)) return ERROR_TYPE; // cascade suppression

  const offending = typeName(lt) !== "boolean" ? lt : typeName(rt) !== "boolean" ? rt : null;
  if (offending !== null) {
    ctx.bag.addError(
      DiagCode.InvalidOperandType, // E10080
      expr.span,
      `Operator '${expr.op}' cannot be applied to type '${typeName(offending)}'`,
    );
    return ERROR_TYPE;
  }
  return primitive("boolean");
}

/**
 * Shift typing: the left operand must be an integer (boolean → E10080), the
 * amount must be an UNSIGNED integer (a signed amount → E10083; a boolean →
 * E10080), and the result is the LEFT operand's type. A constant amount at or
 * beyond the left type's bit width additionally warns W10174 (the result is
 * well-defined — always 0 — so the expression still types).
 */
function typeShiftBinary(expr: BinaryExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const lt = typeOfExpr(expr.left, scope, ctx);
  // The amount's literal-adaptation context is byte (a bare `2` in `x << 2`).
  const rt = typeOfExpr(expr.right, scope, ctx, primitive("byte"));
  if (isError(lt) || isError(rt)) return ERROR_TYPE; // cascade suppression

  if (lt.kind !== "primitive" || !isInteger(lt)) {
    ctx.bag.addError(
      DiagCode.InvalidOperandType, // E10080
      expr.span,
      `Operator '${expr.op}' cannot be applied to type '${typeName(lt)}'`,
    );
    return ERROR_TYPE;
  }
  if (!isInteger(rt)) {
    ctx.bag.addError(
      DiagCode.InvalidOperandType, // E10080
      expr.span,
      `Operator '${expr.op}' cannot be applied to type '${typeName(rt)}'`,
    );
    return ERROR_TYPE;
  }
  if (isSigned(rt)) {
    ctx.bag.addError(
      DiagCode.ShiftAmountNotUnsigned, // E10083
      expr.right.span,
      `Shift amount must be unsigned ('byte' or 'word') — found '${typeName(rt)}'`,
    );
    return ERROR_TYPE;
  }

  // Advisory: a constant amount ≥ the operand width always yields 0.
  const width = bitWidth(lt);
  const amount = evalConst(expr.right, undefined, (e) => ctx.typeMap.get(e));
  if (amount.kind === "value" && typeof amount.value === "number" && amount.value >= width) {
    ctx.bag.addWarning(
      DiagCode.ShiftCountExceedsWidth, // W10174
      expr.right.span,
      `Shift amount ${amount.value} >= type width (${width} bits) — result is always 0`,
    );
  }
  return lt;
}

/** Emits E10080 (boolean operand) or E10081 (mixed signedness) for a bad binary. */
function emitBinaryOperandError(
  op: string,
  span: SourceSpan,
  lt: Type,
  rt: Type,
  ctx: TypeCheckContext,
): void {
  const leftBool = typeName(lt) === "boolean";
  const rightBool = typeName(rt) === "boolean";
  if (leftBool || rightBool) {
    const offending = leftBool ? lt : rt;
    ctx.bag.addError(
      DiagCode.InvalidOperandType, // E10080
      span,
      `Operator '${op}' cannot be applied to type '${typeName(offending)}'`,
    );
    return;
  }
  if (isInteger(lt) && isInteger(rt) && isSigned(lt) !== isSigned(rt)) {
    ctx.bag.addError(
      DiagCode.MixedSignedUnsignedOperands, // E10081
      span,
      `Cannot mix signed and unsigned types in '${op}' — use an explicit cast`,
    );
    return;
  }
  // Non-primitive operands (structs/arrays/enums) are not combinable yet; the
  // result is already poisoned to ERROR_TYPE, and no diagnostic code is
  // designated for this case, so none is emitted.
}

/**
 * Unary typing.
 *
 * `-` is valid on signed integers only (an unsigned operand → E10087, a
 * boolean → E10080); a directly-nested numeric literal makes the whole
 * `-literal` a negative literal that adapts to an integer context type, or
 * defaults by value (`-1` → sbyte, `-300` → sword) — negating a *literal* is
 * never the unsigned-negation error. `!` requires a boolean operand and
 * yields boolean. `~` requires an integer operand and yields the operand's
 * own type — deliberately with NO context adaptation, so the complement is
 * computed at the operand's own width before any widening (`~1` is byte-wide
 * 254 even in a word context). `&` (address-of) is not part of the surface
 * yet: the operand is walked and the result poisons silently — lowering
 * rejects any surviving use loudly.
 */
function typeUnary(
  expr: UnaryExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
  contextType?: Type,
): Type {
  if (expr.op === "-") {
    if (expr.operand.kind === "NumericLitExpr") {
      // Negative-literal shape: the literal adapts to an integer context, or
      // defaults from the NEGATED value's range.
      const adapted =
        contextType !== undefined && contextType.kind === "primitive" && isInteger(contextType)
          ? contextType
          : primitive(-expr.operand.value >= -128 ? "sbyte" : "sword");
      ctx.typeMap.set(expr.operand, adapted);
      return adapted;
    }
    const t = typeOfExpr(expr.operand, scope, ctx, contextType);
    if (isError(t)) return ERROR_TYPE; // cascade suppression
    if (typeName(t) === "boolean" || !isInteger(t)) {
      ctx.bag.addError(
        DiagCode.InvalidOperandType, // E10080
        expr.span,
        `Operator '-' cannot be applied to type '${typeName(t)}'`,
      );
      return ERROR_TYPE;
    }
    if (isUnsigned(t)) {
      ctx.bag.addError(
        DiagCode.NegateUnsigned, // E10087
        expr.span,
        `Cannot negate unsigned type '${typeName(t)}' — use 'sbyte'/'sword' for ` +
          `signed arithmetic`,
      );
      return ERROR_TYPE;
    }
    return t; // signed integer
  }

  if (expr.op === "!") {
    const t = typeOfExpr(expr.operand, scope, ctx);
    if (isError(t)) return ERROR_TYPE; // cascade suppression
    if (typeName(t) !== "boolean") {
      ctx.bag.addError(
        DiagCode.InvalidOperandType, // E10080
        expr.span,
        `Operator '!' cannot be applied to type '${typeName(t)}'`,
      );
      return ERROR_TYPE;
    }
    return primitive("boolean");
  }

  if (expr.op === "~") {
    // No context: the complement happens at the operand's own width.
    const t = typeOfExpr(expr.operand, scope, ctx);
    if (isError(t)) return ERROR_TYPE; // cascade suppression
    if (!isInteger(t)) {
      ctx.bag.addError(
        DiagCode.InvalidOperandType, // E10080
        expr.span,
        `Operator '~' cannot be applied to type '${typeName(t)}'`,
      );
      return ERROR_TYPE;
    }
    return t;
  }

  // Address-of — not a value surface yet; walk the operand, poison silently.
  typeOfExpr(expr.operand, scope, ctx);
  return ERROR_TYPE;
}

/**
 * Cast typing (`<type>(expr)`): integer→integer casts (all pairs, identity
 * included) type as the target. A cast between boolean and an integer is
 * E10086; a cast involving void or an aggregate is E10155. The operand is
 * typed with NO context — the cast converts the operand's own-width value. An
 * unresolved named target type is already poisoned by type resolution and
 * stays a silent poison here.
 */
function typeCast(expr: CastExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const target = resolveTypeNode(expr.targetType);
  const operand = typeOfExpr(expr.operand, scope, ctx);
  if (isError(operand) || isError(target)) return ERROR_TYPE; // cascade suppression

  const targetBool = typeName(target) === "boolean";
  const operandBool = typeName(operand) === "boolean";
  if (isInteger(target) && isInteger(operand)) {
    warnNarrowingCastTruncation(expr, operand, target, ctx);
    return target;
  }
  if (targetBool && operandBool) return target; // identity cast

  if ((targetBool && isInteger(operand)) || (operandBool && isInteger(target))) {
    ctx.bag.addError(
      DiagCode.BooleanIntegerCast, // E10086
      expr.span,
      `Cannot cast '${typeName(operand)}' to '${typeName(target)}' — boolean is ` +
        `not convertible to/from integer types`,
    );
    return ERROR_TYPE;
  }

  ctx.bag.addError(
    DiagCode.InvalidCast, // E10155
    expr.span,
    `Cannot cast '${typeName(operand)}' to '${typeName(target)}' — only integer ` +
      `types support casts`,
  );
  return ERROR_TYPE;
}

/**
 * The narrowing-cast truncation advisory (W10101): when a 16-bit constant
 * operand casts down to an 8-bit type and the reinterpreted result differs
 * from the original value, bits were lost — the cast is the explicit opt-in,
 * so this warns rather than errors. Same-width reinterpretation (byte↔sbyte)
 * and widening never warn: no bits are lost.
 */
function warnNarrowingCastTruncation(
  expr: CastExprNode,
  operandType: Type,
  targetType: Type,
  ctx: TypeCheckContext,
): void {
  if (operandType.kind !== "primitive" || targetType.kind !== "primitive") return;
  if (bitWidth(operandType) !== 16 || bitWidth(targetType) !== 8) return;

  const folded = evalConst(expr.operand, undefined, (e) => ctx.typeMap.get(e));
  if (folded.kind !== "value" || typeof folded.value !== "number") return;
  const result = fromBits(toBits(folded.value, 8), 8, isSigned(targetType));
  if (result === folded.value) return; // the value survives — no bits lost

  ctx.bag.addWarning(
    DiagCode.NarrowingCastTruncates, // W10101
    expr.span,
    `Narrowing cast from '${typeName(operandType)}' to '${typeName(targetType)}' ` +
      `truncates value ${folded.value} to ${result}`,
  );
}

/**
 * Conditional-operator typing (`cond ? a : b`): the condition must be boolean
 * (E10134 otherwise — the arms still type, so the result is the arms' common
 * type rather than poison), both arms type in the INCOMING context (literal
 * arms adapt to the declared target), and the result is the arms' common type
 * under the same promotion rules as arithmetic. Arms with no common type are
 * E10088.
 */
function typeConditional(
  expr: ConditionalExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
  contextType?: Type,
): Type {
  const condType = typeOfExpr(expr.condition, scope, ctx);
  if (!isError(condType) && typeName(condType) !== "boolean") {
    ctx.bag.addError(
      DiagCode.NonBooleanCondition, // E10134
      expr.condition.span,
      `Condition must be type 'boolean' — found '${typeName(condType)}'. Use an ` +
        `explicit comparison`,
    );
  }

  const trueType = typeOfExpr(expr.whenTrue, scope, ctx, contextType);
  const falseType = typeOfExpr(expr.whenFalse, scope, ctx, contextType);
  if (isError(trueType) || isError(falseType)) return ERROR_TYPE; // cascade suppression

  const combined = commonType(trueType, falseType);
  if (combined === null) {
    ctx.bag.addError(
      DiagCode.TernaryArmMismatch, // E10088
      expr.span,
      `Conditional operator arms have incompatible types '${typeName(trueType)}' ` +
        `and '${typeName(falseType)}'`,
    );
    return ERROR_TYPE;
  }
  return combined;
}

/**
 * Assignment typing: the target must be a mutable l-value (a `variable`; a
 * `constant` → E10191), and the value must be assignment-compatible with it
 * (E10152/E10153/E10154 otherwise). A compound assignment (`x OP= e`) carries
 * the expanded form's semantics `x = x OP e`: the operator class's binary
 * rule applies to (target, value), and the expansion's result must be
 * assignable BACK to the target — `byte += word` promotes to word and then
 * fails the narrowing write-back. Result = the target type.
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
  } else if (expr.target.kind === "FieldAccessExpr") {
    // A qualified target was resolved (and recorded in `symbolMap`) while it
    // was typed above; a failed or non-module resolution is already poisoned
    // or diagnosed there, and a function member is already rejected loudly.
    const sym = ctx.symbolMap.get(expr.target);
    if (sym !== undefined && sym.kind === "constant") {
      ctx.bag.addError(
        DiagCode.AssignToConst,
        expr.span,
        `Cannot assign to constant '${expr.target.field}'`,
      );
    }
  }

  const valueType = typeOfExpr(expr.value, scope, ctx, targetType);
  checkConstRange(expr.value, targetType, ctx);

  if (expr.op === "=") {
    checkAssignable(valueType, targetType, expr.span, ctx);
    checkIntermediateOverflow(expr.value, valueType, targetType, ctx);
    return targetType;
  }
  return typeCompoundAssign(expr, targetType, valueType, ctx);
}

/**
 * The compound-assignment expansion check for `x OP= e` (the `=` fast path is
 * handled by the caller). Shift compounds apply the unsigned-amount rule; the
 * arithmetic/bitwise compounds apply the integer common-type rule to
 * (target, value) and then require the (possibly promoted) result to narrow
 * back into the target without a cast.
 */
function typeCompoundAssign(
  expr: AssignExprNode,
  targetType: Type,
  valueType: Type,
  ctx: TypeCheckContext,
): Type {
  if (isError(targetType) || isError(valueType)) return targetType; // cascade suppression

  const baseOp = expr.op.slice(0, -1); // "+=" → "+", "<<=" → "<<"

  if (SHIFT_OPS.has(baseOp)) {
    if (targetType.kind !== "primitive" || !isInteger(targetType)) {
      emitBinaryOperandError(baseOp, expr.span, targetType, valueType, ctx);
      return targetType;
    }
    if (!isInteger(valueType)) {
      emitBinaryOperandError(baseOp, expr.span, targetType, valueType, ctx);
      return targetType;
    }
    if (isSigned(valueType)) {
      ctx.bag.addError(
        DiagCode.ShiftAmountNotUnsigned, // E10083
        expr.value.span,
        `Shift amount must be unsigned ('byte' or 'word') — found '${typeName(valueType)}'`,
      );
    }
    return targetType; // a shift's result is the left (target) type — always writes back
  }

  // Arithmetic/bitwise expansion: boolean operands are not numeric.
  if (typeName(targetType) === "boolean" || typeName(valueType) === "boolean") {
    emitBinaryOperandError(baseOp, expr.span, targetType, valueType, ctx);
    return targetType;
  }
  const combined = commonType(targetType, valueType);
  if (combined === null) {
    emitBinaryOperandError(baseOp, expr.span, targetType, valueType, ctx);
    return targetType;
  }

  // Write-back: the expansion's result must fit the target without a cast.
  checkAssignable(combined, targetType, expr.span, ctx);
  checkIntermediateOverflow(expr.value, valueType, targetType, ctx);
  return targetType;
}

/**
 * Qualified `Module.member` access in value position.
 *
 * Resolution dispatches on `resolveQualified`: a non-module shape (struct
 * field access, a value-shadowed head) keeps today's silent poison; a failed
 * resolution is already diagnosed there. A resolved module `variable`/
 * `constant` types as that symbol (recorded in `symbolMap` — the SAME symbol
 * the module scope declares, so downstream symbol-keyed machinery works
 * unchanged). A resolved function/interrupt member is not a value — function
 * references are a future feature, so the shape is rejected loudly rather
 * than silently miscompiled.
 */
function typeFieldAccess(
  expr: FieldAccessExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): Type {
  const res = resolveQualified(expr, scope, ctx.moduleScopes, ctx.bag);
  if (res.status !== "resolved") {
    // not-qualified → struct-field typing is a future surface (silent poison);
    // poisoned → the diagnostic is already out.
    return ERROR_TYPE;
  }

  const sym = res.symbol;
  if (sym.kind === "variable" || sym.kind === "constant") {
    ctx.symbolMap.set(expr, sym);
    return sym.type;
  }

  // function / interrupt (and, defensively, any other kind) in value position.
  ctx.bag.addError(
    IceCode.Unexpected,
    expr.span,
    `Qualified access to '${expr.field}' names a function — function references ` +
      `are not supported yet; call it instead`,
  );
  return ERROR_TYPE;
}

/** A resolved callee: its symbol plus the name/span used in diagnostics. */
interface ResolvedCallee {
  readonly sym: Symbol;
  readonly name: string;
  readonly span: SourceSpan;
}

/**
 * Resolves a call's callee to a declared symbol, for either supported shape:
 * a bare `IdentExpr` (lexical lookup; an unresolved non-registry name is
 * E10100) or a qualified `Module.member` (via `resolveQualified`, which owns
 * E10100/E10012 for that shape). Returns `null` when the call must poison —
 * the diagnostic, if any, has already been emitted (a `null` with no
 * diagnostic is the deliberate silent contract for unsupported callee shapes
 * and registry-owned platform intrinsics).
 */
function resolveCallee(
  callee: ExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): ResolvedCallee | null {
  if (callee.kind === "IdentExpr") {
    const sym = resolveName(callee.name, scope);
    if (sym === null) {
      // A platform-contributed intrinsic parses as a plain call and is never a
      // scope symbol — availability/import/arity checks belong to the platform
      // import boundary, so it is not an undeclared identifier here. A declared
      // name always wins over a registry name (checked above via the scopes).
      if (ctx.registry?.get(callee.name)?.platformId !== undefined) return null;
      ctx.bag.addError(
        DiagCode.UndeclaredIdentifier,
        callee.span,
        `Undeclared identifier '${callee.name}'`,
      );
      return null;
    }
    return { sym, name: callee.name, span: callee.span };
  }

  if (callee.kind === "FieldAccessExpr") {
    const res = resolveQualified(callee, scope, ctx.moduleScopes, ctx.bag);
    // not-qualified keeps the silent struct-field contract; poisoned is
    // already diagnosed — either way the call poisons.
    if (res.status !== "resolved") return null;
    return { sym: res.symbol, name: callee.field, span: callee.fieldSpan };
  }

  // Other callee shapes (index/call results, literals) are not callable
  // surfaces yet; poison silently.
  return null;
}

/**
 * User-function call typing.
 *
 * The callee resolves via {@link resolveCallee} (bare identifier or qualified
 * `Module.member` — both shapes feed ONE shared ladder below): an `interrupt`
 * → E10051 (interrupt bodies end in RTI — a user JSR would corrupt the
 * stack); the entry point → E10023; any non-function symbol → E10175. A
 * resolved callee records a call-graph edge from the enclosing function, then
 * checks arguments: a count mismatch is E10170 (arguments are still typed for
 * map coverage, but per-argument type checks are suppressed — one diagnostic
 * per root cause); otherwise every argument is typed in its parameter's
 * context, range-checked as a constant, and must be strictly assignable
 * (E10171). The call's type is the callee's declared return type; a poisoned
 * argument suppresses its own mismatch check.
 */
function typeCall(expr: CallExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  const resolved = resolveCallee(expr.callee, scope, ctx);
  if (resolved === null) return walkArgsAndPoison(expr, scope, ctx);
  const { sym, name, span } = resolved;

  if (sym.kind === "interrupt") {
    ctx.bag.addError(
      DiagCode.CallToInterruptFunction,
      span,
      `Cannot call interrupt function '${name}' — interrupt handlers are ` +
        `invoked by hardware, not by user code`,
    );
    return walkArgsAndPoison(expr, scope, ctx);
  }
  if (sym === ctx.mainFunction) {
    ctx.bag.addError(
      DiagCode.CallingMainDirectly,
      span,
      `Cannot call 'main()' directly — it is the program entry point, not a ` +
        `callable function`,
    );
    return walkArgsAndPoison(expr, scope, ctx);
  }
  if (sym.kind !== "function") {
    ctx.bag.addError(
      DiagCode.NotCallable,
      span,
      `'${name}' is not a function — cannot call a '${typeName(sym.type)}' ` +
        `value as a function`,
    );
    return walkArgsAndPoison(expr, scope, ctx);
  }

  // Resolved user function: record the reference and the call-graph edge.
  ctx.symbolMap.set(expr.callee, sym);
  recordCallEdge(scope, sym, span, ctx);

  const sig = signatureOf(sym, ctx);

  if (expr.args.length !== sig.params.length) {
    ctx.bag.addError(
      DiagCode.WrongArgCount,
      expr.span,
      `Wrong argument count — '${name}()' expects ${sig.params.length} ` +
        `parameter(s), got ${expr.args.length}`,
    );
    // Arguments are still typed (map coverage), but per-argument checks are
    // suppressed: the count failure is the root cause.
    for (const arg of expr.args) typeOfExpr(arg, scope, ctx);
    return sig.returnType;
  }

  for (let i = 0; i < expr.args.length; i++) {
    const arg = expr.args[i];
    const param = sig.params[i];
    const argType = typeOfExpr(arg, scope, ctx, param.type);
    checkConstRange(arg, param.type, ctx);
    if (!isAssignableTo(argType, param.type)) {
      ctx.bag.addError(
        DiagCode.ArgTypeMismatch,
        arg.span,
        `Argument type mismatch — parameter '${param.name}' of '${name}()' ` +
          `expects '${typeName(param.type)}', found '${typeName(argType)}'`,
      );
    }
    checkIntermediateOverflow(arg, argType, param.type, ctx);
  }

  return sig.returnType;
}

/** Types every argument (map coverage) and poisons a failed call. */
function walkArgsAndPoison(expr: CallExprNode, scope: Scope, ctx: TypeCheckContext): Type {
  for (const arg of expr.args) typeOfExpr(arg, scope, ctx);
  return ERROR_TYPE;
}

/** Narrows a symbol's declaring node to a {@link FunctionDeclNode}. */
function isFunctionDecl(node: AstNode): node is FunctionDeclNode {
  return node.kind === "FunctionDecl";
}

/**
 * The callee's cached {@link FnSignature}, computed from its declaration on
 * first use. Function symbols always carry a `FunctionDecl`; a defensive
 * mismatch yields an empty void signature rather than a crash.
 */
function signatureOf(sym: Symbol, ctx: TypeCheckContext): FnSignature {
  const cached = ctx.signatures.get(sym);
  if (cached !== undefined) return cached;

  const decl = isFunctionDecl(sym.decl) ? sym.decl : null;
  const sig: FnSignature =
    decl === null
      ? { params: [], returnType: primitive("void") }
      : {
          params: decl.params.map((p) => ({
            name: p.name,
            type: resolveTypeNode(p.paramType),
          })),
          returnType: resolveTypeNode(decl.returnType),
        };
  ctx.signatures.set(sym, sig);
  return sig;
}

/**
 * Records the call-graph edge from the enclosing function to `callee`, plus
 * the first call-site span per edge (anchoring the recursion diagnostic).
 * Module-level contexts (no enclosing function) record nothing.
 */
function recordCallEdge(
  scope: Scope,
  callee: Symbol,
  span: SourceSpan,
  ctx: TypeCheckContext,
): void {
  const caller = enclosingFunctionSymbol(scope);
  if (caller === null) return;

  let callees = ctx.callEdges.get(caller);
  if (callees === undefined) {
    callees = new Set();
    ctx.callEdges.set(caller, callees);
  }
  callees.add(callee);

  let spans = ctx.callSiteSpans.get(caller);
  if (spans === undefined) {
    spans = new Map();
    ctx.callSiteSpans.set(caller, spans);
  }
  if (!spans.has(callee)) spans.set(callee, span);
}

/**
 * Intrinsic-call typing: `peek`→byte, `peekw`→word, `lo`/`hi`→byte,
 * `poke`/`pokew`→void. Arguments are always walked (to populate `typeMap` for
 * width-aware lowering); a `lo`/`hi` argument types in a `word` context (the
 * signature is `lo(value: word): byte` — narrower integers widen implicitly,
 * `sword` reinterprets at the same width, and a boolean argument is the
 * standard argument-mismatch error). Unknown intrinsics poison without a
 * diagnostic (the intrinsic-validation pass owns their errors); arity errors
 * are that pass's job too.
 */
function typeIntrinsicCall(
  expr: IntrinsicCallExprNode,
  scope: Scope,
  ctx: TypeCheckContext,
): Type {
  if (expr.name === "lo" || expr.name === "hi") {
    for (const arg of expr.args) {
      const argType = typeOfExpr(arg, scope, ctx, primitive("word"));
      if (!isError(argType) && !isInteger(argType)) {
        ctx.bag.addError(
          DiagCode.ArgTypeMismatch, // E10171
          arg.span,
          `Argument type mismatch — parameter 'value' of '${expr.name}()' ` +
            `expects 'word', found '${typeName(argType)}'`,
        );
      }
    }
    return primitive("byte");
  }

  // Query intrinsics fold to compile-time constants; the result is typed by
  // representability — a value ≤255 fits `byte`, anything larger is `word`
  // (`length(byte[256])` is 256, which `byte` cannot hold).
  if (expr.name === "sizeof" || expr.name === "offsetof" || expr.name === "length") {
    for (const arg of expr.args) typeOfExpr(arg, scope, ctx);
    const folded = ctx.engine?.evalExpr(expr, scope);
    if (folded?.kind === "value" && typeof folded.value === "number") {
      return primitive(folded.value <= 255 ? "byte" : "word");
    }
    return ERROR_TYPE; // validation/engine already reported the root cause
  }

  for (const arg of expr.args) typeOfExpr(arg, scope, ctx);

  switch (expr.name) {
    case "peek":
      return primitive("byte");
    case "peekw":
      return primitive("word");
    case "poke":
    case "pokew":
      return primitive("void");
    default:
      return ERROR_TYPE; // embed/etc. — not yet supported here
  }
}

/**
 * Emits the assignment-compatibility diagnostic when `valueType` is not
 * assignable to `targetType`. Same-type, same-sign widening, and poison pass
 * silently; narrowing is E10154, cross-sign E10153, and boolean↔integer (or
 * any other mismatch) E10152 — always with the explicit-cast remedy implied
 * by the message.
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

/**
 * The return-statement variant of {@link checkAssignable}: same code family
 * (E10152/E10153/E10154), return-context wording naming the function.
 *
 * @param valueType The type of the returned value.
 * @param returnType The function's declared return type.
 * @param fnName The enclosing function's name (for the message).
 * @param span The span to anchor the diagnostic to.
 * @param ctx The Pass-3 context.
 */
export function checkReturnAssignable(
  valueType: Type,
  returnType: Type,
  fnName: string,
  span: SourceSpan,
  ctx: TypeCheckContext,
): void {
  if (isAssignableTo(valueType, returnType)) return; // same-type or poison → ok

  ctx.bag.addError(
    assignmentMismatchCode(valueType, returnType),
    span,
    `Cannot return a value of type '${typeName(valueType)}' — the return type ` +
      `of '${fnName}' is '${typeName(returnType)}'`,
  );
}

/**
 * Intermediate-overflow advisories (W10160/W10161), called after an
 * assignability check at the four value-consuming sites (initialiser,
 * assignment, argument, return).
 *
 * An expression's type comes from its operands, not the destination — so
 * 8-bit `+ - *` arithmetic feeding a 16-bit target evaluates (and possibly
 * wraps) at 8 bits BEFORE widening. When the expression const-folds, a value
 * that provably wraps warns W10161 (with the wrapped value) and a provably
 * in-range value stays silent; a non-constant expression warns W10160 with
 * the cast-the-operands-first fix. Only same-sign narrow→wide flows qualify
 * (anything else already failed assignability). Bitwise/comparison results
 * never grow past their operands, so only `+ - *` are watched.
 *
 * @param valueExpr The value expression being consumed.
 * @param valueType The expression's (operand-derived) type.
 * @param targetType The declared/target type it flows into.
 * @param ctx The Pass-3 context.
 */
export function checkIntermediateOverflow(
  valueExpr: ExprNode,
  valueType: Type,
  targetType: Type,
  ctx: TypeCheckContext,
): void {
  if (valueExpr.kind !== "BinaryExpr") return;
  if (!INTERMEDIATE_OVERFLOW_OPS.has(valueExpr.op)) return;
  if (valueType.kind !== "primitive" || !isInteger(valueType)) return;
  if (targetType.kind !== "primitive" || !isInteger(targetType)) return;
  if (bitWidth(valueType) !== 8 || bitWidth(targetType) !== 16) return;
  if (isSigned(valueType) !== isSigned(targetType)) return; // cross-sign already errored

  const folded = evalConst(valueExpr, undefined, (e) => ctx.typeMap.get(e));
  if (folded.kind === "value" && typeof folded.value === "number") {
    const range = integerRange(valueType);
    if (range === null) return;
    if (folded.value >= range.min && folded.value <= range.max) return; // provably safe
    const wrapped = fromBits(toBits(folded.value, 8), 8, isSigned(valueType));
    ctx.bag.addWarning(
      DiagCode.ConstOverflowBeforeWidening, // W10161
      valueExpr.span,
      `Constant expression overflow — wraps to ${wrapped} ` +
        `at '${typeName(valueType)}' width before widening`,
    );
    return;
  }
  if (folded.kind !== "nonConst") return; // divByZero/poisonedRef — other checks own it

  const wide = typeName(targetType);
  ctx.bag.addWarning(
    DiagCode.IntermediateOverflow, // W10160
    valueExpr.span,
    `'${typeName(valueType)}' arithmetic may overflow before widening to '${wide}' ` +
      `— use <${wide}>(a) ${valueExpr.op} <${wide}>(b)`,
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
    return DiagCode.WidthNarrowingNoCast; // E10154 (same-sign widening never reaches here)
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
 * @param resolveRef Optional reference resolver, so a value computed from
 *   evaluated constants is range-checked too (the module-const phase uses it).
 * @returns `false` when a diagnostic was emitted; `true` when the value is in
 *   range or the check does not apply.
 */
export function checkConstRange(
  expr: ExprNode,
  targetType: Type,
  ctx: TypeCheckContext,
  resolveRef?: ConstRefResolver,
): boolean {
  const folded = evalConst(expr, resolveRef, (e) => ctx.typeMap.get(e));
  if (folded.kind === "divByZero") {
    ctx.bag.addError(
      DiagCode.ConstDivisionByZero, // E10082
      folded.span,
      "Division by zero in constant expression",
    );
    return false;
  }
  if (folded.kind !== "value" || typeof folded.value !== "number") return true;
  if (isError(targetType)) return true;
  const range = integerRange(targetType);
  if (range === null) return true; // boolean/void/non-integer target — no range check
  if (folded.value < range.min || folded.value > range.max) {
    ctx.bag.addError(
      DiagCode.ValueOutOfRange, // E10084
      expr.span,
      `Value ${folded.value} out of range for type '${typeName(targetType)}' ` +
        `(range: ${range.min} to ${range.max})`,
    );
    return false;
  }
  return true;
}
