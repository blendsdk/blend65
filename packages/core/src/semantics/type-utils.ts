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
 *      assignment/promotion *rules*: same-type compatibility plus implicit
 *      same-sign widening (`byte`→`word`, `sbyte`→`sword`). Narrowing and
 *      cross-sign conversions always require an explicit cast.
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
 * Total byte size over the whole {@link Type} union:
 *   - `byte`/`sbyte`/`boolean` -> 1
 *   - `word`/`sword` -> 2
 *   - `void`/`error` -> 0
 *   - `struct` -> the struct's precomputed `byteSize`
 *   - `array` -> `byteSize(element) * size`
 *
 * An UNSIZED array (`size === null`) has no byte size: callers that can
 * legally meet one (parameter typing, tier classification) must branch on
 * `size` before calling; reaching this function with one is a compiler
 * defect, reported loudly rather than degraded to a silent 0.
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
      if (t.size === null) {
        throw new Error(
          "internal error: byteSize() called on an unsized array type — " +
            "unsized arrays are legal only as function parameters and carry no size",
        );
      }
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
      return t.size === null ? `${typeName(t.element)}[]` : `${typeName(t.element)}[${t.size}]`;
    case "struct":
      return t.name;
    case "enum":
      return t.name;
    case "error":
      return "<error>";
  }
}

/**
 * Assignment compatibility: same-type, plus implicit same-sign widening.
 *
 * A value is assignable to a target when their type names are identical, or
 * when the source widens to the target without changing signedness
 * (`byte`→`word`, `sbyte`→`sword`). This one predicate governs assignments,
 * initialisers, arguments, and returns alike — there is no second rule.
 * Narrowing and cross-sign conversions are rejected here — the *caller*
 * (statement typing) inspects *why* the assignment failed to pick the right
 * diagnostic (E10154 narrowing / E10153 cross-sign / E10152 boolean↔integer).
 *
 * {@link ErrorType} poisons permissively: if either side is poison the
 * assignment is treated as compatible so no cascade diagnostic is emitted at the
 * root-cause's dependents.
 *
 * @param source The type being assigned from.
 * @param target The type being assigned to.
 * @returns `true` iff `source` is assignable to `target` (or either is poison).
 */
export function isAssignableTo(source: Type, target: Type): boolean {
  if (isError(source) || isError(target)) return true; // poison suppression

  // Aggregates are NOMINAL: identity is the resolved type object itself (one
  // instance per declaration), never a name match — two modules may each
  // declare a `Point`, and those are distinct types.
  if (source.kind === "struct" || target.kind === "struct") {
    return source === target; // whole-struct assignment is a byte copy
  }
  if (source.kind === "array" || target.kind === "array") {
    // Whole-array runtime assignment never works (the caller owns that
    // rejection BEFORE consulting this predicate) — but an array LITERAL's
    // type must satisfy its declaration, so structurally identical array
    // types (same size, same element type — mutual assignability means
    // identity) are compatible.
    if (source.kind !== "array" || target.kind !== "array") return false;
    // A sized array binds to an unsized parameter type (`T[N] → T[]`, any N)
    // when the element types are mutually assignable; the reverse never holds
    // (an unsized value cannot be created — only bound), and two unsized
    // types are compatible for pass-through (`null === null` below).
    if (target.size !== null && source.size !== target.size) return false;
    return (
      isAssignableTo(source.element, target.element) &&
      isAssignableTo(target.element, source.element)
    );
  }
  if (source.kind === "enum" || target.kind === "enum") {
    if (source === target) return true; // same enum
    // The ONLY implicit enum conversion: enum → byte (an enum value IS its
    // byte backing). byte → enum, enum → word, and cross-enum all need casts.
    return source.kind === "enum" && target.kind === "primitive" && target.name === "byte";
  }

  if (typeName(source) === typeName(target)) return true; // same type
  if (source.kind === "primitive" && target.kind === "primitive") {
    // Same-sign widening is implicit; everything else needs an explicit cast.
    if (isInteger(source) && isInteger(target) && isSigned(source) === isSigned(target)) {
      return bitWidth(source) < bitWidth(target);
    }
  }
  return false;
}

/**
 * The common result type of a binary operator's two operands: same-type, plus
 * same-sign widening promotion.
 *
 * Returns the shared type when both operands are the same primitive type
 * (`T OP T → T`), or the WIDER type when both are integers of the same
 * signedness but different widths (`byte OP word → word`,
 * `sbyte OP sword → sword`). Returns `null` when the operands are not
 * combinable (different signedness; a `boolean` operand; non-primitives). The
 * caller distinguishes the `null` reason to emit E10081 (mixed sign) or
 * E10080 (boolean operand). {@link ErrorType} poisons to {@link ERROR_TYPE}
 * so no follow-on diagnostic is produced.
 *
 * `isPrimitive` is deliberately not used (it is not a core helper); the
 * `kind === "primitive"` guard plus a `typeName` equality check is the same
 * test over the scalar-grammar types.
 *
 * @param a The first operand's type.
 * @param b The second operand's type.
 * @returns The common primitive type, {@link ERROR_TYPE} on poison, or `null`.
 */
export function commonType(a: Type, b: Type): Type | null {
  if (isError(a) || isError(b)) return ERROR_TYPE; // poison

  // Enums combine with themselves (comparisons) and with `byte` (an enum
  // value widens to its byte backing); everything else — cross-enum,
  // enum/word, structs, arrays — is not combinable.
  if (a.kind === "enum" || b.kind === "enum") {
    if (a === b) return a; // same enum (nominal identity is the object)
    const other = a.kind === "enum" ? b : a;
    if (other.kind === "primitive" && other.name === "byte") return other;
    return null;
  }

  if (a.kind === "primitive" && b.kind === "primitive") {
    if (typeName(a) === typeName(b)) {
      return a; // T OP T → T (same-type)
    }
    if (isInteger(a) && isInteger(b) && isSigned(a) === isSigned(b)) {
      return bitWidth(a) >= bitWidth(b) ? a : b; // widening promotion
    }
  }
  return null; // mixed-sign/boolean/non-primitive → caller decides the diagnostic
}

