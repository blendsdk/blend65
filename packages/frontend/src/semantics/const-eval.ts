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
 * Name references (a bare identifier or a qualified `Module.member`) fold only
 * when the caller supplies a {@link ConstRefResolver} — the module-const phase
 * closes one over its resolved symbols and evaluated values, so `const B = A +
 * 1;` folds regardless of declaration order. Without a resolver every
 * reference is `nonConst` (the original behavior).
 *
 * The evaluator is **pure and never throws**: it reports a division by zero as a
 * structured result (the caller emits E10082) instead of dividing in JS. Full
 * const evaluation (enum members, `sizeof`/`offsetof`, arrays) arrives later;
 * this module stays deliberately small.
 */

import type { ExprNode, FieldAccessExprNode, IdentExprNode, SourceSpan } from "@blend65/core";

/** The outcome of {@link evalConst}. */
export type ConstEvalResult =
  | { readonly kind: "value"; readonly value: number | boolean }
  | { readonly kind: "divByZero"; readonly span: SourceSpan }
  | { readonly kind: "nonConst" }
  /** A reference whose failure is already diagnosed — the caller stays silent. */
  | { readonly kind: "poisonedRef" };

/** How a name reference resolves during const evaluation. */
export type ConstRefResolution =
  /** A known compile-time value — folds into the evaluation. */
  | { readonly kind: "value"; readonly value: number | boolean }
  /** A runtime entity (variable, parameter, …) — not a constant expression. */
  | { readonly kind: "nonconst" }
  /** Unresolved or already-failed — its diagnostic is already emitted. */
  | { readonly kind: "poisoned" };

/** Resolves a reference expression to a value during const evaluation. */
export type ConstRefResolver = (
  expr: IdentExprNode | FieldAccessExprNode,
) => ConstRefResolution;

/** A `value` result carrying a number (narrowed from the union). */
function numberResult(value: number): ConstEvalResult {
  return { kind: "value", value };
}

/**
 * Evaluates `expr` as a compile-time constant. Never throws.
 *
 * @param expr The expression to fold.
 * @param resolveRef Optional reference resolver — lets name references
 *   (identifiers, `Module.member`) fold to known constant values.
 * @returns A `value` result, a `divByZero` result (caller emits E10082), a
 *   `poisonedRef` result (a referenced name already failed — stay silent), or
 *   `nonConst` when the expression is not a supported constant.
 */
export function evalConst(expr: ExprNode, resolveRef?: ConstRefResolver): ConstEvalResult {
  switch (expr.kind) {
    case "NumericLitExpr":
      return numberResult(expr.value);
    case "BoolLitExpr":
      return { kind: "value", value: expr.value };
    case "UnaryExpr":
      return evalUnary(expr.op, expr.operand, resolveRef);
    case "BinaryExpr":
      return evalBinary(expr.op, expr.left, expr.right, expr.span, resolveRef);
    case "IntrinsicCallExpr":
      return evalIntrinsic(expr.name, expr.args, resolveRef);
    case "IdentExpr":
    case "FieldAccessExpr": {
      if (resolveRef === undefined) return { kind: "nonConst" };
      const resolution = resolveRef(expr);
      if (resolution.kind === "value") return { kind: "value", value: resolution.value };
      return resolution.kind === "poisoned" ? { kind: "poisonedRef" } : { kind: "nonConst" };
    }
    default:
      return { kind: "nonConst" };
  }
}

/** Propagates a failed sub-result: divByZero/poisonedRef pass through; else nonConst. */
function propagateFailure(r: ConstEvalResult): ConstEvalResult {
  return r.kind === "divByZero" || r.kind === "poisonedRef" ? r : { kind: "nonConst" };
}

/** Folds a unary `+`/`-` over a constant numeric operand; else `nonConst`. */
function evalUnary(
  op: string,
  operand: ExprNode,
  resolveRef?: ConstRefResolver,
): ConstEvalResult {
  if (op !== "-" && op !== "+") return { kind: "nonConst" };
  const inner = evalConst(operand, resolveRef);
  if (inner.kind !== "value" || typeof inner.value !== "number") {
    return propagateFailure(inner);
  }
  return numberResult(op === "-" ? -inner.value : inner.value);
}

/** Folds the five integer arithmetic operators over two constant operands. */
function evalBinary(
  op: string,
  left: ExprNode,
  right: ExprNode,
  span: SourceSpan,
  resolveRef?: ConstRefResolver,
): ConstEvalResult {
  const l = evalConst(left, resolveRef);
  if (l.kind !== "value") return propagateFailure(l);
  const r = evalConst(right, resolveRef);
  if (r.kind !== "value") return propagateFailure(r);
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
function evalIntrinsic(
  name: string,
  args: readonly ExprNode[],
  resolveRef?: ConstRefResolver,
): ConstEvalResult {
  if ((name !== "lo" && name !== "hi") || args.length !== 1) return { kind: "nonConst" };
  const arg = evalConst(args[0], resolveRef);
  if (arg.kind !== "value" || typeof arg.value !== "number") {
    return propagateFailure(arg);
  }
  const v = arg.value & 0xffff;
  return numberResult(name === "lo" ? v & 0xff : (v >> 8) & 0xff);
}
