/**
 * The minimal compile-time constant evaluator.
 *
 * Just enough const evaluation to (1) range-check a constant initialiser
 * against its declared type (feeding E10084) and (2) catch a constant
 * division / remainder by zero (feeding E10082) rather than letting it
 * become a JS `NaN`/`Infinity`. It folds numeric/boolean literals, unary `+`/`-`,
 * the five integer arithmetic operators on constant operands, and `lo`/`hi` on a
 * constant. Anything else (identifiers, calls, casts, non-constant subtrees)
 * yields `nonConst` — the caller then skips the compile-time range check.
 *
 * The evaluator is **pure and never throws**: it reports a division by zero as a
 * structured result (the caller emits E10082) instead of dividing in JS. Full
 * const evaluation (enum members, `sizeof`/`offsetof`, arrays) arrives later;
 * this module stays deliberately small.
 */

import type { ExprNode, SourceSpan } from "@blend65/core";

/** The outcome of {@link evalConst}. */
export type ConstEvalResult =
  | { readonly kind: "value"; readonly value: number | boolean }
  | { readonly kind: "divByZero"; readonly span: SourceSpan }
  | { readonly kind: "nonConst" };

/** A `value` result carrying a number (narrowed from the union). */
function numberResult(value: number): ConstEvalResult {
  return { kind: "value", value };
}

/**
 * Evaluates `expr` as a compile-time constant. Never throws.
 *
 * @param expr The expression to fold.
 * @returns A `value` result, a `divByZero` result (caller emits E10082), or
 *   `nonConst` when the expression is not a supported constant.
 */
export function evalConst(expr: ExprNode): ConstEvalResult {
  switch (expr.kind) {
    case "NumericLitExpr":
      return numberResult(expr.value);
    case "BoolLitExpr":
      return { kind: "value", value: expr.value };
    case "UnaryExpr":
      return evalUnary(expr.op, expr.operand);
    case "BinaryExpr":
      return evalBinary(expr.op, expr.left, expr.right, expr.span);
    case "IntrinsicCallExpr":
      return evalIntrinsic(expr.name, expr.args);
    default:
      return { kind: "nonConst" };
  }
}

/** Folds a unary `+`/`-` over a constant numeric operand; else `nonConst`. */
function evalUnary(op: string, operand: ExprNode): ConstEvalResult {
  if (op !== "-" && op !== "+") return { kind: "nonConst" };
  const inner = evalConst(operand);
  if (inner.kind !== "value" || typeof inner.value !== "number") {
    return inner.kind === "divByZero" ? inner : { kind: "nonConst" };
  }
  return numberResult(op === "-" ? -inner.value : inner.value);
}

/** Folds the five integer arithmetic operators over two constant operands. */
function evalBinary(
  op: string,
  left: ExprNode,
  right: ExprNode,
  span: SourceSpan,
): ConstEvalResult {
  const l = evalConst(left);
  if (l.kind !== "value") return l.kind === "divByZero" ? l : { kind: "nonConst" };
  const r = evalConst(right);
  if (r.kind !== "value") return r.kind === "divByZero" ? r : { kind: "nonConst" };
  if (typeof l.value !== "number" || typeof r.value !== "number") return { kind: "nonConst" };

  switch (op) {
    case "+":
      return numberResult(l.value + r.value);
    case "-":
      return numberResult(l.value - r.value);
    case "*":
      return numberResult(l.value * r.value);
    case "/":
      if (r.value === 0) return { kind: "divByZero", span };
      return numberResult(Math.trunc(l.value / r.value));
    case "%":
      if (r.value === 0) return { kind: "divByZero", span };
      return numberResult(l.value % r.value);
    default:
      return { kind: "nonConst" }; // bitwise/shift/comparison — not folded yet
  }
}

/** Folds `lo`/`hi` over a single constant numeric argument; else `nonConst`. */
function evalIntrinsic(name: string, args: readonly ExprNode[]): ConstEvalResult {
  if ((name !== "lo" && name !== "hi") || args.length !== 1) return { kind: "nonConst" };
  const arg = evalConst(args[0]);
  if (arg.kind !== "value" || typeof arg.value !== "number") {
    return arg.kind === "divByZero" ? arg : { kind: "nonConst" };
  }
  const v = arg.value & 0xffff;
  return numberResult(name === "lo" ? v & 0xff : (v >> 8) & 0xff);
}
