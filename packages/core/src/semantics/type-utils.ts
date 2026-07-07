/**
 * Utility functions over the semantic {@link Type} union.
 *
 * Two distinct classes of utility live here:
 *
 *   1. **Structural facts (implemented):** pure functions that report
 *      properties intrinsic to a type's *shape* — integer-ness, signedness, bit
 *      width, byte size, error-ness, display name. These do not depend on any
 *      type-system *policy*, so they are safe to implement in the skeleton.
 *
 *   2. **Type-system policy:** `isAssignableTo` and `commonType` encode the
 *      assignment/promotion *rules*. The current implementation supports
 *      same-type-only assignment and common-type resolution; further rules
 *      (widening, cross-sign coercion, casts) are not implemented yet.
 *      {@link ErrorType} poisons permissively so no cascading diagnostic is
 *      emitted, and the real checker rules emit E10152/E10153/E10154.
 */

import type { Type, PrimitiveType } from "./type.js";
import { ERROR_TYPE } from "./type.js";

/**
 * Reports whether `t` is one of the four integer primitives: `byte`, `sbyte`,
 * `word`, `sword`. Note that `boolean` and `enum` are NOT integers under this
 * predicate, and neither is `void`.
 *
 * @param t Any semantic type.
 * @returns `true` iff `t` is an integer primitive.
 */
export function isInteger(t: Type): boolean {
  return (
    t.kind === "primitive" &&
    (t.name === "byte" || t.name === "sbyte" || t.name === "word" || t.name === "sword")
  );
}

/**
 * Reports whether `t` is a signed integer primitive (`sbyte` or `sword`).
 *
 * @param t Any semantic type.
 * @returns `true` iff `t` is a signed integer primitive.
 */
export function isSigned(t: Type): boolean {
  return t.kind === "primitive" && (t.name === "sbyte" || t.name === "sword");
}

/**
 * Reports whether `t` is an unsigned integer primitive (`byte` or `word`).
 *
 * @param t Any semantic type.
 * @returns `true` iff `t` is an unsigned integer primitive.
 */
export function isUnsigned(t: Type): boolean {
  return t.kind === "primitive" && (t.name === "byte" || t.name === "word");
}

/**
 * Bit width of a width-bearing primitive: `8` for `byte`/`sbyte`/`boolean`;
 * `16` for `word`/`sword`.
 *
 * The parameter is typed as {@link PrimitiveType} (not the full union) on
 * purpose: `void` carries no width, and `struct`/`array`/`error` are not
 * primitives, so passing them is a COMPILE-TIME error — callers must narrow to a
 * primitive first. This makes the function total over its (narrowed) domain and
 * removes the void/error ambiguity (L7 — fail at compile time, not runtime).
 *
 * `void` is still spellable as a `PrimitiveType`, but it carries no meaningful
 * width; only `word`/`sword` take the 16-bit branch, so `void` falls through to
 * `8`. Callers that must distinguish `void` should guard with
 * `isInteger`/`name !== "void"` before calling.
 *
 * @param t A primitive type.
 * @returns `8` or `16`.
 */
export function bitWidth(t: PrimitiveType): 8 | 16 {
  return t.name === "word" || t.name === "sword" ? 16 : 8;
}

/**
 * Total byte size over the whole {@link Type} union — never throws:
 *   - `byte`/`sbyte`/`boolean` -> 1
 *   - `word`/`sword` -> 2
 *   - `void`/`error` -> 0
 *   - `struct` -> the struct's precomputed `byteSize`
 *   - `array` -> `byteSize(element) * size`
 *
 * @param t Any semantic type.
 * @returns The size in bytes (0 for the width-less/poison types).
 */
export function byteSize(t: Type): number {
  switch (t.kind) {
    case "primitive":
      if (t.name === "word" || t.name === "sword") {
        return 2;
      }
      if (t.name === "void") {
        return 0;
      }
      // byte, sbyte, boolean
      return 1;
    case "array":
      return byteSize(t.element) * t.size;
    case "struct":
      return t.byteSize;
    case "enum":
      // Enums are byte-backed in the skeleton's structural model.
      return 1;
    case "error":
      return 0;
  }
}

/**
 * Reports whether `t` is the poison {@link ErrorType}.
 *
 * @param t Any semantic type.
 * @returns `true` iff `t.kind === "error"`.
 */
export function isError(t: Type): boolean {
  return t.kind === "error";
}

/**
 * Renders a human-readable name for diagnostics, e.g. `"byte"`, `"word[4]"`,
 * `"Enemy"`, `"<error>"`.
 *
 * @param t Any semantic type.
 * @returns A display string (never throws; total over the union).
 */
export function typeName(t: Type): string {
  switch (t.kind) {
    case "primitive":
      return t.name;
    case "array":
      return `${typeName(t.element)}[${t.size}]`;
    case "struct":
      return t.name;
    case "enum":
      return t.name;
    case "error":
      return "<error>";
  }
}

/**
 * Assignment compatibility — currently same-type only.
 *
 * The type engine is currently same-type-only: a value is assignable to a
 * target iff their type names are identical. Implicit widening (`byte`→`word`),
 * cross-sign, narrowing, and `as` casts are all rejected here — the *caller*
 * (statement typing) inspects *why* the assignment failed to pick the right
 * diagnostic (E10154 narrowing / E10153 cross-sign / E10152 boolean↔integer).
 * Widening/casts are not implemented yet (they need `zext`/`sext`/`trunc` IL
 * ops).
 *
 * {@link ErrorType} poisons permissively: if either side is poison the
 * assignment is treated as compatible so no cascade diagnostic is emitted at the
 * root-cause's dependents.
 *
 * @param source The type being assigned from.
 * @param target The type being assigned to.
 * @returns `true` iff `source` is same-type-assignable to `target` (or either is poison).
 */
export function isAssignableTo(source: Type, target: Type): boolean {
  if (isError(source) || isError(target)) return true; // poison suppression
  return typeName(source) === typeName(target); // strict same-type
}

/**
 * The common result type of a binary operator's two operands — currently
 * same-type only.
 *
 * Returns the shared type when both operands are the same primitive type
 * (`T OP T → T`); returns `null` when they are not currently combinable
 * (different width — widening is not implemented yet; different signedness; a
 * `boolean` operand). The caller distinguishes the `null` reason to emit E10081
 * (mixed sign) or E10080 (boolean operand). {@link ErrorType} poisons to
 * {@link ERROR_TYPE} so no follow-on diagnostic is produced.
 *
 * `isPrimitive` is deliberately not used (it is not a core helper); the
 * `kind === "primitive"` guard plus a `typeName` equality check is the same
 * test over the scalar-grammar types.
 *
 * @param a The first operand's type.
 * @param b The second operand's type.
 * @returns The shared primitive type, {@link ERROR_TYPE} on poison, or `null`.
 */
export function commonType(a: Type, b: Type): Type | null {
  if (isError(a) || isError(b)) return ERROR_TYPE; // poison
  if (a.kind === "primitive" && b.kind === "primitive" && typeName(a) === typeName(b)) {
    return a; // T OP T → T (same-type)
  }
  return null; // widening/mixed-sign/boolean → caller decides the diagnostic
}

