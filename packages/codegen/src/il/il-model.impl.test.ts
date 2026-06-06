/**
 * Implementation tests for the RD-06 IL data model.
 *
 * These cover edge cases and internals NOT pinned by the spec oracle
 * (il-model.spec.test.ts): the `ilTypeOfType` mapping for every `Type` variant
 * including the documented `ErrorType`/`void` safe defaults, `ilTypeEquals`
 * across all four canonical constants, and the `loc()` optional-offset shape.
 *
 * Written AFTER the implementation (testing.md Rule 6/10) — they probe the code
 * as built, complementing (never replacing) the immutable spec tests.
 */

import { describe, expect, it } from "vitest";
import { ERROR_TYPE, makeSpan, primitive } from "@blend65/core";
import type {
  ArrayType,
  EnumDeclNode,
  EnumType,
  SourceSpan,
  StructDeclNode,
  StructType,
} from "@blend65/core";

import {
  IL_BYTE,
  IL_SBYTE,
  IL_SWORD,
  IL_WORD,
  ilTypeEquals,
  ilTypeOfType,
} from "./il-type.js";
import { imm, isImmediate, isLocation, isTemp, loc, temp } from "./operand.js";

const SPAN: SourceSpan = makeSpan(0, 0, 0);

const STRUCT_DECL: StructDeclNode = {
  kind: "StructDecl",
  exported: false,
  name: "P",
  nameSpan: SPAN,
  fields: [],
  span: SPAN,
};

const ENUM_DECL: EnumDeclNode = {
  kind: "EnumDecl",
  exported: false,
  name: "C",
  nameSpan: SPAN,
  members: [],
  span: SPAN,
};

describe("ilTypeOfType — every Type variant", () => {
  it("should map each primitive name to its IL type", () => {
    expect(ilTypeOfType(primitive("byte"))).toBe(IL_BYTE);
    expect(ilTypeOfType(primitive("boolean"))).toBe(IL_BYTE);
    expect(ilTypeOfType(primitive("sbyte"))).toBe(IL_SBYTE);
    expect(ilTypeOfType(primitive("word"))).toBe(IL_WORD);
    expect(ilTypeOfType(primitive("sword"))).toBe(IL_SWORD);
  });

  it("should map the void primitive to the IL_BYTE safe default (unreached, H5)", () => {
    // `void` is a return-type marker; lowering never asks for its operand type.
    expect(ilTypeOfType(primitive("void"))).toBe(IL_BYTE);
  });

  it("should erase enum identity to IL_BYTE regardless of members", () => {
    const en: EnumType = {
      kind: "enum",
      name: "C",
      decl: ENUM_DECL,
      members: new Map([
        ["A", 0],
        ["B", 9],
      ]),
    };
    expect(ilTypeOfType(en)).toBe(IL_BYTE);
  });

  it("should map struct and (nested) array to IL_WORD by-ref", () => {
    const struct: StructType = {
      kind: "struct",
      name: "P",
      decl: STRUCT_DECL,
      fields: new Map(),
      byteSize: 4,
    };
    const arr: ArrayType = {
      kind: "array",
      element: { kind: "array", element: primitive("byte"), size: 2 },
      size: 3,
    };
    expect(ilTypeOfType(struct)).toBe(IL_WORD);
    expect(ilTypeOfType(arr)).toBe(IL_WORD);
  });

  it("should return the documented IL_BYTE default for ErrorType (R68 skip default)", () => {
    expect(ilTypeOfType(ERROR_TYPE)).toBe(IL_BYTE);
  });
});

describe("ilTypeEquals — across canonical constants", () => {
  it("should be reflexive for all four constants", () => {
    for (const t of [IL_BYTE, IL_SBYTE, IL_WORD, IL_SWORD]) {
      expect(ilTypeEquals(t, t)).toBe(true);
    }
  });

  it("should distinguish on width", () => {
    expect(ilTypeEquals(IL_BYTE, IL_WORD)).toBe(false);
    expect(ilTypeEquals(IL_SBYTE, IL_SWORD)).toBe(false);
  });

  it("should distinguish on signedness", () => {
    expect(ilTypeEquals(IL_BYTE, IL_SBYTE)).toBe(false);
    expect(ilTypeEquals(IL_WORD, IL_SWORD)).toBe(false);
  });

  it("should compare by value, not reference (hand-built literal)", () => {
    expect(ilTypeEquals({ width: 16, signed: false }, IL_WORD)).toBe(true);
  });
});

describe("operand constructors & guards — internals", () => {
  it("should omit the offset key on loc() when no offset is given", () => {
    const l = loc("__var_x", IL_BYTE);
    expect("offset" in l).toBe(false);
  });

  it("should attach the offset key on loc() when an offset is given", () => {
    const l = loc("__frame_s", IL_WORD, 2);
    expect(l).toEqual({ kind: "location", symbol: "__frame_s", offset: 2, type: IL_WORD });
  });

  it("should attach a zero offset explicitly when 0 is passed (not treated as absent)", () => {
    const l = loc("__frame_s", IL_WORD, 0);
    expect("offset" in l).toBe(true);
    if (isLocation(l)) {
      expect(l.offset).toBe(0);
    }
  });

  it("should make guards mutually exclusive across all three operand kinds", () => {
    const operands = [imm(1, IL_BYTE), temp(0, IL_BYTE), loc("__var_x", IL_BYTE)];
    for (const o of operands) {
      const flags = [isImmediate(o), isTemp(o), isLocation(o)].filter(Boolean);
      expect(flags).toHaveLength(1);
    }
  });
});
