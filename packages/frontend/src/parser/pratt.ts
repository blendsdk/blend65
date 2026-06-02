/**
 * The Pratt (top-down operator-precedence) expression parser (RD-03 §4.9;
 * grammar §6; FR-2/37..45).
 *
 * {@link parseExpression} implements the 14 binding-power levels of the Blend65
 * grammar. Left/right binding powers (LBP/RBP) encode precedence and
 * associativity: an operator binds the expression to its left only while its LBP
 * exceeds the caller's `minBP`, and recurses with its RBP for the right operand.
 * Left-associative operators use `RBP = LBP + 1`; the two right-associative
 * levels — assignment and the conditional `?:` — use `RBP = LBP − 1`.
 *
 * Prefix position disambiguates the two overloaded sigils (FR-40): `<` opens a
 * `<type>(expr)` cast (never a comparison), and `&` is address-of (never bitwise
 * AND). The postfix chain `.field` / `[index]` / `(args)` binds tightest and is
 * left-associative. An identifier immediately followed by `(` is an
 * {@link IntrinsicCallExprNode} when its name is in `RESERVED_BUILTINS` (AR-3),
 * the data-inclusion {@link EmbedExprNode} for `embed(...)`, otherwise a
 * {@link CallExprNode}. A `{` after an identifier is a {@link StructLitExprNode}
 * only in initialiser context (`allowStructLiteral`, FR-45) — everywhere else `{`
 * starts a block owned by the statement layer.
 *
 * Like every parser in this module it never throws (FR-4): unexpected tokens
 * yield {@link ErrorExprNode} sentinels and diagnostics, leaving the tree
 * structurally complete.
 */

import { DiagCode, RESERVED_BUILTINS, TokenKind, makeSpan } from "@blend65/core";
import type {
  AssignExprNode,
  AssignOp,
  BinaryExprNode,
  BinaryOp,
  CallExprNode,
  CastExprNode,
  ConditionalExprNode,
  EmbedExprNode,
  ErrorExprNode,
  ExprNode,
  FieldAccessExprNode,
  IdentExprNode,
  IndexExprNode,
  IntrinsicCallExprNode,
  StructLitExprNode,
  StructLitFieldNode,
  Token,
  UnaryExprNode,
  UnaryOp,
} from "@blend65/core";
import type { ParserState } from "./state.js";
import { parseType } from "./parse-type.js";

// ───────────────────────────────────────────────────────────────────────────
// Binding-power tables (RD-03 §4.9). Lower BP = lower precedence.
// ───────────────────────────────────────────────────────────────────────────

/** Level 1 — assignment (right-associative): LBP 2, RBP 1. */
const ASSIGN_LBP = 2;
const ASSIGN_RBP = 1;
/** Level 2 — conditional `?:` (right-associative): LBP 4, RBP 3. */
const TERNARY_LBP = 4;
const TERNARY_RBP = 3;
/** Level 13 — prefix unary / cast operand binding power. */
const PREFIX_RBP = 25;
/** Level 14 — postfix `. [] ()` (left-associative, tightest). */
const POSTFIX_LBP = 27;

/** Assignment operator tokens → their {@link AssignOp} spelling. */
const ASSIGN_OPS: ReadonlyMap<string, AssignOp> = new Map([
  [TokenKind.Equal, "="],
  [TokenKind.PlusEqual, "+="],
  [TokenKind.MinusEqual, "-="],
  [TokenKind.StarEqual, "*="],
  [TokenKind.SlashEqual, "/="],
  [TokenKind.PercentEqual, "%="],
  [TokenKind.AmpersandEqual, "&="],
  [TokenKind.PipeEqual, "|="],
  [TokenKind.CaretEqual, "^="],
  [TokenKind.ShiftLeftEqual, "<<="],
  [TokenKind.ShiftRightEqual, ">>="],
]);

/** A binary operator's spelling and its left/right binding powers. */
interface BinaryInfo {
  readonly op: BinaryOp;
  readonly lbp: number;
  readonly rbp: number;
}

