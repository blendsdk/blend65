/**
 * Declaration parsers (grammar §3; FR-16..FR-23).
 *
 * Top-level (and, for let/const, local) declarations: function, interrupt,
 * struct, enum, let, const, zeropage — plus the `export` modifier rules
 * (E10311) and the empty-/missing-initialiser diagnostics
 * (E10314/E10315/E10316). Each parser is panic-tolerant: it appends diagnostics
 * to the shared bag via {@link ParserState.emit} and keeps the tree structurally
 * complete; it never throws (FR-4).
 *
 * The function/interrupt body is parsed by {@link parseBlock}, which lives in
 * `parse-stmt.ts` (the statement layer, Phase 4). Phase 3 shipped a local
 * empty-body stub; wiring in the real block parser is an additive change (FR-11)
 * that leaves the declaration parsers below untouched.
 */

import { DiagCode, TokenKind, makeSpan } from "@blend65/core";
import type {
  ConstDeclNode,
  EnumDeclNode,
  EnumMemberNode,
  ExprNode,
  FunctionDeclNode,
  InterruptDeclNode,
  LetDeclNode,
  ParameterNode,
  StructDeclNode,
  StructFieldNode,
  TopLevelItem,
  TypeNode,
  ZeropageBlockNode,
  ZeropageFieldNode,
} from "@blend65/core";
import type { ParserState } from "./state.js";
import { parseType } from "./parse-type.js";
import { parseExpression, parsePrimaryExpr } from "./parse-expr.js";
import { parseBlock } from "./parse-stmt.js";

/**
 * Guarantees forward progress inside an item-list loop (FR-4): if the most recent
 * iteration consumed no token (a stuck error state), skip exactly one so the loop
 * cannot spin forever. `before` is the start offset captured before the iteration.
 * The lexer guarantees monotonically-increasing spans, so an unchanged start means
 * nothing was consumed. Mirrors the guard already used by `parseBlock` (FR-5/6).
 */
function ensureProgress(state: ParserState, before: number): void {
  const { cursor } = state;
  if (cursor.peek().span.start === before && !cursor.atEnd() && !cursor.check(TokenKind.RBrace)) {
    cursor.advance();
  }
}

/** Parses a single `name: type` parameter (FR-17). */
function parseParameter(state: ParserState): ParameterNode {
  const { cursor, sourceId } = state;
  const nameTok = cursor.expect(
    TokenKind.Identifier,
    DiagCode.ExpectedIdentifier,
    "parameter name",
  );
  const name = nameTok !== null ? cursor.lexeme(nameTok) : "";
  const start = nameTok !== null ? nameTok.span.start : state.here().start;
  const nameSpan = nameTok !== null ? nameTok.span : makeSpan(sourceId, start, start);
  cursor.expect(TokenKind.Colon, DiagCode.ExpectedColon, "':' after parameter name");
  const paramType = parseType(state);
  return {
    kind: "Parameter",
    name,
    nameSpan,
    paramType,
    span: makeSpan(sourceId, start, paramType.span.end),
  };
}

/** Parses a comma-separated parameter list inside `( ... )` (FR-17). */
function parseParameterList(state: ParserState): ParameterNode[] {
  const { cursor } = state;
  const params: ParameterNode[] = [];
  cursor.expect(TokenKind.LParen, DiagCode.MissingCloseParen, "'(' after function name");
  if (!cursor.check(TokenKind.RParen)) {
    for (;;) {
      params.push(parseParameter(state));
      if (cursor.check(TokenKind.Comma)) {
        cursor.advance();
        continue;
      }
      break;
    }
  }

  cursor.expect(TokenKind.RParen, DiagCode.MissingCloseParen, "')' to close parameter list");

  return params;
}

