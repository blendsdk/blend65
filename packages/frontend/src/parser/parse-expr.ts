/**
 * Minimal primary-expression parser (RD-03 §4.9; FR-42).
 *
 * Phase 3 only needs to parse the **primary** expressions that appear as
 * declaration initialisers and enum values (numeric / boolean / string / char
 * literals and identifier references). The full 14-level Pratt operator parser
 * (assignment, ternary, binary, unary, cast, postfix calls/indexing, intrinsics,
 * struct literals) arrives in Phase 5 and **extends** this entry point — it does
 * not replace the primary cases here (FR-11 additive evolution).
 *
 * On an unexpected token an {@link ErrorExprNode} is inserted and **E10301** is
 * emitted (FR-5); the offending token is not consumed so the caller's recovery
 * sees it.
 */

import { DiagCode, TokenKind, makeSpan } from "@blend65/core";
import type {
  BoolLitExprNode,
  CharLitExprNode,
  ErrorExprNode,
  ExprNode,
  IdentExprNode,
  NumericLitExprNode,
  StringLitExprNode,
} from "@blend65/core";
import type { ParserState } from "./state.js";

/**
 * Parses a single primary expression (Phase 3 subset). Never throws; on failure
 * emits E10301 and returns an {@link ErrorExprNode} without consuming the token.
 */
export function parsePrimaryExpr(state: ParserState): ExprNode {
  const { cursor, sourceId } = state;
  const tok = cursor.peek();

  switch (tok.kind) {
    case TokenKind.Number: {
      cursor.advance();
      const node: NumericLitExprNode = {
        kind: "NumericLitExpr",
        value: typeof tok.value === "number" ? tok.value : 0,
        raw: cursor.lexeme(tok),
        span: tok.span,
      };
      return node;
    }
    case TokenKind.KwTrue:
    case TokenKind.KwFalse: {
      cursor.advance();
      const node: BoolLitExprNode = {
        kind: "BoolLitExpr",
        value: tok.kind === TokenKind.KwTrue,
        span: tok.span,
      };
      return node;
    }
    case TokenKind.String: {
      cursor.advance();
      const node: StringLitExprNode = {
        kind: "StringLitExpr",
        raw: typeof tok.value === "string" ? tok.value : cursor.lexeme(tok),
        span: tok.span,
      };
      return node;
    }
    case TokenKind.Char: {
      cursor.advance();
      const node: CharLitExprNode = {
        kind: "CharLitExpr",
        raw: typeof tok.value === "string" ? tok.value : cursor.lexeme(tok),
        span: tok.span,
      };
      return node;
    }
    case TokenKind.Identifier: {
      cursor.advance();
      const node: IdentExprNode = {
        kind: "IdentExpr",
        name: cursor.lexeme(tok),
        span: tok.span,
      };
      return node;
    }
    default: {
      state.emit(DiagCode.ExpectedExpression, tok.span, "Expected expression");
      const node: ErrorExprNode = {
        kind: "ErrorExpr",
        span: makeSpan(sourceId, tok.span.start, tok.span.start),
      };
      return node;
    }
  }
}