/** Binary operator tokens → spelling + binding powers (levels 3–12). */
const BINARY_OPS: ReadonlyMap<string, BinaryInfo> = new Map([
  [TokenKind.LogicalOr, { op: "||", lbp: 5, rbp: 6 }],
  [TokenKind.LogicalAnd, { op: "&&", lbp: 7, rbp: 8 }],
  [TokenKind.Pipe, { op: "|", lbp: 9, rbp: 10 }],
  [TokenKind.Caret, { op: "^", lbp: 11, rbp: 12 }],
  [TokenKind.Ampersand, { op: "&", lbp: 13, rbp: 14 }],
  [TokenKind.EqualEqual, { op: "==", lbp: 15, rbp: 16 }],
  [TokenKind.BangEqual, { op: "!=", lbp: 15, rbp: 16 }],
  [TokenKind.Less, { op: "<", lbp: 17, rbp: 18 }],
  [TokenKind.Greater, { op: ">", lbp: 17, rbp: 18 }],
  [TokenKind.LessEqual, { op: "<=", lbp: 17, rbp: 18 }],
  [TokenKind.GreaterEqual, { op: ">=", lbp: 17, rbp: 18 }],
  [TokenKind.ShiftLeft, { op: "<<", lbp: 19, rbp: 20 }],
  [TokenKind.ShiftRight, { op: ">>", lbp: 19, rbp: 20 }],
  [TokenKind.Plus, { op: "+", lbp: 21, rbp: 22 }],
  [TokenKind.Minus, { op: "-", lbp: 21, rbp: 22 }],
  [TokenKind.Star, { op: "*", lbp: 23, rbp: 24 }],
  [TokenKind.Slash, { op: "/", lbp: 23, rbp: 24 }],
  [TokenKind.Percent, { op: "%", lbp: 23, rbp: 24 }],
]);

/** Prefix unary operator tokens → their {@link UnaryOp} spelling. */
const UNARY_OPS: ReadonlyMap<string, UnaryOp> = new Map([
  [TokenKind.Minus, "-"],
  [TokenKind.Bang, "!"],
  [TokenKind.Tilde, "~"],
  [TokenKind.Ampersand, "&"],
]);

// ───────────────────────────────────────────────────────────────────────────
// Public entry points
// ───────────────────────────────────────────────────────────────────────────

/**
 * Parses an expression whose operators bind tighter than `minBP`. Call with
 * `minBP = 0` for a full expression. `allowStructLiteral` permits `Ident { … }`
 * struct literals (FR-45) — true only in initialiser context (after `=`).
 */
export function parseExpression(
  state: ParserState,
  minBP: number,
  allowStructLiteral: boolean,
): ExprNode {
  const { cursor, sourceId } = state;
  let lhs = parsePrefix(state, allowStructLiteral);

  for (;;) {
    const k = cursor.peekKind();

    // Postfix `. [] ()` — tightest, left-associative.
    if (
      POSTFIX_LBP > minBP &&
      (k === TokenKind.Dot || k === TokenKind.LBracket || k === TokenKind.LParen)
    ) {
      lhs = parsePostfix(state, lhs);
      continue;
    }

    // Assignment (right-associative).
    const assignOp = ASSIGN_OPS.get(k);
    if (assignOp !== undefined && ASSIGN_LBP > minBP) {
      cursor.advance();
      const value = parseExpression(state, ASSIGN_RBP, allowStructLiteral);
      const node: AssignExprNode = {
        kind: "AssignExpr",
        op: assignOp,
        target: lhs,
        value,
        span: makeSpan(sourceId, lhs.span.start, value.span.end),
      };
      lhs = node;
      continue;
    }

    // Conditional `? :` (right-associative).
    if (k === TokenKind.Question && TERNARY_LBP > minBP) {
      cursor.advance();
      const whenTrue = parseExpression(state, 0, allowStructLiteral);
      cursor.expect(TokenKind.Colon, DiagCode.ExpectedColon, "':' in conditional expression");
      const whenFalse = parseExpression(state, TERNARY_RBP, allowStructLiteral);
      const node: ConditionalExprNode = {
        kind: "ConditionalExpr",
        condition: lhs,
        whenTrue,
        whenFalse,
        span: makeSpan(sourceId, lhs.span.start, whenFalse.span.end),
      };
      lhs = node;
      continue;
    }

    // Binary operators (left-associative).
    const bin = BINARY_OPS.get(k);
    if (bin !== undefined && bin.lbp > minBP) {
      cursor.advance();
      const right = parseExpression(state, bin.rbp, allowStructLiteral);
      const node: BinaryExprNode = {
        kind: "BinaryExpr",
        op: bin.op,
        left: lhs,
        right,
        span: makeSpan(sourceId, lhs.span.start, right.span.end),
      };
      lhs = node;
      continue;
    }

    break;
  }

  return lhs;
}