/** Parses `function name(params): returnType { body }` (FR-16). */
export function parseFunctionDecl(
  state: ParserState,
  exported: boolean,
  startTok: number,
): FunctionDeclNode {
  const { cursor, sourceId } = state;
  cursor.advance(); // 'function'
  const nameTok = cursor.expect(TokenKind.Identifier, DiagCode.ExpectedIdentifier, "function name");
  const name = nameTok !== null ? cursor.lexeme(nameTok) : "";
  const nameSpan = nameTok !== null ? nameTok.span : makeSpan(sourceId, startTok, startTok);
  const params = parseParameterList(state);

  // Optional `: returnType` (grammar §3.2). Absent → implicit void.
  let returnType: TypeNode;
  if (cursor.check(TokenKind.Colon)) {
    cursor.advance();
    returnType = parseType(state);
  } else {
    returnType = {
      kind: "PrimitiveType",
      name: "void",
      span: makeSpan(sourceId, startTok, startTok),
    };
  }

  const body = parseBlock(state);
  return {
    kind: "FunctionDecl",
    exported,
    name,
    nameSpan,
    params,
    returnType,
    body,
    span: makeSpan(sourceId, startTok, body.span.end),
  };
}

/** Parses `interrupt function name() { body }` (FR-18). */
export function parseInterruptDecl(
  state: ParserState,
  exported: boolean,
  startTok: number,
): InterruptDeclNode {
  const { cursor, sourceId } = state;
  cursor.advance(); // 'interrupt'
  cursor.expect(TokenKind.KwFunction, DiagCode.UnexpectedToken, "'function' after 'interrupt'");
  const nameTok = cursor.expect(
    TokenKind.Identifier,
    DiagCode.ExpectedIdentifier,
    "interrupt name",
  );
  const name = nameTok !== null ? cursor.lexeme(nameTok) : "";
  const nameSpan = nameTok !== null ? nameTok.span : makeSpan(sourceId, startTok, startTok);
  cursor.expect(TokenKind.LParen, DiagCode.MissingCloseParen, "'(' after interrupt name");
  cursor.expect(
    TokenKind.RParen,
    DiagCode.MissingCloseParen,
    "')' (interrupts take no parameters)",
  );
  const body = parseBlock(state);
  return {
    kind: "InterruptDecl",
    exported,
    name,
    nameSpan,
    body,
    span: makeSpan(sourceId, startTok, body.span.end),
  };
}

/** Parses a single `name: type;` struct field (FR-19). */
function parseStructField(state: ParserState): StructFieldNode {
  const { cursor, sourceId } = state;
  const nameTok = cursor.expect(
    TokenKind.Identifier,
    DiagCode.ExpectedIdentifier,
    "struct field name",
  );
  const name = nameTok !== null ? cursor.lexeme(nameTok) : "";
  const start = nameTok !== null ? nameTok.span.start : state.here().start;
  const nameSpan = nameTok !== null ? nameTok.span : makeSpan(sourceId, start, start);
  cursor.expect(TokenKind.Colon, DiagCode.ExpectedColon, "':' after field name");
  const fieldType = parseType(state);
  let end = fieldType.span.end;
  const semi = cursor.expect(
    TokenKind.Semicolon,
    DiagCode.MissingSemicolon,
    "';' after struct field",
  );
  if (semi !== null) end = semi.span.end;
  return { kind: "StructField", name, nameSpan, fieldType, span: makeSpan(sourceId, start, end) };
}

