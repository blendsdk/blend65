/**
 * Aggregate constant IMAGE evaluation.
 *
 * A `const` array/struct is baked into the binary as a data image: every
 * element (and the fill value) must fold to a compile-time constant, the
 * image must cover the whole declared size, and multi-byte elements encode
 * little-endian. This module folds a const aggregate's initialiser into its
 * `Uint8Array` image through the const/type engine:
 *
 * - a non-constant element/field → E10193 (silent when the failure is
 *   already reported elsewhere — one root cause);
 * - fewer elements than the declared size without a fill → E10113;
 * - more elements than the declared size → the assignment-family mismatch;
 * - an element value outside its element type's range → E10084;
 * - struct literals contribute fields at their layout offsets (field-order
 *   enforcement is expression typing's job — images are order-agnostic).
 *
 * This module lives in `@blend65/frontend` and imports `@blend65/core` only.
 */

import { byteSize, DiagCode } from "@blend65/core";
import type { DiagnosticBag, ExprNode, Scope, Type } from "@blend65/core";
import { toBits } from "./const-eval.js";
import { integerRange } from "./type-check/type-resolution.js";
import type { ConstTypeEngine } from "./const-type-engine.js";

/** Everything image evaluation needs. */
export interface ImageContext {
  readonly engine: ConstTypeEngine;
  readonly scope: Scope;
  readonly bag: DiagnosticBag;
  /** The const's name (diagnostic wording). */
  readonly constName: string;
}

/**
 * Folds `init` into the memory image of an aggregate of type `type`.
 * Returns `null` after emitting (or deferring to) the root-cause diagnostic.
 */
export function buildConstImage(
  type: Type,
  init: ExprNode,
  ctx: ImageContext,
): Uint8Array | null {
  const bytes = new Uint8Array(byteSize(type));
  return writeValue(type, init, bytes, 0, ctx) ? bytes : null;
}

/** Writes one value (scalar, array literal, struct literal) at `offset`. */
function writeValue(
  type: Type,
  expr: ExprNode,
  bytes: Uint8Array,
  offset: number,
  ctx: ImageContext,
): boolean {
  switch (type.kind) {
    case "array":
      return writeArray(type, expr, bytes, offset, ctx);
    case "struct":
      return writeStruct(type, expr, bytes, offset, ctx);
    default:
      return writeScalar(type, expr, bytes, offset, ctx);
  }
}

/** Writes an array literal's elements (+ fill) at `offset`. */
function writeArray(
  type: Extract<Type, { kind: "array" }>,
  expr: ExprNode,
  bytes: Uint8Array,
  offset: number,
  ctx: ImageContext,
): boolean {
  if (expr.kind !== "ArrayLitExpr") {
    ctx.bag.addError(
      DiagCode.NonConstInit,
      expr.span,
      `Initializer for const '${ctx.constName}' is not a compile-time constant expression`,
    );
    return false;
  }
  const elementSize = byteSize(type.element);
  if (expr.elements.length > type.size) {
    ctx.bag.addError(
      DiagCode.TypeMismatchAssignment,
      expr.span,
      `Array literal has ${expr.elements.length} elements but the declared size is ${type.size}`,
    );
    return false;
  }
  let ok = true;
  expr.elements.forEach((element, i) => {
    ok = writeValue(type.element, element, bytes, offset + i * elementSize, ctx) && ok;
  });
  if (expr.elements.length < type.size) {
    if (expr.fill === null) {
      ctx.bag.addError(
        DiagCode.ConstArrayNotFullyInit,
        expr.span,
        `Const array '${ctx.constName}' must be fully initialised — ` +
          `${expr.elements.length} of ${type.size} elements provided (add a '; fill' value)`,
      );
      return false;
    }
    for (let i = expr.elements.length; i < type.size; i += 1) {
      ok = writeValue(type.element, expr.fill, bytes, offset + i * elementSize, ctx) && ok;
    }
  }
  return ok;
}

/** Writes a struct literal's fields at their layout offsets from `offset`. */
function writeStruct(
  type: Extract<Type, { kind: "struct" }>,
  expr: ExprNode,
  bytes: Uint8Array,
  offset: number,
  ctx: ImageContext,
): boolean {
  if (expr.kind !== "StructLitExpr") {
    ctx.bag.addError(
      DiagCode.NonConstInit,
      expr.span,
      `Initializer for const '${ctx.constName}' is not a compile-time constant expression`,
    );
    return false;
  }
  let ok = true;
  const written = new Set<string>();
  for (const field of expr.fields) {
    const layout = type.fields.get(field.name);
    if (layout === undefined) continue; // unknown field — expression typing owns it
    written.add(field.name);
    ok = writeValue(layout.type, field.value, bytes, offset + layout.offset, ctx) && ok;
  }
  for (const name of type.fields.keys()) {
    if (!written.has(name)) {
      ctx.bag.addError(
        DiagCode.MissingFieldInInit,
        expr.span,
        `Struct literal for const '${ctx.constName}' is missing field '${name}'`,
      );
      ok = false;
    }
  }
  return ok;
}

/** Folds a scalar element/field and encodes it little-endian at `offset`. */
function writeScalar(
  type: Type,
  expr: ExprNode,
  bytes: Uint8Array,
  offset: number,
  ctx: ImageContext,
): boolean {
  const result = ctx.engine.evalExpr(expr, ctx.scope);
  if (result?.kind === "poisoned") return false; // root cause already reported
  if (result?.kind !== "value") {
    ctx.bag.addError(
      DiagCode.NonConstInit,
      expr.span,
      `Initializer for const '${ctx.constName}' is not a compile-time constant expression`,
    );
    return false;
  }
  const width = byteSize(type);
  if (typeof result.value === "boolean") {
    bytes[offset] = result.value ? 1 : 0;
    return true;
  }
  const range = integerRange(type);
  if (range !== null && (result.value < range.min || result.value > range.max)) {
    ctx.bag.addError(
      DiagCode.ValueOutOfRange,
      expr.span,
      `Value ${result.value} is out of range for the element type`,
    );
    return false;
  }
  const encoded = toBits(result.value, width === 2 ? 16 : 8);
  bytes[offset] = encoded & 0xff;
  if (width === 2) bytes[offset + 1] = (encoded >> 8) & 0xff;
  return true;
}
