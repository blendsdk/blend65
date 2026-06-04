/**
 * Specification tests for the RD-04 semantic type utilities (skeleton).
 *
 * Derived exclusively from plans/rd-04-semantic-analysis/07-testing-strategy.md
 * (ST-S3..ST-S11) and 03-01-type-model.md — NOT from implementation logic.
 *
 * Two utility classes are covered:
 *   • Structural facts (IMPLEMENTED, D10): isInteger/isSigned/isUnsigned/
 *     bitWidth/byteSize/isError/typeName — exact values are asserted.
 *   • Type-system policy (STUBBED, D10): isAssignableTo/commonType — only the
 *     documented placeholder behavior (`true` / `null`) is asserted; the real
 *     checker semantics are DEFERRED and intentionally NOT tested here.
 *
 * Spec-tests-first (testing.md Rule 10): authored before the implementation;
 * immutable oracle.
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
  // ST-S3 — integer-ness of the unsigned/signed widths.
  it("should report byte and word as integers (ST-S3)", () => {
    expect(isInteger(primitive("byte"))).toBe(true);
    expect(isInteger(primitive("word"))).toBe(true);
  });

  // ST-S4 — boolean and error are NOT integers.
  it("should report boolean and ERROR_TYPE as non-integers (ST-S4)", () => {
    expect(isInteger(primitive("boolean"))).toBe(false);
    expect(isInteger(ERROR_TYPE)).toBe(false);
  });

  // ST-S5 — signedness predicates.
  it("should classify sbyte as signed and byte as unsigned (ST-S5)", () => {
    expect(isSigned(primitive("sbyte"))).toBe(true);
    expect(isUnsigned(primitive("byte"))).toBe(true);
  });

  // ST-S6 — bit widths of an 8-bit and a 16-bit primitive.
  it("should report bit widths 8 for byte and 16 for word (ST-S6)", () => {
    expect(bitWidth(primitive("byte"))).toBe(8);
    expect(bitWidth(primitive("word"))).toBe(16);
  });

  // ST-S7 — byte sizes of an 8-bit and a 16-bit primitive.
  it("should report byte sizes 1 for byte and 2 for word (ST-S7)", () => {
    expect(byteSize(primitive("byte"))).toBe(1);
    expect(byteSize(primitive("word"))).toBe(2);
  });

  // ST-S8 — error-type predicate.
  it("should detect ERROR_TYPE and reject a primitive (ST-S8, R29)", () => {
    expect(isError(ERROR_TYPE)).toBe(true);
    expect(isError(primitive("byte"))).toBe(false);
  });

  // ST-S9 — human-readable name for diagnostics.
  it('should render typeName(sword) as "sword" (ST-S9)', () => {
    expect(typeName(primitive("sword"))).toBe("sword");
  });
});

describe("Specification: RD-04 type utilities — policy stubs (DEFERRED)", () => {
  // ST-S10 — isAssignableTo exists and returns the permissive placeholder.
  it("should expose isAssignableTo returning the placeholder true (ST-S10, D10)", () => {
    expect(typeof isAssignableTo).toBe("function");
    expect(isAssignableTo(primitive("byte"), primitive("word"))).toBe(true);
  });

  // ST-S11 — commonType exists and returns the placeholder null.
  it("should expose commonType returning the placeholder null (ST-S11, D10)", () => {
    expect(typeof commonType).toBe("function");
    expect(commonType(primitive("byte"), primitive("word"))).toBeNull();
  });
});