/** Parses `struct Name { field; ... }` (FR-19); empty → E10316. */
export function parseStructDecl(
  state: ParserState,
  exported: boolean,
  startTok: number,
): StructDeclNode {
  const { cursor, sourceId } = state;
  cursor.advance(); // 'struct'
  const nameTok = cursor.expect(TokenKind.Identifier, DiagCode.ExpectedIdentifier, "struct name");
  const name = nameTok !== null ? cursor.lexeme(nameTok) : "";
  const nameSpan = nameTok !== null ? nameTok.span : makeSpan(sourceId, startTok, startTok);
  cursor.expect(TokenKind.LBrace, DiagCode.ExpectedBlock, "'{' to open struct body");

  const fields: StructFieldNode[] = [];
  while (!cursor.atEnd() && !cursor.check(TokenKind.RBrace)) {
    const before = cursor.peek().span.start;
    fields.push(parseStructField(state));
    ensureProgress(state, before);
  }
  const close = cursor.expect(TokenKind.RBrace, DiagCode.MissingCloseBrace, "'}' to close struct");

  const end = close !== null ? close.span.end : state.here().start;

  if (fields.length === 0) {
    state.emit(
      DiagCode.EmptyStructDeclaration,
      makeSpan(sourceId, startTok, end),
      "Empty 'struct' declaration — at least one field is required",
    );
  }
  return {
    kind: "StructDecl",
    exported,
    name,
    nameSpan,
    fields,
    span: makeSpan(sourceId, startTok, end),
  };
}

/** Parses a single `Name [= constExpr]` enum member (FR-20). */
function parseEnumMember(state: ParserState): EnumMemberNode {
  const { cursor, sourceId } = state;
  const nameTok = cursor.expect(
    TokenKind.Identifier,
    DiagCode.ExpectedIdentifier,
    "enum member name",
  );
  const name = nameTok !== null ? cursor.lexeme(nameTok) : "";
  const start = nameTok !== null ? nameTok.span.start : state.here().start;
  const nameSpan = nameTok !== null ? nameTok.span : makeSpan(sourceId, start, start);
  let value: ExprNode | null = null;
  let end = nameSpan.end;
  if (cursor.check(TokenKind.Equal)) {
    cursor.advance();
    value = parsePrimaryExpr(state);
    end = value.span.end;
  }
  return { kind: "EnumMember", name, nameSpan, value, span: makeSpan(sourceId, start, end) };
}

/** Parses `enum Name { A, B = 2, }` (FR-20); empty → E10315; trailing comma ok. */
export function parseEnumDecl(
  state: ParserState,
  exported: boolean,
  startTok: number,
): EnumDeclNode {
  const { cursor, sourceId } = state;
  cursor.advance(); // 'enum'
  const nameTok = cursor.expect(TokenKind.Identifier, DiagCode.ExpectedIdentifier, "enum name");
  const name = nameTok !== null ? cursor.lexeme(nameTok) : "";
  const nameSpan = nameTok !== null ? nameTok.span : makeSpan(sourceId, startTok, startTok);
  cursor.expect(TokenKind.LBrace, DiagCode.ExpectedBlock, "'{' to open enum body");

  const members: EnumMemberNode[] = [];
  while (!cursor.atEnd() && !cursor.check(TokenKind.RBrace)) {
    const before = cursor.peek().span.start;
    members.push(parseEnumMember(state));
    if (cursor.check(TokenKind.Comma)) {
      cursor.advance(); // trailing comma allowed: loop re-checks for '}'
      continue;
    }
    // A member with neither a trailing comma nor any consumed token is a stuck
    // error state — stop so the `}` recovery can run (FR-4).
    if (cursor.peek().span.start === before) break;
    break;
  }

  const close = cursor.expect(TokenKind.RBrace, DiagCode.MissingCloseBrace, "'}' to close enum");
  const end = close !== null ? close.span.end : state.here().start;

  if (members.length === 0) {
    state.emit(
      DiagCode.EmptyEnumDeclaration,
      makeSpan(sourceId, startTok, end),
      "Empty 'enum' declaration — at least one member is required",
    );
  }
  return {
    kind: "EnumDecl",
    exported,
    name,
    nameSpan,
    members,
    span: makeSpan(sourceId, startTok, end),
  };
}

/**
 * Parses `let name: type [= expr];` (FR-21). `let` initialiser is optional; the
 * trailing `;` is consumed when present.
 */
