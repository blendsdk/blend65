/**
 * Type-node → semantic {@link Type} resolution + integer-range facts for the
 * RD-18 Slice 3b scalar type engine (FR-2).
 *
 * Slice 3b works over the five scalar primitives; a declared `TypeNode` resolves
 * to its `primitive(name)`, and anything outside the scalar surface (named /
 * array types, or an unparsed `null`/`ErrorType`) resolves to {@link ERROR_TYPE}
 * (the SFA planner sizes an error slot defensively, so nothing crashes). Named /
 * array typing arrives with Slices 6/7.
 */

import { ERROR_TYPE, primitive } from "@blend65/core";
import type { Type, TypeNode } from "@blend65/core";

/**
 * Resolves a declared {@link TypeNode} to its semantic {@link Type} (scalar
 * surface): a `PrimitiveType` node → `primitive(name)`; everything else →
 * {@link ERROR_TYPE}. Never throws.
 *
 * @param node The declared type node, or `null` for an inferred declaration.
 * @returns The resolved primitive type, or {@link ERROR_TYPE}.
 */
export function resolveTypeNode(node: TypeNode | null): Type {
  return node !== null && node.kind === "PrimitiveType" ? primitive(node.name) : ERROR_TYPE;
}

/** The inclusive value range of an integer primitive. */
export interface IntRange {
  readonly min: number;
  readonly max: number;
}

/**
 * The inclusive representable range of an integer primitive (spec 02 TS-2), or
 * `null` for a non-integer primitive (`boolean`/`void`) or a non-primitive type.
 *
 * @param t Any semantic type.
 * @returns The `{ min, max }` range, or `null` when `t` has no integer range.
 */
export function integerRange(t: Type): IntRange | null {
  if (t.kind !== "primitive") return null;
  switch (t.name) {
    case "byte":
      return { min: 0, max: 255 };
    case "sbyte":
      return { min: -128, max: 127 };
    case "word":
      return { min: 0, max: 65535 };
    case "sword":
      return { min: -32768, max: 32767 };
    default:
      return null; // boolean / void — no integer range
  }
}
