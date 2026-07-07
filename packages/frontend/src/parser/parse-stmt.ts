/**
 * Statement parsers (grammar §3; FR-24..FR-36).
 *
 * The statement layer: blocks, `if`/`else` (composed else-if), `while`,
 * `do`/`while`, `for` (`to`/`downto`/`step`), `switch`/`case`/`default`,
 * `return`/`break`/`continue`/`fallthrough`, local `let`/`const` declarations,
 * the `type` reservation (E10224), and the catch-all expression statement.
 *
 * This module owns the real {@link parseBlock} (Phase 3 shipped an
 * empty-body stub in `parse-decl.ts`); wiring it here is an additive change
 * (FR-11) — the declaration parsers call `parseBlock` unchanged. Conditions and
 * loop bounds are parsed with {@link parsePrimaryExpr}; Phase 5 swaps in the full
 * Pratt parser at that same entry point (FR-11), so nothing here changes then.
 *
 * Every parser is panic-tolerant: it appends diagnostics through
 * {@link ParserState.emit} (cascade-suppressed, FR-7) or the cursor's `expect`,
 * keeps the tree structurally complete with sentinels, and never throws (FR-4).
 * `to`, `downto`, and `step` are contextual keywords — lexed as `Identifier` and
 * recognised here by their text (FR-29); `fallthrough` is a real keyword.
 */

import { DiagCode, TokenKind, makeSpan } from "@blend65/core";
import type {
  BlockNode,
  BreakStmtNode,
  CaseClauseNode,
  ContinueStmtNode,
  DefaultClauseNode,
  DoWhileStmtNode,
  ErrorStmtNode,
  ExpressionStmtNode,
  ExprNode,
  FallthroughStmtNode,
  ForStmtNode,
  IfStmtNode,
  ReturnStmtNode,
  StmtNode,
  SwitchStmtNode,
  TypeNode,
  WhileStmtNode,
} from "@blend65/core";
import type { ParserState } from "./state.js";
import { parseType } from "./parse-type.js";
import { parsePrimaryExpr } from "./parse-expr.js";
import { parseConstDecl, parseLetDecl } from "./parse-decl.js";

/** Statement-list tokens that end a block / clause body. */
function atBodyEnd(state: ParserState): boolean {
  const { cursor } = state;
  return cursor.atEnd() || cursor.check(TokenKind.RBrace);
}

/**
 * Parses a `{ statement* }` block (FR-24). The single real block parser used by
 * function/interrupt bodies and every nested statement. Panic is cleared on
 * entry and exit so each block is a fresh diagnostic region.
 */
export function parseBlock(state: ParserState): BlockNode {
  const { cursor, sourceId } = state;
  const open = cursor.expect(TokenKind.LBrace, DiagCode.ExpectedBlock, "'{' to open block");
  const start = open !== null ? open.span.start : state.here().start;
  state.clearPanic();

  const statements: StmtNode[] = [];
  let end = open !== null ? open.span.end : start;
  while (!atBodyEnd(state)) {
    const before = cursor.peek().span.start;
    const stmt = parseStatement(state);
    statements.push(stmt);
    end = stmt.span.end;
    // Guarantee forward progress: if a stuck error state consumed nothing,
    // skip one token so the loop cannot spin forever (FR-4).
    if (cursor.peek().span.start === before && !atBodyEnd(state)) {
      cursor.advance();
    }
  }
  const close = cursor.expect(TokenKind.RBrace, DiagCode.MissingCloseBrace, "'}' to close block");
  if (close !== null) end = close.span.end;
  state.clearPanic();
  return { kind: "Block", statements, span: makeSpan(sourceId, start, end) };
}

/** Parses `if (cond) block [else (if | block)]` (FR-25); else-if is composed. */
function parseIf(state: ParserState): IfStmtNode {
  const { cursor, sourceId } = state;
  const ifTok = cursor.advance(); // 'if'
  cursor.expect(TokenKind.LParen, DiagCode.MissingCloseParen, "'(' after 'if'");
  const condition = parsePrimaryExpr(state);
  cursor.expect(TokenKind.RParen, DiagCode.MissingCloseParen, "')' after if condition");
  const thenBlock = parseBlock(state);

  let elseClause: IfStmtNode | BlockNode | null = null;
  let end = thenBlock.span.end;
  if (cursor.check(TokenKind.KwElse)) {
    cursor.advance(); // 'else'
    if (cursor.check(TokenKind.KwIf)) {
      const nested = parseIf(state);
      elseClause = nested;
      end = nested.span.end;
    } else {
      const block = parseBlock(state);
      elseClause = block;
      end = block.span.end;
    }
  }
  return {
    kind: "IfStmt",
    condition,
    thenBlock,
    elseClause,
    span: makeSpan(sourceId, ifTok.span.start, end),
  };
}