export function parseLetDecl(state: ParserState, exported: boolean, startTok: number): LetDeclNode {
  const { cursor, sourceId } = state;
  cursor.advance(); // 'let'
  const nameTok = cursor.expect(TokenKind.Identifier, DiagCode.ExpectedIdentifier, "variable name");
  const name = nameTok !== null ? cursor.lexeme(nameTok) : "";
  const nameSpan = nameTok !== null ? nameTok.span : makeSpan(sourceId, startTok, startTok);
  cursor.expect(TokenKind.Colon, DiagCode.ExpectedColon, "':' after variable name");
  const declaredType = parseType(state);

  let initialiser: ExprNode | null = null;
  if (cursor.check(TokenKind.Equal)) {
    cursor.advance();
    // Initialiser context (after `=`): struct literals are allowed (FR-45).
    initialiser = parseExpression(state, 0, true);
  }
  let end = initialiser !== null ? initialiser.span.end : declaredType.span.end;

  const semi = cursor.expect(
    TokenKind.Semicolon,
    DiagCode.MissingSemicolon,
    "';' after let declaration",
  );
  if (semi !== null) end = semi.span.end;

  return {
    kind: "LetDecl",
    exported,
    name,
    nameSpan,
    declaredType,
    initialiser,
    span: makeSpan(sourceId, startTok, end),
  };
}

/** Parses `const name: type = expr;` (FR-21); missing initialiser → E10314. */
export function parseConstDecl(
  state: ParserState,
  exported: boolean,
  startTok: number,
): ConstDeclNode {
  const { cursor, sourceId } = state;
  cursor.advance(); // 'const'
  const nameTok = cursor.expect(TokenKind.Identifier, DiagCode.ExpectedIdentifier, "constant name");
  const name = nameTok !== null ? cursor.lexeme(nameTok) : "";
  const nameSpan = nameTok !== null ? nameTok.span : makeSpan(sourceId, startTok, startTok);
  cursor.expect(TokenKind.Colon, DiagCode.ExpectedColon, "':' after constant name");
  const declaredType = parseType(state);

  let initialiser: ExprNode;
  if (cursor.check(TokenKind.Equal)) {
    cursor.advance();
    // Initialiser context (after `=`): aggregate literals are allowed — the
    // grammar's const_expression is a full expression, so `const` takes the
    // same literal forms as `let` (FR-45).
    initialiser = parseExpression(state, 0, true);
  } else {
    state.emit(
      DiagCode.MissingConstInitialiser,
      state.here(),
      "Missing '=' in const declaration — an initialiser is required",
    );
    // Keep the tree complete with an error-expr sentinel at the current point.
    initialiser = {
      kind: "ErrorExpr",
      span: makeSpan(sourceId, state.here().start, state.here().start),
    };
  }
  let end = initialiser.span.end;
  const semi = cursor.expect(
    TokenKind.Semicolon,
    DiagCode.MissingSemicolon,
    "';' after const declaration",
  );
  if (semi !== null) end = semi.span.end;

  return {
    kind: "ConstDecl",
    exported,
    name,
    nameSpan,
    declaredType,
    initialiser,
    span: makeSpan(sourceId, startTok, end),
  };
}

/** Parses a single `name: type [= constExpr];` zeropage field (FR-22). */
function parseZeropageField(state: ParserState): ZeropageFieldNode {
  const { cursor, sourceId } = state;
  const nameTok = cursor.expect(
    TokenKind.Identifier,
    DiagCode.ExpectedIdentifier,
    "zeropage variable name",
  );
  const name = nameTok !== null ? cursor.lexeme(nameTok) : "";
  const start = nameTok !== null ? nameTok.span.start : state.here().start;
  const nameSpan = nameTok !== null ? nameTok.span : makeSpan(sourceId, start, start);
  cursor.expect(TokenKind.Colon, DiagCode.ExpectedColon, "':' after zeropage variable name");
  const fieldType = parseType(state);

  let initialiser: ExprNode | null = null;
  if (cursor.check(TokenKind.Equal)) {
    cursor.advance();
    initialiser = parsePrimaryExpr(state);
  }
  let end = initialiser !== null ? initialiser.span.end : fieldType.span.end;
  const semi = cursor.expect(
    TokenKind.Semicolon,
    DiagCode.MissingSemicolon,
    "';' after zeropage field",
  );
  if (semi !== null) end = semi.span.end;

  return {
    kind: "ZeropageField",
    name,
    nameSpan,
    fieldType,
    initialiser,
    span: makeSpan(sourceId, start, end),
  };
}

