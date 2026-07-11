/**
 * The compile-time constant evaluator.
 *
 * Folds numeric/boolean literals, unary `+ - ! ~`, the arithmetic /
 * bitwise / shift / comparison / logical binary operators, casts, the
 * conditional operator, `lo`/`hi` on constants, and (with a resolver) name
 * references. Callers use it to range-check constant initialisers (E10084),
 * catch constant division by zero (E10082), evaluate module consts, and
 * detect the provably-wrapping/truncating shapes behind W10161/W10101.
 * Anything unfoldable yields `nonConst` — the caller then treats the value as
 * runtime, which is always sound.
 *
 * Arithmetic folds at full JS-number precision (a const declaration is
 * range-checked on the FINAL value, so `256 / 2` is a fine byte). The
 * width/signedness-sensitive operators — `~`, shifts, casts, and bitwise ops
 * over negative operands — fold with two's-complement semantics at the
 * operand's width, because that IS their runtime meaning; they need type
 * information, supplied by the optional {@link ConstTypeLookup} (callers with
 * a populated type map pass `(e) => typeMap.get(e)`). Width-sensitive folds
 * without type information yield `nonConst`.
 *
 * Name references (a bare identifier or a qualified `Module.member`) fold only
 * when the caller supplies a {@link ConstRefResolver} — the module-const phase
 * closes one over its resolved symbols and evaluated values, so `const B = A +
 * 1;` folds regardless of declaration order. Without a resolver every
 * reference is `nonConst` (the original behavior).
 *
 * `&&`/`||` and the conditional operator fold lazily — the unevaluated
 * operand/arm is never folded, matching the runtime short-circuit and
 * selected-arm-only guarantees (a division by zero there does NOT surface).
 *
 * The evaluator is **pure and never throws**: it reports a division by zero as a
 * structured result (the caller emits E10082) instead of dividing in JS. Full
 * const evaluation (enum members, `sizeof`/`offsetof`, arrays) arrives later.
 */

import { bitWidth, isInteger, isSigned } from "@blend65/core";
import type {
  ExprNode,
  FieldAccessExprNode,
  IdentExprNode,
  SourceSpan,
  Type,
  TypeNode,
} from "@blend65/core";

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

/**
 * Looks up an expression's resolved semantic type, so width/signedness-
 * sensitive folds (`~`, shifts, negative-operand bitwise) can engage.
 * Returning `undefined` (or a non-integer) makes those folds `nonConst`.
 */
export type ConstTypeLookup = (expr: ExprNode) => Type | undefined;

/** A `value` result carrying a number (narrowed from the union). */
function numberResult(value: number): ConstEvalResult {
  return { kind: "value", value };
}

/**
 * Masks `value` to `width` bits (the raw two's-complement bit pattern,
 * always non-negative).
 *
 * @param value Any integer (full JS-number precision).
 * @param width The type's bit width.
 * @returns The low `width` bits of the two's-complement representation.
 */
export function toBits(value: number, width: 8 | 16): number {
  const modulus = width === 8 ? 0x100 : 0x10000;
  return ((value % modulus) + modulus) % modulus;
}

/**
 * Reinterprets a `width`-bit pattern as a signed or unsigned value.
 *
 * @param bits A bit pattern in `[0, 2^width)`.
 * @param width The type's bit width.
 * @param signed Whether the high bit is a sign bit.
 * @returns The numeric value the pattern denotes.
 */
export function fromBits(bits: number, width: 8 | 16, signed: boolean): number {
  const half = width === 8 ? 0x80 : 0x8000;
  const modulus = width === 8 ? 0x100 : 0x10000;
  return signed && bits >= half ? bits - modulus : bits;
}

/** The width/signedness of an integer type, or `null` for anything else. */
function integerShape(t: Type | undefined): { width: 8 | 16; signed: boolean } | null {
  if (t === undefined || t.kind !== "primitive" || !isInteger(t)) return null;
  return { width: bitWidth(t), signed: isSigned(t) };
}

/** The width/signedness a cast's primitive target type denotes, or `null`. */
function castTargetShape(node: TypeNode): { width: 8 | 16; signed: boolean } | null {
  if (node.kind !== "PrimitiveType") return null; // named/array targets don't fold
  switch (node.name) {
    case "byte":
      return { width: 8, signed: false };
    case "sbyte":
      return { width: 8, signed: true };
    case "word":
      return { width: 16, signed: false };
    case "sword":
      return { width: 16, signed: true };
    default:
      return null; // boolean/void — the cast is an error anyway
  }
}