/** Parses `while (cond) block` (FR-26). */
function parseWhile(state: ParserState): WhileStmtNode {
  const { cursor, sourceId } = state;
  const whileTok = cursor.advance(); // 'while'
  cursor.expect(TokenKind.LParen, DiagCode.MissingCloseParen, "'(' after 'while'");
  const condition = parsePrimaryExpr(state);
  cursor.expect(TokenKind.RParen, DiagCode.MissingCloseParen, "')' after while condition");
  const body = parseBlock(state);
  return {
    kind: "WhileStmt",
    condition,
    body,
    span: makeSpan(sourceId, whileTok.span.start, body.span.end),
  };
}

/** Parses `do block while (cond);` (FR-27); missing trailing `;` → E10305. */
function parseDoWhile(state: ParserState): DoWhileStmtNode {
  const { cursor, sourceId } = state;
  const doTok = cursor.advance(); // 'do'
  const body = parseBlock(state);
  cursor.expect(TokenKind.KwWhile, DiagCode.UnexpectedToken, "'while' after do-block");
  cursor.expect(TokenKind.LParen, DiagCode.MissingCloseParen, "'(' after 'while'");
  const condition = parsePrimaryExpr(state);
  const rparen = cursor.expect(
    TokenKind.RParen,
    DiagCode.MissingCloseParen,
    "')' after do-while condition",
  );
  let end = rparen !== null ? rparen.span.end : condition.span.end;
  const semi = cursor.expect(TokenKind.Semicolon, DiagCode.MissingSemicolon, "';' after do-while");
  if (semi !== null) end = semi.span.end;
  return {
    kind: "DoWhileStmt",
    body,
    condition,
    span: makeSpan(sourceId, doTok.span.start, end),
  };
}

/**
 * Parses `for (let name [: type] = init (to | downto) bound [step expr]) block`
 * (FR-28/29). `to`/`downto`/`step` are contextual `Identifier`s matched by text;
 * a direction that is neither `to` nor `downto` emits **E10309**.
 */
function parseFor(state: ParserState): ForStmtNode {
  const { cursor, sourceId } = state;
  const forTok = cursor.advance(); // 'for'
  cursor.expect(TokenKind.LParen, DiagCode.MissingCloseParen, "'(' after 'for'");
  cursor.expect(TokenKind.KwLet, DiagCode.UnexpectedToken, "'let' in for-loop header");

  const nameTok = cursor.expect(
    TokenKind.Identifier,
    DiagCode.ExpectedIdentifier,
    "loop variable name",
  );
  const varName = nameTok !== null ? cursor.lexeme(nameTok) : "";
  const varNameSpan =
    nameTok !== null ? nameTok.span : makeSpan(sourceId, forTok.span.start, forTok.span.start);

  let varType: TypeNode | null = null;
  if (cursor.check(TokenKind.Colon)) {
    cursor.advance();
    varType = parseType(state);
  }
  cursor.expect(TokenKind.Equal, DiagCode.UnexpectedToken, "'=' in for-loop header");
  const init = parsePrimaryExpr(state);

  // Direction: contextual `to` / `downto` (FR-29). Neither → E10309.
  let direction: "to" | "downto" = "to";
  const dirTok = cursor.peek();
  const dirText = dirTok.kind === TokenKind.Identifier ? cursor.lexeme(dirTok) : "";
  if (dirText === "to" || dirText === "downto") {
    cursor.advance();
    direction = dirText;
  } else {
    state.emit(DiagCode.ExpectedToOrDownto, dirTok.span, "Expected 'to' or 'downto' in for-loop");
  }
  const bound = parsePrimaryExpr(state);

  // Optional contextual `step` expr.
  let step: ExprNode | null = null;
  const stepTok = cursor.peek();
  if (stepTok.kind === TokenKind.Identifier && cursor.lexeme(stepTok) === "step") {
    cursor.advance();
    step = parsePrimaryExpr(state);
  }

  cursor.expect(TokenKind.RParen, DiagCode.MissingCloseParen, "')' to close for-loop header");
  const body = parseBlock(state);
  return {
    kind: "ForStmt",
    varName,
    varNameSpan,
    varType,
    init,
    direction,
    bound,
    step,
    body,
    span: makeSpan(sourceId, forTok.span.start, body.span.end),
  };
}

