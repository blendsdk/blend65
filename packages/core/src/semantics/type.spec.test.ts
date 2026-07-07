/**
 * Specification tests for the semantic `Type` union (skeleton).
 *
 * Derived exclusively from the testing strategy and type-model specification
 * documents — NOT from implementation logic. These verify that every type
 * variant is constructible, that the `primitive` helper spells `"boolean"`
 * (not `'bool'`), and that the shared `ERROR_TYPE` poison singleton exists.
 * Behavioral checking is not implemented yet.
 *
 * Spec-tests-first: authored before the implementation and expected to FAIL
 * first (red), then PASS (green). Immutable oracle — a failure after
 * implementation means the implementation is wrong, not this test.
 */

import { describe, expect, it } from "vitest";
import { makeSpan } from "../index.js";
import type { SourceSpan, StructDeclNode, EnumDeclNode } from "../index.js";
// Imported through the package PUBLIC barrel (`@blend65/core` -> ../index.js) so
// this tier also pins that the semantics vocabulary is re-exported.
import { ERROR_TYPE, primitive } from "../index.js";
import type {
  Type,
  PrimitiveType,
  ArrayType,
  StructType,
  EnumType,
  ErrorType,
} from "../index.js";

/** A zero-width span for the synthetic decl nodes used as type provenance. */
const SPAN: SourceSpan = makeSpan(0, 0, 0);

/** A minimal `StructDeclNode` so `StructType.decl` has a real AST node. */
const STRUCT_DECL: StructDeclNode = {
  kind: "StructDecl",
  exported: false,
  name: "Point",
  nameSpan: SPAN,
  fields: [],
  span: SPAN,
};

/** A minimal `EnumDeclNode` so `EnumType.decl` has a real AST node. */
const ENUM_DECL: EnumDeclNode = {
  kind: "EnumDecl",
  exported: false,
  name: "Color",
  nameSpan: SPAN,
  members: [],
  span: SPAN,
};

describe("Specification: RD-04 Type union (skeleton)", () => {
  // Every type variant builds and is accepted by the `Type` union.
  it("should construct all five Type variants when given valid shapes (ST-S1)", () => {
    const prim: PrimitiveType = { kind: "primitive", name: "byte" };
    const arr: ArrayType = { kind: "array", element: prim, size: 4 };
    const struct: StructType = {
      kind: "struct",
      name: "Point",
      decl: STRUCT_DECL,
      fields: new Map([["x", { type: prim, offset: 0 }]]),
      byteSize: 1,
    };
    const en: EnumType = {
      kind: "enum",
      name: "Color",
      decl: ENUM_DECL,
      members: new Map([["Red", 0]]),
    };
    const err: ErrorType = { kind: "error" };

    // Each is assignable to the discriminated union.
    const all: Type[] = [prim, arr, struct, en, err];
    expect(all.map((t) => t.kind)).toEqual([
      "primitive",
      "array",
      "struct",
      "enum",
      "error",
    ]);
  });

  // `primitive("boolean")` yields the canonical spelling.
  it('should spell the boolean primitive "boolean" not "bool" (ST-S2, D5)', () => {
    expect(primitive("boolean")).toEqual({ kind: "primitive", name: "boolean" });
  });

  // The shared poison singleton has `kind: "error"`.
  it("should expose ERROR_TYPE as the shared poison singleton (ST-S8)", () => {
    expect(ERROR_TYPE.kind).toBe("error");
  });
});