/**
 * Evaluates `expr` as a compile-time constant. Never throws.
 *
 * @param expr The expression to fold.
 * @param resolveRef Optional reference resolver — lets name references
 *   (identifiers, `Module.member`) fold to known constant values.
 * @param typeOf Optional type lookup — lets the width/signedness-sensitive
 *   folds (`~`, shifts, negative-operand bitwise) engage.
 * @returns A `value` result, a `divByZero` result (caller emits E10082), a
 *   `poisonedRef` result (a referenced name already failed — stay silent), or
 *   `nonConst` when the expression is not a supported constant.
 */
export function evalConst(
  expr: ExprNode,
  resolveRef?: ConstRefResolver,
  typeOf?: ConstTypeLookup,
): ConstEvalResult {
  switch (expr.kind) {
    case "NumericLitExpr":
      return numberResult(expr.value);
    case "BoolLitExpr":
      return { kind: "value", value: expr.value };
    case "UnaryExpr":
      return evalUnary(expr.op, expr.operand, resolveRef, typeOf);
    case "BinaryExpr":
      return evalBinary(expr, resolveRef, typeOf);
    case "CastExpr":
      return evalCast(expr.targetType, expr.operand, resolveRef, typeOf);
    case "ConditionalExpr": {
      const cond = evalConst(expr.condition, resolveRef, typeOf);
      if (cond.kind !== "value" || typeof cond.value !== "boolean") {
        return propagateFailure(cond);
      }
      // Only the selected arm is evaluated — matching the runtime guarantee.
      return evalConst(cond.value ? expr.whenTrue : expr.whenFalse, resolveRef, typeOf);
    }
    case "IntrinsicCallExpr":
      return evalIntrinsic(expr.name, expr.args, resolveRef, typeOf);
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

/** Folds a unary `+ - ! ~` over a constant operand; else `nonConst`. */
function evalUnary(
  op: string,
  operand: ExprNode,
  resolveRef?: ConstRefResolver,
  typeOf?: ConstTypeLookup,
): ConstEvalResult {
  const inner = evalConst(operand, resolveRef, typeOf);

  if (op === "!") {
    if (inner.kind !== "value" || typeof inner.value !== "boolean") {
      return propagateFailure(inner);
    }
    return { kind: "value", value: !inner.value };
  }

  if (inner.kind !== "value" || typeof inner.value !== "number") {
    return propagateFailure(inner);
  }
  switch (op) {
    case "-":
      return numberResult(-inner.value);
    case "+":
      return numberResult(inner.value);
    case "~": {
      // Width-sensitive: the complement happens at the operand's own width.
      const shape = integerShape(typeOf?.(operand));
      if (shape === null) return { kind: "nonConst" };
      const mask = shape.width === 8 ? 0xff : 0xffff;
      return numberResult(fromBits(~toBits(inner.value, shape.width) & mask, shape.width, shape.signed));
    }
    default:
      return { kind: "nonConst" };
  }
}

/** The binary-fold entry: dispatches to the operator-class folds. */
function evalBinary(
  expr: Extract<ExprNode, { kind: "BinaryExpr" }>,
  resolveRef?: ConstRefResolver,
  typeOf?: ConstTypeLookup,
): ConstEvalResult {
  const { op, left, right, span } = expr;

  // Logical operators fold lazily: the right operand is only evaluated when
  // the left does not short-circuit — a divByZero in the unevaluated operand
  // must NOT surface (it would not surface at runtime either).
  if (op === "&&" || op === "||") {
    const l = evalConst(left, resolveRef, typeOf);
    if (l.kind !== "value" || typeof l.value !== "boolean") return propagateFailure(l);
    if (op === "&&" && !l.value) return { kind: "value", value: false };
    if (op === "||" && l.value) return { kind: "value", value: true };
    const r = evalConst(right, resolveRef, typeOf);
    if (r.kind !== "value" || typeof r.value !== "boolean") return propagateFailure(r);
    return { kind: "value", value: r.value };
  }

  const l = evalConst(left, resolveRef, typeOf);
  if (l.kind !== "value") return propagateFailure(l);
  const r = evalConst(right, resolveRef, typeOf);
  if (r.kind !== "value") return propagateFailure(r);

  // Equality folds over matching primitive kinds (numbers or booleans).
  if (op === "==" || op === "!=") {
    if (typeof l.value !== typeof r.value) return { kind: "nonConst" };
    return { kind: "value", value: op === "==" ? l.value === r.value : l.value !== r.value };
  }

  if (typeof l.value !== "number" || typeof r.value !== "number") return { kind: "nonConst" };

  switch (op) {
    // Arithmetic folds at full precision — const declarations range-check the
    // FINAL value, and the wrap detection behind W10161 compares this full-
    // precision result against the value type's width.
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
    case "<":
      return { kind: "value", value: l.value < r.value };
    case "<=":
      return { kind: "value", value: l.value <= r.value };
    case ">":
      return { kind: "value", value: l.value > r.value };
    case ">=":
      return { kind: "value", value: l.value >= r.value };
    case "&":
    case "|":
    case "^":
      return evalBitwise(op, l.value, r.value, typeOf?.(left));
    case "<<":
    case ">>":
      return evalShift(op, l.value, r.value, typeOf?.(left));
    default:
      return { kind: "nonConst" };
  }
}

/**
 * Folds `& | ^`. Non-negative operands fold directly (the bit pattern equals
 * the value); a negative operand needs the operand type's width to take its
 * two's-complement pattern first, and the result reinterprets at that shape.
 */
function evalBitwise(
  op: "&" | "|" | "^",
  l: number,
  r: number,
  operandType: Type | undefined,
): ConstEvalResult {
  const shape = integerShape(operandType);
  if (shape === null) {
    if (l < 0 || r < 0) return { kind: "nonConst" }; // needs a width to wrap at
    const direct = op === "&" ? l & r : op === "|" ? l | r : l ^ r;
    return numberResult(direct);
  }
  const lb = toBits(l, shape.width);
  const rb = toBits(r, shape.width);
  const bits = op === "&" ? lb & rb : op === "|" ? lb | rb : lb ^ rb;
  return numberResult(fromBits(bits, shape.width, shape.signed));
}

/**
 * Folds `<<`/`>>` at the LEFT operand type's width. Left shift wraps at the
 * width; right shift is logical for unsigned and arithmetic (sign-preserving,
 * floor division by 2^n) for signed. Width-sensitive: without the left
 * operand's type the fold is `nonConst`. A negative amount never reaches here
 * (a signed amount is a typing error).
 */
function evalShift(
  op: "<<" | ">>",
  value: number,
  amount: number,
  leftType: Type | undefined,
): ConstEvalResult {
  const shape = integerShape(leftType);
  if (shape === null || amount < 0) return { kind: "nonConst" };
  const mask = shape.width === 8 ? 0xff : 0xffff;

  if (op === "<<") {
    if (amount >= shape.width) return numberResult(0);
    const bits = (toBits(value, shape.width) << amount) & mask;
    return numberResult(fromBits(bits, shape.width, shape.signed));
  }
  if (shape.signed) {
    // Arithmetic shift: floor division preserves the sign (and saturates to
    // -1/0 for amounts at or beyond the width, matching repeated hardware
    // sign-propagating shifts).
    return numberResult(Math.floor(value / 2 ** Math.min(amount, 31)));
  }
  if (amount >= shape.width) return numberResult(0);
  return numberResult(toBits(value, shape.width) >> amount);
}

/**
 * Folds `<target>(operand)`: takes the operand's two's-complement pattern at
 * the target's width and reinterprets it under the target's signedness. Only
 * primitive integer targets fold; the operand folds at full precision first
 * (its own width semantics are already inside its sub-folds).
 */
function evalCast(
  targetType: TypeNode,
  operand: ExprNode,
  resolveRef?: ConstRefResolver,
  typeOf?: ConstTypeLookup,
): ConstEvalResult {
  const target = castTargetShape(targetType);
  if (target === null) return { kind: "nonConst" };
  const inner = evalConst(operand, resolveRef, typeOf);
  if (inner.kind !== "value" || typeof inner.value !== "number") {
    return propagateFailure(inner);
  }
  return numberResult(fromBits(toBits(inner.value, target.width), target.width, target.signed));
}

/** Folds `lo`/`hi` over a single constant numeric argument; else `nonConst`. */
function evalIntrinsic(
  name: string,
  args: readonly ExprNode[],
  resolveRef?: ConstRefResolver,
  typeOf?: ConstTypeLookup,
): ConstEvalResult {
  if ((name !== "lo" && name !== "hi") || args.length !== 1) return { kind: "nonConst" };
  const arg = evalConst(args[0], resolveRef, typeOf);
  if (arg.kind !== "value" || typeof arg.value !== "number") {
    return propagateFailure(arg);
  }
  const v = arg.value & 0xffff;
  return numberResult(name === "lo" ? v & 0xff : (v >> 8) & 0xff);
}