/** Parses `case v1 [, v2]* : stmt*` (FR-31); body runs to next case/default/`}`. */
function parseCaseClause(state: ParserState): CaseClauseNode {
  const { cursor, sourceId } = state;
  const caseTok = cursor.advance(); // 'case'
  const values: ExprNode[] = [parsePrimaryExpr(state)];
  while (cursor.check(TokenKind.Comma)) {
    cursor.advance();
    values.push(parsePrimaryExpr(state));
  }
  const colon = cursor.expect(TokenKind.Colon, DiagCode.ExpectedColon, "':' after case values");
  let end = colon !== null ? colon.span.end : caseTok.span.end;

  const body: StmtNode[] = [];
  while (
    !cursor.atEnd() &&
    !cursor.check(TokenKind.KwCase) &&
    !cursor.check(TokenKind.KwDefault) &&
    !cursor.check(TokenKind.RBrace)
  ) {
    const before = cursor.peek().span.start;
    const stmt = parseStatement(state);
    body.push(stmt);
    end = stmt.span.end;
    if (cursor.peek().span.start === before && !cursor.atEnd()) {
      cursor.advance();
    }
  }
  return { kind: "CaseClause", values, body, span: makeSpan(sourceId, caseTok.span.start, end) };
}

/** Parses `default : stmt*` (FR-32); body runs to next case/default/`}`. */
function parseDefaultClause(state: ParserState): DefaultClauseNode {
  const { cursor, sourceId } = state;
  const defaultTok = cursor.advance(); // 'default'
  const colon = cursor.expect(TokenKind.Colon, DiagCode.ExpectedColon, "':' after 'default'");
  let end = colon !== null ? colon.span.end : defaultTok.span.end;

  const body: StmtNode[] = [];
  while (
    !cursor.atEnd() &&
    !cursor.check(TokenKind.KwCase) &&
    !cursor.check(TokenKind.KwDefault) &&
    !cursor.check(TokenKind.RBrace)
  ) {
    const before = cursor.peek().span.start;
    const stmt = parseStatement(state);
    body.push(stmt);
    end = stmt.span.end;
    if (cursor.peek().span.start === before && !cursor.atEnd()) {
      cursor.advance();
    }
  }
  return { kind: "DefaultClause", body, span: makeSpan(sourceId, defaultTok.span.start, end) };
}

/**
 * Parses `switch (expr) { case* default }` (FR-30/32). The `default` clause is
 * mandatory — its absence emits **E10072** and a synthesised empty clause keeps
 * the tree structurally complete.
 */
function parseSwitch(state: ParserState): SwitchStmtNode {
  const { cursor, sourceId } = state;
  const swTok = cursor.advance(); // 'switch'
  cursor.expect(TokenKind.LParen, DiagCode.MissingCloseParen, "'(' after 'switch'");
  const discriminant = parsePrimaryExpr(state);
  cursor.expect(TokenKind.RParen, DiagCode.MissingCloseParen, "')' after switch discriminant");
  cursor.expect(TokenKind.LBrace, DiagCode.ExpectedBlock, "'{' to open switch body");
  state.clearPanic();

  const cases: CaseClauseNode[] = [];
  let defaultClause: DefaultClauseNode | null = null;
  while (!atBodyEnd(state)) {
    if (cursor.check(TokenKind.KwCase)) {
      cases.push(parseCaseClause(state));
    } else if (cursor.check(TokenKind.KwDefault)) {
      defaultClause = parseDefaultClause(state);
    } else {
      // Unexpected token in switch body — advance to make progress.
      cursor.advance();
    }
  }
  const close = cursor.expect(TokenKind.RBrace, DiagCode.MissingCloseBrace, "'}' to close switch");
  const end = close !== null ? close.span.end : state.here().start;

  if (defaultClause === null) {
    state.emit(
      DiagCode.MissingDefaultClause,
      makeSpan(sourceId, swTok.span.start, end),
      "Missing 'default' clause in 'switch' statement",
    );
    defaultClause = { kind: "DefaultClause", body: [], span: makeSpan(sourceId, end, end) };
  }
  return {
    kind: "SwitchStmt",
    discriminant,
    cases,
    defaultClause,
    span: makeSpan(sourceId, swTok.span.start, end),
  };
}

/** Parses `return [expr];` (FR-34). */
function parseReturn(state: ParserState): ReturnStmtNode {
  const { cursor, sourceId } = state;
  const retTok = cursor.advance(); // 'return'
  let value: ExprNode | null = null;
  let end = retTok.span.end;
  if (!cursor.check(TokenKind.Semicolon)) {
    value = parsePrimaryExpr(state);
    end = value.span.end;
  }
  const semi = cursor.expect(TokenKind.Semicolon, DiagCode.MissingSemicolon, "';' after 'return'");
  if (semi !== null) end = semi.span.end;
  return { kind: "ReturnStmt", value, span: makeSpan(sourceId, retTok.span.start, end) };
}

