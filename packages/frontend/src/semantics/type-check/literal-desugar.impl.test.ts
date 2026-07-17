/**
 * Implementation tests for the in-place literal desugar: object identity,
 * span preservation, typeMap integrity, and conversion idempotence — the
 * char conversion and the string-initialiser splice.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, decodeLiteral, DiagCode } from "@blend65/core";
import type {
  ArrayLitExprNode,
  CharLitExprNode,
  DiagnosticBag,
  ExprNode,
  NumericLitExprNode,
  StringLitExprNode,
  Type,
} from "@blend65/core";
import { encoderFor } from "@blend65/core/platform";
import { convertCharLiteral } from "../char-literal.js";
import { desugarStringInit } from "../string-literal.js";

/** A minimal char-literal node with a distinct span object. */
function charNode(raw: string): CharLitExprNode {
  return {
    kind: "CharLitExpr",
    raw,
    span: { sourceId: 1, start: 10, end: 10 + raw.length + 2 },
  };
}

describe("in-place char conversion", () => {
  it("rewrites kind/value/raw on the same object and keeps the span object", () => {
    const node = charNode("A");
    const span = node.span;
    const bag: DiagnosticBag = createDiagnosticBag();
    const value = convertCharLiteral(node, encoderFor("petscii"), bag);

    expect(value).toBe(0x41);
    const converted = node as unknown as { kind: string; value: number; raw: string };
    expect(converted.kind).toBe("NumericLitExpr");
    expect(converted.value).toBe(0x41);
    expect(node.span).toBe(span);
    expect(bag.getAll()).toEqual([]);
  });

  it("is idempotent: a converted node cannot convert again", () => {
    const node = charNode("A");
    const bag: DiagnosticBag = createDiagnosticBag();
    convertCharLiteral(node, encoderFor("petscii"), bag);

    // A second visit dispatches on the rewritten kind, so the converter is
    // never re-entered for this node; converting the (now numeric) node's
    // raw text again would decode "65", not "A".
    expect(node.kind).not.toBe("CharLitExpr");
    expect(decodeLiteral((node as unknown as { raw: string }).raw)).toHaveLength(2);
  });

  it("leaves the node untouched and diagnoses when unmappable", () => {
    const node = charNode("é");
    const bag: DiagnosticBag = createDiagnosticBag();
    const value = convertCharLiteral(node, encoderFor("petscii"), bag);

    expect(value).toBeNull();
    expect(node.kind).toBe("CharLitExpr");
    expect(node.raw).toBe("é");
    const diags = bag.getAll();
    expect(diags).toHaveLength(1);
    expect(diags[0].code).toBe(DiagCode.UnencodableCharacter);
    expect(diags[0].primarySpan).toEqual({ sourceId: 1, start: 10, end: 13 });
  });

  it("stays silent on a lexer-diagnosed malformed literal", () => {
    const node = charNode("ab");
    const bag: DiagnosticBag = createDiagnosticBag();

    expect(convertCharLiteral(node, encoderFor("petscii"), bag)).toBeNull();
    expect(node.kind).toBe("CharLitExpr");
    expect(bag.getAll()).toEqual([]);
  });

  it("converts raw-byte escapes without consulting the encoder", () => {
    const bag: DiagnosticBag = createDiagnosticBag();
    // ATASCII has no TAB mapping, but a raw hex escape bypasses encoding.
    const node = charNode("\\x09");
    expect(convertCharLiteral(node, encoderFor("atascii"), bag)).toBe(0x09);
    expect(bag.getAll()).toEqual([]);
  });
});

/** A minimal string-literal node with a distinct span object. */
function stringNode(raw: string): StringLitExprNode {
  return {
    kind: "StringLitExpr",
    raw,
    span: { sourceId: 1, start: 20, end: 20 + raw.length + 2 },
  };
}

/** A byte-array type of the given size (`null` = unsized). */
function byteArray(size: number | null): Type {
  return { kind: "array", element: { kind: "primitive", name: "byte" }, size };
}

describe("in-place string-initialiser splice", () => {
  const ascii = encoderFor("ascii");

  it("splices the element list with every synthetic carrying the string's span", () => {
    const lit = stringNode("HI");
    const decl: { initialiser: ExprNode | null } = { initialiser: lit };
    const bag: DiagnosticBag = createDiagnosticBag();

    expect(desugarStringInit(decl, byteArray(4), ascii, bag)).toBe(false);
    const spliced = decl.initialiser as ArrayLitExprNode;
    expect(spliced.kind).toBe("ArrayLitExpr");
    expect(spliced.span).toBe(lit.span);
    expect(spliced.fill).toBeNull();
    for (const element of spliced.elements) {
      expect(element.kind).toBe("NumericLitExpr");
      expect(element.span).toBe(lit.span);
    }
    expect(spliced.elements.map((e) => (e as NumericLitExprNode).value)).toEqual([
      0x48, 0x49,
    ]);
  });

  it("rejects an oversized string before splicing — the initialiser is untouched", () => {
    const lit = stringNode("HELLO");
    const decl: { initialiser: ExprNode | null } = { initialiser: lit };
    const bag: DiagnosticBag = createDiagnosticBag();

    expect(desugarStringInit(decl, byteArray(3), ascii, bag)).toBe(true);
    expect(decl.initialiser).toBe(lit);
    expect(bag.getAll()[0]?.code).toBe(DiagCode.StringExceedsArraySize);
  });

  it("expands a bracketed string in place, preserving the fill node object", () => {
    const lit = stringNode("HI");
    const fill: NumericLitExprNode = {
      kind: "NumericLitExpr",
      value: 0,
      raw: "0",
      span: { sourceId: 1, start: 30, end: 31 },
    };
    const bracketed: ArrayLitExprNode = {
      kind: "ArrayLitExpr",
      elements: [lit],
      fill,
      span: { sourceId: 1, start: 19, end: 32 },
    };
    const decl: { initialiser: ExprNode | null } = { initialiser: bracketed };
    const bag: DiagnosticBag = createDiagnosticBag();

    expect(desugarStringInit(decl, byteArray(8), ascii, bag)).toBe(false);
    expect(decl.initialiser).toBe(bracketed);
    expect(bracketed.fill).toBe(fill);
    expect(bracketed.elements.map((e) => (e as NumericLitExprNode).value)).toEqual([
      0x48, 0x49,
    ]);
  });

  it("leaves non-array declarations alone", () => {
    const lit = stringNode("HI");
    const decl: { initialiser: ExprNode | null } = { initialiser: lit };
    const bag: DiagnosticBag = createDiagnosticBag();

    const byteType: Type = { kind: "primitive", name: "byte" };
    expect(desugarStringInit(decl, byteType, ascii, bag)).toBe(false);
    expect(decl.initialiser).toBe(lit);
    expect(bag.getAll()).toEqual([]);
  });

  it("diagnoses an unmappable character once and leaves the initialiser untouched", () => {
    const lit = stringNode("A\tB");
    const decl: { initialiser: ExprNode | null } = { initialiser: lit };
    const bag: DiagnosticBag = createDiagnosticBag();

    // ATASCII has no TAB mapping; the string must not partially splice.
    expect(desugarStringInit(decl, byteArray(8), encoderFor("atascii"), bag)).toBe(true);
    expect(decl.initialiser).toBe(lit);
    const diags = bag.getAll();
    expect(diags).toHaveLength(1);
    expect(diags[0].code).toBe(DiagCode.UnencodableCharacter);
  });
});
