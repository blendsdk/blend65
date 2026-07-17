/**
 * Implementation tests for the in-place literal desugar: object identity,
 * span preservation, typeMap integrity, and conversion idempotence.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, decodeLiteral, DiagCode } from "@blend65/core";
import type { CharLitExprNode, DiagnosticBag } from "@blend65/core";
import { encoderFor } from "@blend65/core/platform";
import { convertCharLiteral } from "../char-literal.js";

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