/**
 * Parses a single primary expression (Phase 3 compatibility shim): an
 * expression with struct literals disabled. Retained so the declaration / type /
 * statement layers that imported `parsePrimaryExpr` keep their call sites while
 * transparently gaining the full operator parser (FR-11 additive evolution).
 */
export function parsePrimaryExpr(state: ParserState): ExprNode {
  return parseExpression(state, 0, false);
}

// ───────────────────────────────────────────────────────────────────────────
// Prefix / primary
// ───────────────────────────────────────────────────────────────────────────

/** Parses a prefix expression: unary operator, cast, or a primary. */
function parsePrefix(state: ParserState, allowStructLiteral: boolean): ExprNode {
  const { cursor, sourceId } = state;
  const tok = cursor.peek();

  // Prefix unary `- ! ~ &` (FR-40). `&` here is address-of, not bitwise-and.
  const unaryOp = UNARY_OPS.get(tok.kind);
  if (unaryOp !== undefined) {
    cursor.advance();
    const operand = parseExpression(state, PREFIX_RBP, allowStructLiteral);
    const node: UnaryExprNode = {
      kind: "UnaryExpr",
      op: unaryOp,
      operand,
      span: makeSpan(sourceId, tok.span.start, operand.span.end),
    };
    return node;
  }

  // Prefix `<type>(expr)` cast (FR-40). `<` here is never a comparison.
  if (tok.kind === TokenKind.Less) {
    cursor.advance(); // '<'
    const targetType = parseType(state);
    cursor.expect(TokenKind.Greater, DiagCode.UnexpectedToken, "'>' to close cast type");
    const operand = parseExpression(state, PREFIX_RBP, allowStructLiteral);
    const node: CastExprNode = {
      kind: "CastExpr",
      targetType,
      operand,
      span: makeSpan(sourceId, tok.span.start, operand.span.end),
    };
    return node;
  }

  return parsePrimary(state, allowStructLiteral);
}

