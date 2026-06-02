/**
 * Type-expression parser (RD-03 §4.13; grammar §4; FR-16/19/21/22).
 *
 * Parses a `type` production: a primitive keyword (`byte`/`sbyte`/`word`/`sword`/
 * `boolean`/`void`) → {@link PrimitiveTypeNode}; an identifier → {@link NamedTypeNode}
 * (a struct or enum name — resolved later by RD-04, grammar §4 parsing note); with
 * a trailing `[ constExpr ]` (sized) or `[]` (unsized) suffix → {@link ArrayTypeNode}.
 *
 * On a non-type token it emits **E10303** and returns an {@link ErrorTypeNode}
 * **without** consuming the offending token, so the caller's recovery sees it
 * (03-03 recovery table, "Type position" row; FR-5).
 */

import { DiagCode, TokenKind, makeSpan } from "@blend65/core";
import type {
  ArrayTypeNode,
  ErrorTypeNode,
  NamedTypeNode,
  PrimitiveTypeName,
  PrimitiveTypeNode,
  TypeNode,
} from "@blend65/core";
import type { ParserState } from "./state.js";
import { parsePrimaryExpr } from "./parse-expr.js";

/** Maps a primitive type keyword kind to its {@link PrimitiveTypeName}. */
const PRIMITIVE_NAMES: ReadonlyMap<string, PrimitiveTypeName> = new Map([
  [TokenKind.KwByte, "byte"],
  [TokenKind.KwSbyte, "sbyte"],
  [TokenKind.KwWord, "word"],
  [TokenKind.KwSword, "sword"],
  [TokenKind.KwBoolean, "boolean"],
  [TokenKind.KwVoid, "void"],
]);

/**
 * Parses a type expression. Never throws; on a non-type token emits E10303 and
 * returns an {@link ErrorTypeNode} without consuming the token.
 */
export function parseType(state: ParserState): TypeNode {
  const { cursor, sourceId } = state;
  const tok = cursor.peek();

  let base: TypeNode;
  const primitive = PRIMITIVE_NAMES.get(tok.kind);
  if (primitive !== undefined) {
    cursor.advance();
    const node: PrimitiveTypeNode = { kind: "PrimitiveType", name: primitive, span: tok.span };
    base = node;
  } else if (tok.kind === TokenKind.Identifier) {
    cursor.advance();
    const node: NamedTypeNode = { kind: "NamedType", name: cursor.lexeme(tok), span: tok.span };
    base = node;
  } else {
    state.emit(DiagCode.ExpectedTypeAnnotation, tok.span, "Expected type annotation");
    const node: ErrorTypeNode = {
      kind: "ErrorType",
      span: makeSpan(sourceId, tok.span.start, tok.span.start),
    };
    return node;
  }

  // Array suffixes: `[ constExpr ]` (sized) or `[]` (unsized). Left-associative
  // so `byte[2][3]` nests as an array of arrays.
  while (cursor.check(TokenKind.LBracket)) {
    cursor.advance(); // '['
    let size: ArrayTypeNode["size"] = null;
    if (!cursor.check(TokenKind.RBracket)) {
      size = parsePrimaryExpr(state);
    }
    const close = cursor.expect(
      TokenKind.RBracket,
      DiagCode.MissingCloseBracket,
      "']' to close array type",
    );
    const end = close !== null ? close.span.end : base.span.end;
    const node: ArrayTypeNode = {
      kind: "ArrayType",
      elementType: base,
      size,
      span: makeSpan(sourceId, base.span.start, end),
    };
    base = node;
  }

  return base;
}