/** Parses `zeropage { field; ... }` (FR-22). */
export function parseZeropageBlock(state: ParserState, startTok: number): ZeropageBlockNode {
  const { cursor, sourceId } = state;
  cursor.advance(); // 'zeropage'
  cursor.expect(TokenKind.LBrace, DiagCode.ExpectedBlock, "'{' to open zeropage block");

  const fields: ZeropageFieldNode[] = [];
  while (!cursor.atEnd() && !cursor.check(TokenKind.RBrace)) {
    const before = cursor.peek().span.start;
    fields.push(parseZeropageField(state));
    ensureProgress(state, before);
  }
  const close = cursor.expect(
    TokenKind.RBrace,
    DiagCode.MissingCloseBrace,
    "'}' to close zeropage block",
  );

  const end = close !== null ? close.span.end : state.here().start;
  return { kind: "ZeropageBlock", fields, span: makeSpan(sourceId, startTok, end) };
}

/**
 * The set of declaration keywords legal after `export` (FR-23). `interrupt` and
 * `zeropage` are deliberately excluded — `export` on them is E10311.
 */
const EXPORTABLE: ReadonlySet<string> = new Set([
  TokenKind.KwFunction,
  TokenKind.KwStruct,
  TokenKind.KwEnum,
  TokenKind.KwLet,
  TokenKind.KwConst,
]);

/**
 * Parses an `export`-prefixed declaration (FR-23). After consuming `export`,
 * dispatches on the following keyword; `export interrupt` / `export zeropage`
 * (and any other non-exportable token) emit **E10311** but still parse the
 * underlying declaration so the tree stays complete.
 */
export function parseExportedDecl(state: ParserState): TopLevelItem {
  const { cursor } = state;
  const exportTok = cursor.advance(); // 'export'
  const start = exportTok.span.start;
  const next = cursor.peekKind();

  if (!EXPORTABLE.has(next)) {
    state.emit(
      DiagCode.ExportNotAllowed,
      cursor.peek().span,
      "'export' is not allowed on this declaration",
    );
  }
  return parseDeclByKeyword(state, true, start);
}

/**
 * Dispatches to the declaration parser matching the current keyword. Shared by
 * the top-level loop and {@link parseExportedDecl}. Assumes the caller has
 * verified the current token is a declaration keyword.
 */
export function parseDeclByKeyword(
  state: ParserState,
  exported: boolean,
  startTok: number,
): TopLevelItem {
  switch (state.cursor.peekKind()) {
    case TokenKind.KwFunction:
      return parseFunctionDecl(state, exported, startTok);
    case TokenKind.KwInterrupt:
      return parseInterruptDecl(state, exported, startTok);
    case TokenKind.KwStruct:
      return parseStructDecl(state, exported, startTok);
    case TokenKind.KwEnum:
      return parseEnumDecl(state, exported, startTok);
    case TokenKind.KwLet:
      return parseLetDecl(state, exported, startTok);
    case TokenKind.KwConst:
      return parseConstDecl(state, exported, startTok);
    case TokenKind.KwZeropage:
      return parseZeropageBlock(state, startTok);
    default:
      // The caller only dispatches here for known declaration keywords; an
      // unexpected token after `export` falls back to a function-shaped parse
      // so a sentinel + recovery still occurs upstream.
      return parseFunctionDecl(state, exported, startTok);
  }
}