/** Parses `break;` (FR-34). */
function parseBreak(state: ParserState): BreakStmtNode {
  const { cursor, sourceId } = state;
  const tok = cursor.advance(); // 'break'
  let end = tok.span.end;
  const semi = cursor.expect(TokenKind.Semicolon, DiagCode.MissingSemicolon, "';' after 'break'");
  if (semi !== null) end = semi.span.end;
  return { kind: "BreakStmt", span: makeSpan(sourceId, tok.span.start, end) };
}

/** Parses `continue;` (FR-34). */
function parseContinue(state: ParserState): ContinueStmtNode {
  const { cursor, sourceId } = state;
  const tok = cursor.advance(); // 'continue'
  let end = tok.span.end;
  const semi = cursor.expect(
    TokenKind.Semicolon,
    DiagCode.MissingSemicolon,
    "';' after 'continue'",
  );
  if (semi !== null) end = semi.span.end;
  return { kind: "ContinueStmt", span: makeSpan(sourceId, tok.span.start, end) };
}

/** Parses `fallthrough;` (FR-33). */
function parseFallthrough(state: ParserState): FallthroughStmtNode {
  const { cursor, sourceId } = state;
  const tok = cursor.advance(); // 'fallthrough'
  let end = tok.span.end;
  const semi = cursor.expect(
    TokenKind.Semicolon,
    DiagCode.MissingSemicolon,
    "';' after 'fallthrough'",
  );
  if (semi !== null) end = semi.span.end;
  return { kind: "FallthroughStmt", span: makeSpan(sourceId, tok.span.start, end) };
}

/** Parses `expr;` (FR-35). Lvalue/call restriction is enforced later, during semantic analysis. */
function parseExpressionStmt(state: ParserState): ExpressionStmtNode {
  const { cursor, sourceId } = state;
  const start = cursor.peek().span.start;
  const expression = parsePrimaryExpr(state);
  let end = expression.span.end;
  const semi = cursor.expect(
    TokenKind.Semicolon,
    DiagCode.MissingSemicolon,
    "';' after expression statement",
  );
  if (semi !== null) end = semi.span.end;
  return { kind: "ExpressionStmt", expression, span: makeSpan(sourceId, start, end) };
}

/** Skips tokens up to and including the next `;` (statement-level recovery). */
function skipToSemicolon(state: ParserState): number {
  const { cursor } = state;
  let end = cursor.peek().span.end;
  while (!cursor.atEnd() && !cursor.check(TokenKind.RBrace)) {
    const tok = cursor.advance();
    end = tok.span.end;
    if (tok.kind === TokenKind.Semicolon) {
      break;
    }
  }
  return end;
}

/**
 * Parses a single statement (FR-24..FR-36). Dispatches on the leading token;
 * `KwType` is reserved (E10224); anything else is an expression statement.
 */
export function parseStatement(state: ParserState): StmtNode {
  const { cursor, sourceId } = state;
  state.clearPanic();
  const start = cursor.peek().span.start;

  switch (cursor.peekKind()) {
    case TokenKind.LBrace:
      return parseBlock(state);
    case TokenKind.KwIf:
      return parseIf(state);
    case TokenKind.KwWhile:
      return parseWhile(state);
    case TokenKind.KwDo:
      return parseDoWhile(state);
    case TokenKind.KwFor:
      return parseFor(state);
    case TokenKind.KwSwitch:
      return parseSwitch(state);
    case TokenKind.KwReturn:
      return parseReturn(state);
    case TokenKind.KwBreak:
      return parseBreak(state);
    case TokenKind.KwContinue:
      return parseContinue(state);
    case TokenKind.KwFallthrough:
      return parseFallthrough(state);
    case TokenKind.KwLet:
      return parseLetDecl(state, false, start);
    case TokenKind.KwConst:
      return parseConstDecl(state, false, start);
    case TokenKind.KwType: {
      // `type` is reserved for future use; no statement semantics.
      state.emit(DiagCode.ReservedKeyword, state.here(), "'type' is reserved for future use");
      const end = skipToSemicolon(state);
      const node: ErrorStmtNode = { kind: "ErrorStmt", span: makeSpan(sourceId, start, end) };
      return node;
    }
    default:
      return parseExpressionStmt(state);
  }
}
