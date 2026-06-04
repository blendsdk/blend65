/**
 * Implementation tests for the RD-04 semantic type utilities (skeleton).
 *
 * Where `type-utils.spec.test.ts` pins the specification contract (ST-S3..S11),
 * these tests exercise edge cases and internals of the structural utilities
 * across the WHOLE `Type` union — array/struct/enum/void/error variants — to
 * confirm `byteSize`/`bitWidth`/`typeName` are total and never throw (D13).
 *
 * Written AFTER implementation; filed as `*.impl.test.ts` (testing.md Rule 10).
 */

import { describe, expect, it } from "vitest";
import { makeSpan } from "../index.js";
import type { SourceSpan, StructDeclNode, EnumDeclNode } from "../index.js";
import { ERROR_TYPE, primitive } from "../index.js";
import {
  isInteger,
  isSigned,
  isUnsigned,
  bitWidth,
  byteSize,
  typeName,
} from "../index.js";
import type { ArrayType, StructType, EnumType } from "../index.js";

const SPAN: SourceSpan = makeSpan(0, 0, 0);

const STRUCT_DECL: StructDeclNode = {
  kind: "StructDecl",
  exported: false,
  name: "Point",
  nameSpan: SPAN,
  fields: [],
  span: SPAN,
};

const ENUM_DECL: EnumDeclNode = {
  kind: "EnumDecl",
  exported: false,
  name: "Color",
  nameSpan: SPAN,
  members: [],
  span: SPAN,
};

/** A `word[4]` array type used to probe array recursion in the utilities. */
const WORD_ARRAY: ArrayType = { kind: "array", element: primitive("word"), size: 4 };

/** A struct type with a precomputed byteSize of 5. */
const POINT_STRUCT: StructType = {
  kind: "struct",
  name: "Point",
  decl: STRUCT_DECL,
  fields: new Map([
    ["x", { type: primitive("word"), offset: 0 }],
    ["flag", { type: primitive("boolean"), offset: 2 }],
  ]),
  byteSize: 5,
};

const COLOR_ENUM: EnumType = {
  kind: "enum",
  name: "Color",
  decl: ENUM_DECL,
  members: new Map([
    ["Red", 0],
    ["Green", 1],
  ]),
};

describe("type-utils — bitWidth edge cases (D13)", () => {
  it("should report 8 for every 8-bit primitive", () => {
    expect(bitWidth(primitive("byte"))).toBe(8);
    expect(bitWidth(primitive("sbyte"))).toBe(8);
    expect(bitWidth(primitive("boolean"))).toBe(8);
  });

  it("should report 16 for every 16-bit primitive", () => {
    expect(bitWidth(primitive("word"))).toBe(16);
    expect(bitWidth(primitive("sword"))).toBe(16);
  });

  it("should fall through to 8 for the width-less void primitive", () => {
    // `void` carries no meaningful width; the contract documents it falls to 8.
    expect(bitWidth(primitive("void"))).toBe(8);
  });
});

describe("type-utils — byteSize across the whole union (D13, total)", () => {
  it("should size the scalar primitives", () => {
    expect(byteSize(primitive("byte"))).toBe(1);
    expect(byteSize(primitive("sbyte"))).toBe(1);
    expect(byteSize(primitive("boolean"))).toBe(1);
    expect(byteSize(primitive("word"))).toBe(2);
    expect(byteSize(primitive("sword"))).toBe(2);
  });

  it("should size void and error as 0 (never throws)", () => {
    expect(byteSize(primitive("void"))).toBe(0);
    expect(byteSize(ERROR_TYPE)).toBe(0);
  });

  it("should size an array as element-size times count", () => {
    // word (2) * 4 = 8
    expect(byteSize(WORD_ARRAY)).toBe(8);
  });

  it("should size a nested array recursively", () => {
    const nested: ArrayType = { kind: "array", element: WORD_ARRAY, size: 3 };
    // (word(2) * 4) * 3 = 24
    expect(byteSize(nested)).toBe(24);
  });

  it("should size a struct by its precomputed byteSize", () => {
    expect(byteSize(POINT_STRUCT)).toBe(5);
  });

  it("should size an enum as 1 byte in the structural model", () => {
    expect(byteSize(COLOR_ENUM)).toBe(1);
  });
});

describe("type-utils — typeName across the whole union (total)", () => {
  it("should render primitive names verbatim", () => {
    expect(typeName(primitive("byte"))).toBe("byte");
    expect(typeName(primitive("void"))).toBe("void");
  });

  it("should render an array as element[size]", () => {
    expect(typeName(WORD_ARRAY)).toBe("word[4]");
  });

  it("should render a nested array recursively", () => {
    const nested: ArrayType = { kind: "array", element: WORD_ARRAY, size: 3 };
    expect(typeName(nested)).toBe("word[4][3]");
  });

  it("should render struct and enum by their declared name", () => {
    expect(typeName(POINT_STRUCT)).toBe("Point");
    expect(typeName(COLOR_ENUM)).toBe("Color");
  });

  it("should render the poison type as <error>", () => {
    expect(typeName(ERROR_TYPE)).toBe("<error>");
  });
});

describe("type-utils — predicates reject non-primitive variants", () => {
  it("should treat arrays, structs, and enums as non-integers", () => {
    expect(isInteger(WORD_ARRAY)).toBe(false);
    expect(isInteger(POINT_STRUCT)).toBe(false);
    expect(isInteger(COLOR_ENUM)).toBe(false);
  });

  it("should treat non-primitives as neither signed nor unsigned", () => {
    expect(isSigned(WORD_ARRAY)).toBe(false);
    expect(isUnsigned(POINT_STRUCT)).toBe(false);
    expect(isSigned(COLOR_ENUM)).toBe(false);
  });

  it("should treat void as neither signed nor unsigned nor integer", () => {
    expect(isInteger(primitive("void"))).toBe(false);
    expect(isSigned(primitive("void"))).toBe(false);
    expect(isUnsigned(primitive("void"))).toBe(false);
  });
});
