/**
 * Specification tests for the semantic type utilities (skeleton).
 *
 * Derived exclusively from the testing strategy and type-model specification
 * documents — NOT from implementation logic.
 *
 * Two utility classes are covered:
 *   • Structural facts (implemented): isInteger/isSigned/isUnsigned/
 *     bitWidth/byteSize/isError/typeName — exact values are asserted.
 *   • Type-system policy (stubbed): isAssignableTo/commonType — only the
 *     documented placeholder behavior (`true` / `null`) is asserted; the real
 *     checker semantics are not implemented yet and intentionally NOT tested
 *     here.
 *
 * Spec-tests-first: authored before the implementation; immutable oracle.
 */

import { describe, expect, it } from "vitest";
import { ERROR_TYPE, primitive } from "../index.js";
import {
  isInteger,
  isSigned,
  isUnsigned,
  bitWidth,
  byteSize,
  isError,
  typeName,
  isAssignableTo,
  commonType,
} from "../index.js";

describe("Specification: RD-04 type utilities — structural facts", () => {
  // Integer-ness of the unsigned/signed widths.
  it("should report byte and word as integers (ST-S3)", () => {
    expect(isInteger(primitive("byte"))).toBe(true);
    expect(isInteger(primitive("word"))).toBe(true);
  });

  // Boolean and error are NOT integers.
  it("should report boolean and ERROR_TYPE as non-integers (ST-S4)", () => {
    expect(isInteger(primitive("boolean"))).toBe(false);
    expect(isInteger(ERROR_TYPE)).toBe(false);
  });

  // Signedness predicates.
  it("should classify sbyte as signed and byte as unsigned (ST-S5)", () => {
    expect(isSigned(primitive("sbyte"))).toBe(true);
    expect(isUnsigned(primitive("byte"))).toBe(true);
  });

  // Bit widths of an 8-bit and a 16-bit primitive.
  it("should report bit widths 8 for byte and 16 for word (ST-S6)", () => {
    expect(bitWidth(primitive("byte"))).toBe(8);
    expect(bitWidth(primitive("word"))).toBe(16);
  });

  // Byte sizes of an 8-bit and a 16-bit primitive.
  it("should report byte sizes 1 for byte and 2 for word (ST-S7)", () => {
    expect(byteSize(primitive("byte"))).toBe(1);
    expect(byteSize(primitive("word"))).toBe(2);
  });

  // Error-type predicate.
  it("should detect ERROR_TYPE and reject a primitive (ST-S8, R29)", () => {
    expect(isError(ERROR_TYPE)).toBe(true);
    expect(isError(primitive("byte"))).toBe(false);
  });

  // Human-readable name for diagnostics.
  it('should render typeName(sword) as "sword" (ST-S9)', () => {
    expect(typeName(primitive("sword"))).toBe("sword");
  });
});

// This test file replaces the earlier deferred-stub oracle (`isAssignableTo`→
// true / `commonType`→null placeholders) with the real *same-type* policy:
// assignment is same-type-only for now (widening / cross-sign / narrowing
// support is planned for later), and `commonType` is the same-type binary
// result. `ErrorType` poisons permissively. This supersedes the earlier
// deferred-placeholder assertions, which no longer exist.
describe("Specification: RD-18 Slice 3b type policy — same-type rules (AR-3)", () => {
  // isAssignableTo is same-type-only for now.
  it("should accept same-type and reject widening/narrowing/cross-sign (ST-3/ST-8, AR-3)", () => {
    // same type → assignable
    expect(isAssignableTo(primitive("byte"), primitive("byte"))).toBe(true);
    expect(isAssignableTo(primitive("word"), primitive("word"))).toBe(true);
    expect(isAssignableTo(primitive("sbyte"), primitive("sbyte"))).toBe(true);
    // widening (byte→word) — not yet supported → NOT assignable
    expect(isAssignableTo(primitive("byte"), primitive("word"))).toBe(false);
    // narrowing (word→byte) → NOT assignable (E10154 at the call site)
    expect(isAssignableTo(primitive("word"), primitive("byte"))).toBe(false);
    // cross-sign (sbyte→byte) → NOT assignable (E10153 at the call site)
    expect(isAssignableTo(primitive("sbyte"), primitive("byte"))).toBe(false);
  });

  // ErrorType poisons permissively (no cascade).
  it("should treat ErrorType as assignable in either position (R114 poison)", () => {
    expect(isAssignableTo(ERROR_TYPE, primitive("byte"))).toBe(true);
    expect(isAssignableTo(primitive("byte"), ERROR_TYPE)).toBe(true);
  });

  // commonType of same-type operands is that type; mixed is null.
  it("should return the shared type for same-type operands, null otherwise (ST-3)", () => {
    expect(commonType(primitive("byte"), primitive("byte"))).toEqual(primitive("byte"));
    expect(commonType(primitive("word"), primitive("word"))).toEqual(primitive("word"));
    // widening (same sign, different width) — not yet supported → null (caller decides)
    expect(commonType(primitive("byte"), primitive("word"))).toBeNull();
    // mixed signedness → null (caller emits E10081)
    expect(commonType(primitive("byte"), primitive("sbyte"))).toBeNull();
    // boolean operand → null (caller emits E10080)
    expect(commonType(primitive("byte"), primitive("boolean"))).toBeNull();
  });

  // commonType poisons to ErrorType (no follow-on diagnostic).
  it("should return ErrorType when either operand is poisoned (R114)", () => {
    expect(commonType(ERROR_TYPE, primitive("byte"))).toEqual(ERROR_TYPE);
    expect(commonType(primitive("word"), ERROR_TYPE)).toEqual(ERROR_TYPE);
  });
});