/** Parses a primary expression (literal, identifier-form, or `( expr )`). */
function parsePrimary(state: ParserState, allowStructLiteral: boolean): ExprNode {
  const { cursor, sourceId } = state;
  const tok = cursor.peek();

  switch (tok.kind) {
    case TokenKind.Number: {
      cursor.advance();
      return {
        kind: "NumericLitExpr",
        value: typeof tok.value === "number" ? tok.value : 0,
        raw: cursor.lexeme(tok),
        span: tok.span,
      };
    }
    case TokenKind.KwTrue:
    case TokenKind.KwFalse: {
      cursor.advance();
      return { kind: "BoolLitExpr", value: tok.kind === TokenKind.KwTrue, span: tok.span };
    }
    case TokenKind.String: {
      cursor.advance();
      return {
        kind: "StringLitExpr",
        raw: typeof tok.value === "string" ? tok.value : cursor.lexeme(tok),
        span: tok.span,
      };
    }
    case TokenKind.Char: {
      cursor.advance();
      return {
        kind: "CharLitExpr",
        raw: typeof tok.value === "string" ? tok.value : cursor.lexeme(tok),
        span: tok.span,
      };
    }
    case TokenKind.LParen: {
      cursor.advance(); // '('
      const inner = parseExpression(state, 0, true);
      const close = cursor.expect(
        TokenKind.RParen,
        DiagCode.MissingCloseParen,
        "')' to close parenthesised expression",
      );
      // No `Paren` node (FR-42): re-wrap the inner expr's span over the parens.
      const end = close !== null ? close.span.end : inner.span.end;
      return { ...inner, span: makeSpan(sourceId, tok.span.start, end) };
    }
    case TokenKind.Identifier:
      return parseIdentifierForm(state, allowStructLiteral);
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

/**
 * Parses an identifier-led primary: an `embed(...)` expression, an intrinsic
 * call (name ∈ `RESERVED_BUILTINS`), a struct literal (initialiser context), or
 * a plain identifier reference (postfix calls/indexing handled by the loop).
 */
function parseIdentifierForm(state: ParserState, allowStructLiteral: boolean): ExprNode {
  const { cursor } = state;
  const nameTok = cursor.advance();

  const name = cursor.lexeme(nameTok);

  if (cursor.check(TokenKind.LParen)) {
    if (name === "embed") {
      return parseEmbed(state, nameTok);
    }
    if (RESERVED_BUILTINS.has(name)) {
      return parseIntrinsicCall(state, name, nameTok);
    }
  }

  if (allowStructLiteral && cursor.check(TokenKind.LBrace)) {
    return parseStructLiteral(state, name, nameTok);
  }

  const node: IdentExprNode = { kind: "IdentExpr", name, span: nameTok.span };
  return node;
}

/** Parses `embed( "path" [, format] )` (FR-44). */
function parseEmbed(state: ParserState, nameTok: Token): EmbedExprNode {
  const { cursor, sourceId } = state;
  cursor.advance(); // '('
  const pathTok = cursor.expect(TokenKind.String, DiagCode.ExpectedExpression, "embed path string");
  const path =
    pathTok !== null
      ? typeof pathTok.value === "string"
        ? pathTok.value
        : cursor.lexeme(pathTok)
      : "";
  const pathSpan = pathTok !== null ? pathTok.span : nameTok.span;

  let format: string | null = null;
  let formatSpan = null;
  if (cursor.check(TokenKind.Comma)) {
    cursor.advance();
    const fmtTok = cursor.expect(
      TokenKind.Identifier,
      DiagCode.ExpectedIdentifier,
      "embed format identifier",
    );
    if (fmtTok !== null) {
      format = cursor.lexeme(fmtTok);
      formatSpan = fmtTok.span;
    }
  }
  const close = cursor.expect(TokenKind.RParen, DiagCode.MissingCloseParen, "')' to close embed");
  const end = close !== null ? close.span.end : pathSpan.end;
  return {
    kind: "EmbedExpr",
    path,
    pathSpan,
    format,
    formatSpan,
    span: makeSpan(sourceId, nameTok.span.start, end),
  };
}

/**
 * Parses an intrinsic call `name( … )` (AR-3, FR-43). `sizeof`/`offsetof` take a
 * type as the first argument; `offsetof` additionally takes a field identifier.
 * All others take comma-separated expression arguments.
 */
function parseIntrinsicCall(
  state: ParserState,
  name: string,
  nameTok: Token,
): IntrinsicCallExprNode {
  const { cursor, sourceId } = state;
  cursor.advance(); // '('

  const args: ExprNode[] = [];
  let typeArg: IntrinsicCallExprNode["typeArg"] = null;
  let fieldArg: IntrinsicCallExprNode["fieldArg"] = null;

  if (name === "sizeof" || name === "offsetof") {
    typeArg = parseType(state);
    if (name === "offsetof" && cursor.check(TokenKind.Comma)) {
      cursor.advance();
      const fieldTok = cursor.expect(
        TokenKind.Identifier,
        DiagCode.ExpectedIdentifier,
        "field name in offsetof",
      );
      if (fieldTok !== null) {
        fieldArg = { name: cursor.lexeme(fieldTok), span: fieldTok.span };
      }
    }
  } else if (!cursor.check(TokenKind.RParen)) {
    args.push(parseExpression(state, 0, true));
    while (cursor.check(TokenKind.Comma)) {
      cursor.advance();
      args.push(parseExpression(state, 0, true));
    }
  }

  const close = cursor.expect(
    TokenKind.RParen,
    DiagCode.MissingCloseParen,
    "')' to close intrinsic call",
  );
  const end = close !== null ? close.span.end : nameTok.span.end;
  return {
    kind: "IntrinsicCallExpr",
    name,
    nameSpan: nameTok.span,
    args,
    typeArg,
    fieldArg,
    span: makeSpan(sourceId, nameTok.span.start, end),
  };
}

/** Parses a struct literal `TypeName { field: expr, … }` (FR-45). */
function parseStructLiteral(
  state: ParserState,
  typeName: string,
  nameTok: Token,
): StructLitExprNode {
  const { cursor, sourceId } = state;
  cursor.advance(); // '{'

  const fields: StructLitFieldNode[] = [];
  while (!cursor.atEnd() && !cursor.check(TokenKind.RBrace)) {
    const fieldTok = cursor.expect(
      TokenKind.Identifier,
      DiagCode.ExpectedIdentifier,
      "struct field name",
    );
    const fieldName = fieldTok !== null ? cursor.lexeme(fieldTok) : "";
    const fieldStart = fieldTok !== null ? fieldTok.span.start : state.here().start;
    const fieldNameSpan =
      fieldTok !== null ? fieldTok.span : makeSpan(sourceId, fieldStart, fieldStart);
    cursor.expect(TokenKind.Colon, DiagCode.ExpectedColon, "':' after struct field name");
    const value = parseExpression(state, 0, true);
    fields.push({
      kind: "StructLitField",
      name: fieldName,
      nameSpan: fieldNameSpan,
      value,
      span: makeSpan(sourceId, fieldStart, value.span.end),
    });
    if (cursor.check(TokenKind.Comma)) {
      cursor.advance(); // trailing comma allowed: loop re-checks for '}'
      continue;
    }
    break;
  }
  const close = cursor.expect(
    TokenKind.RBrace,
    DiagCode.MissingCloseBrace,
    "'}' to close struct literal",
  );
  const end = close !== null ? close.span.end : nameTok.span.end;
  return {
    kind: "StructLitExpr",
    typeName,
    typeNameSpan: nameTok.span,
    fields,
    span: makeSpan(sourceId, nameTok.span.start, end),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Postfix
// ───────────────────────────────────────────────────────────────────────────

/** Parses one postfix operator (`.field` / `[index]` / `(args)`) onto `lhs`. */
function parsePostfix(state: ParserState, lhs: ExprNode): ExprNode {
  const { cursor, sourceId } = state;
  const k = cursor.peekKind();

  if (k === TokenKind.Dot) {
    cursor.advance(); // '.'
    const fieldTok = cursor.expect(TokenKind.Identifier, DiagCode.ExpectedIdentifier, "field name");
    const field = fieldTok !== null ? cursor.lexeme(fieldTok) : "";
    const fieldSpan = fieldTok !== null ? fieldTok.span : lhs.span;
    const node: FieldAccessExprNode = {
      kind: "FieldAccessExpr",
      object: lhs,
      field,
      fieldSpan,
      span: makeSpan(sourceId, lhs.span.start, fieldSpan.end),
    };
    return node;
  }

  if (k === TokenKind.LBracket) {
    cursor.advance(); // '['
    const index = parseExpression(state, 0, true);
    const close = cursor.expect(
      TokenKind.RBracket,
      DiagCode.MissingCloseBracket,
      "']' to close index",
    );
    const end = close !== null ? close.span.end : index.span.end;
    const node: IndexExprNode = {
      kind: "IndexExpr",
      object: lhs,
      index,
      span: makeSpan(sourceId, lhs.span.start, end),
    };
    return node;
  }

  // k === TokenKind.LParen — a call.
  cursor.advance(); // '('
  const args: ExprNode[] = [];
  if (!cursor.check(TokenKind.RParen)) {
    args.push(parseExpression(state, 0, true));
    while (cursor.check(TokenKind.Comma)) {
      cursor.advance();
      args.push(parseExpression(state, 0, true));
    }
  }
  const close = cursor.expect(TokenKind.RParen, DiagCode.MissingCloseParen, "')' to close call");
  const end = close !== null ? close.span.end : lhs.span.end;
  const node: CallExprNode = {
    kind: "CallExpr",
    callee: lhs,
    args,
    span: makeSpan(sourceId, lhs.span.start, end),
  };
  return node;
}
