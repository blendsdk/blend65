import { describe, expect, it } from "vitest";

import { isGenIdentifier, isScalarType } from "./generator-ir.js";

describe("generator IR primitives", () => {
  it.each(["Main", "a", "value_1", "A".repeat(64)])(
    "accepts allowlisted identifier %s",
    (identifier) => {
      expect(isGenIdentifier(identifier)).toBe(true);
    },
  );

  it.each(["", "_hidden", "1value", "a-b", "a/b", "..", "A".repeat(65), 1, null])(
    "rejects non-identifier input %#",
    (identifier) => {
      expect(isGenIdentifier(identifier)).toBe(false);
    },
  );

  it.each(["boolean", "byte", "sbyte", "word", "sword"])(
    "accepts closed scalar type %s",
    (type) => {
      expect(isScalarType(type)).toBe(true);
    },
  );

  it.each(["void", "dword", 1, undefined])("rejects non-scalar type %#", (type) => {
    expect(isScalarType(type)).toBe(false);
  });
});
