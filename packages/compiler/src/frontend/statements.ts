import type { SourceRecord, SourceSpan } from "../project/types.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import { TokenKind } from "./tokens.js";
import type { Token } from "./tokens.js";
import type {
  Block,
  DoWhileStatement,
  Expr,
  ForStatement,
  IfStatement,
  PoisonStatement,
  Statement,
  SwitchClause,
  SwitchStatement,
  UncheckedSyntax,
  VariableDeclaration,
} from "./syntax.js";

/** Token and recovery operations shared with the declaration parser. */
export interface StatementContext {
  /** Original immutable source. */
  readonly source: SourceRecord;
  /** Token currently being considered. */
  readonly current: Token;
  /** Consume and return the current token. */
  advance(): Token;
  /** Test the current token without consuming it. */
  check(kind: TokenKind): boolean;
  /** Consume the current token when it has the requested kind. */
  match(kind: TokenKind): Token | null;
  /** Report a source-language error before recovering the rejected statement. */
  addDiagnostic(diagnostic: ReturnType<typeof projectDiagnostic>): void;
  /** Consume a required token or report the supplied expectation. */
  expect(kind: TokenKind, expected: string, opener?: Token): Token | null;
  /** Record one expectation at the current token. */
  reportExpected(expected: string, opener?: Token): void;
  /** Parse an expression with the shared Pratt parser. */
  parseExpression(minBindingPower?: number): Expr | null;
  /** Parse a local variable, optionally leaving its terminator to the caller. */
  parseVariable(
    exported: boolean,
    requireSemicolon: boolean,
    declarationStart?: Token,
    loadable?: boolean,
  ): VariableDeclaration | PoisonStatement | null;
  /** Recover a rejected statement without crossing a safe sibling boundary. */
  recoverPoison(start: Token, knownEnd?: number): PoisonStatement;
  /** Retain one balanced valid-language form whose implementation is pending. */
  consumeUncheckedDeclaration(): UncheckedSyntax;
  /** Enter a nested block when the parser can do so without exhausting the host stack. */
  enterBlock(): boolean;
  /** Leave a previously entered nested block. */
  leaveBlock(): void;
  /** Build a source span from a starting token through a known boundary. */
  spanFrom(start: Token, end: Token | { readonly span: SourceSpan } | number): SourceSpan;
}

/** Parse one comma-delimited expression list without introducing a comma operator. */
function parseExpressionList(context: StatementContext): readonly Expr[] | null {
  const expressions: Expr[] = [];
  do {
    const expression = context.parseExpression();
    if (expression === null) return null;
    expressions.push(expression);
  } while (context.match(TokenKind.COMMA) !== null);
  return Object.freeze(expressions);
}

/** Parse a break or continue statement with its owned semicolon. */
function parseLoopJump(context: StatementContext): Statement {
  const keyword = context.advance();
  const closer = context.match(TokenKind.SEMICOLON);
  if (closer === null) {
    context.reportExpected("';'");
    return context.recoverPoison(keyword);
  }
  return Object.freeze({
    kind: keyword.kind === TokenKind.KW_BREAK ? "break" : "continue",
    span: context.spanFrom(keyword, closer),
  });
}

/** Parse a return statement with an optional value. */
function parseReturn(context: StatementContext): Statement {
  const start = context.advance();
  const value = context.check(TokenKind.SEMICOLON) ? null : context.parseExpression();
  if (!context.check(TokenKind.SEMICOLON) && value === null) return context.recoverPoison(start);
  const closer = context.match(TokenKind.SEMICOLON);
  if (closer === null) {
    context.reportExpected("';'");
    return context.recoverPoison(start);
  }
  return Object.freeze({ kind: "return", span: context.spanFrom(start, closer), value });
}

/** Parse an expression statement and retain poison instead of a fabricated operand. */
function parseExpressionStatement(context: StatementContext): Statement {
  const start = context.current;
  const expression = context.parseExpression();
  if (expression === null) return context.recoverPoison(start);
  const closer = context.match(TokenKind.SEMICOLON);
  if (closer === null) {
    context.reportExpected("';'");
    return context.recoverPoison(start);
  }
  return Object.freeze({
    kind: "expression-statement",
    span: context.spanFrom(start, closer),
    expression,
  });
}

/** Parse an if/else-if/else chain while preserving block ownership. */
function parseIf(context: StatementContext): IfStatement | PoisonStatement {
  const start = context.advance();
  const opener = context.expect(TokenKind.LPAREN, "'('");
  if (opener === null) return context.recoverPoison(start);
  const condition = context.parseExpression();
  if (condition === null || context.expect(TokenKind.RPAREN, "')'", opener) === null) {
    return context.recoverPoison(start);
  }
  const then = parseBlock(context);
  let otherwise: Block | IfStatement | null = null;
  if (context.match(TokenKind.KW_ELSE) !== null) {
    if (context.check(TokenKind.KW_IF)) {
      const nested = parseIf(context);
      if (nested.kind === "poison") return nested;
      otherwise = nested;
    } else {
      otherwise = parseBlock(context);
    }
  }
  return Object.freeze({
    kind: "if",
    span: context.spanFrom(start, otherwise ?? then),
    condition,
    then,
    otherwise,
  });
}

/** Parse a pre-test while loop. */
function parseWhile(context: StatementContext): Statement {
  const start = context.advance();
  const opener = context.expect(TokenKind.LPAREN, "'('");
  if (opener === null) return context.recoverPoison(start);
  const condition = context.parseExpression();
  if (condition === null || context.expect(TokenKind.RPAREN, "')'", opener) === null) {
    return context.recoverPoison(start);
  }
  const body = parseBlock(context);
  return Object.freeze({ kind: "while", span: context.spanFrom(start, body), condition, body });
}

/** Parse a post-test loop and its required closing semicolon. */
function parseDoWhile(context: StatementContext): DoWhileStatement | PoisonStatement {
  const start = context.advance();
  const body = parseBlock(context);
  if (context.expect(TokenKind.KW_WHILE, "'while'") === null) return context.recoverPoison(start);
  const opener = context.expect(TokenKind.LPAREN, "'('");
  if (opener === null) return context.recoverPoison(start);
  const condition = context.parseExpression();
  if (condition === null || context.expect(TokenKind.RPAREN, "')'", opener) === null) {
    return context.recoverPoison(start);
  }
  const closer = context.expect(TokenKind.SEMICOLON, "';'");
  if (closer === null) return context.recoverPoison(start);
  return Object.freeze({
    kind: "do-while",
    span: context.spanFrom(start, closer),
    body,
    condition,
  });
}

/** Parse an explicit fallthrough marker; placement is checked semantically. */
function parseFallthrough(context: StatementContext): Statement {
  const start = context.advance();
  const closer = context.expect(TokenKind.SEMICOLON, "';'");
  return closer === null
    ? context.recoverPoison(start)
    : Object.freeze({ kind: "fallthrough", span: context.spanFrom(start, closer) });
}

/** Parse a switch arm until its next label or the closing brace. */
function parseSwitchClause(context: StatementContext): SwitchClause | null {
  const start = context.advance();
  const values: Expr[] | null = start.kind === TokenKind.KW_DEFAULT ? null : [];
  if (values !== null) {
    do {
      const value = context.parseExpression();
      if (value === null) return null;
      values.push(value);
    } while (context.match(TokenKind.COMMA) !== null);
  }
  if (context.expect(TokenKind.COLON, "':'") === null) return null;
  const statements: Statement[] = [];
  while (
    !context.check(TokenKind.KW_CASE) &&
    !context.check(TokenKind.KW_DEFAULT) &&
    !context.check(TokenKind.RBRACE) &&
    !context.check(TokenKind.EOF)
  ) {
    const before = context.current;
    statements.push(parseStatement(context));
    if (context.current === before) context.advance();
  }
  const end = statements.at(-1)?.span.end ?? context.current.span.start;
  return Object.freeze({
    values: values === null ? null : Object.freeze(values),
    statements: Object.freeze(statements),
    span: context.spanFrom(start, end),
  });
}

/** Parse all switch arms while retaining source order for later semantic checks. */
function parseSwitch(context: StatementContext): SwitchStatement | PoisonStatement {
  const start = context.advance();
  const paren = context.expect(TokenKind.LPAREN, "'('");
  if (paren === null) return context.recoverPoison(start);
  const value = context.parseExpression();
  if (value === null || context.expect(TokenKind.RPAREN, "')'", paren) === null) {
    return context.recoverPoison(start);
  }
  const opener = context.expect(TokenKind.LBRACE, "'{'");
  if (opener === null) return context.recoverPoison(start);
  if (!context.enterBlock()) return context.recoverPoison(start);
  try {
    const clauses: SwitchClause[] = [];
    let sawDefault = false;
    let reportedLateCase = false;
    while (!context.check(TokenKind.RBRACE) && !context.check(TokenKind.EOF)) {
      if (!context.check(TokenKind.KW_CASE) && !context.check(TokenKind.KW_DEFAULT)) {
        context.reportExpected("'case' or 'default'");
        return context.recoverPoison(start);
      }
      if (sawDefault && context.check(TokenKind.KW_CASE) && !reportedLateCase) {
        context.reportExpected("all 'case' clauses before 'default'");
        reportedLateCase = true;
      }
      if (context.check(TokenKind.KW_DEFAULT)) sawDefault = true;
      const clause = parseSwitchClause(context);
      if (clause === null) return context.recoverPoison(start);
      clauses.push(clause);
    }
    const closer = context.expect(TokenKind.RBRACE, "'}'", opener);
    if (closer === null) return context.recoverPoison(start);
    return Object.freeze({
      kind: "switch",
      span: context.spanFrom(start, closer),
      value,
      clauses: Object.freeze(clauses),
    });
  } finally {
    context.leaveBlock();
  }
}

/** Parse the three independently optional clauses of an ordinary for loop. */
function parseFor(context: StatementContext): ForStatement | PoisonStatement | UncheckedSyntax {
  const start = context.advance();
  const opener = context.expect(TokenKind.LPAREN, "'('");
  if (opener === null) return context.recoverPoison(start);
  let initializer: VariableDeclaration | readonly Expr[] | null = null;
  if (!context.check(TokenKind.SEMICOLON)) {
    if (
      context.check(TokenKind.KW_LET) ||
      context.check(TokenKind.KW_CONST) ||
      context.check(TokenKind.KW_LOADABLE)
    ) {
      const declaration = context.parseVariable(
        false,
        false,
        undefined,
        context.check(TokenKind.KW_LOADABLE),
      );
      if (declaration === null || declaration.kind === "poison") {
        return context.recoverPoison(start);
      }
      initializer = declaration;
    } else {
      initializer = parseExpressionList(context);
      if (initializer === null) return context.recoverPoison(start);
    }
  }
  if (context.expect(TokenKind.SEMICOLON, "';'") === null) return context.recoverPoison(start);

  const condition = context.check(TokenKind.SEMICOLON) ? null : context.parseExpression();
  if (!context.check(TokenKind.SEMICOLON) && condition === null)
    return context.recoverPoison(start);
  if (context.expect(TokenKind.SEMICOLON, "';'") === null) return context.recoverPoison(start);

  const update = context.check(TokenKind.RPAREN) ? null : parseExpressionList(context);
  if (!context.check(TokenKind.RPAREN) && update === null) return context.recoverPoison(start);
  if (context.expect(TokenKind.RPAREN, "')'", opener) === null) return context.recoverPoison(start);

  const body = parseBlock(context);
  return Object.freeze({
    kind: "for",
    span: context.spanFrom(start, body),
    initializer,
    condition,
    update,
    body,
  });
}

/** Parse one statement selected entirely by its leading token. */
function parseStatement(context: StatementContext): Statement {
  if (context.check(TokenKind.KW_PLACE)) {
    const start = context.current;
    context.addDiagnostic(
      projectDiagnostic(
        "E10272",
        "A local declaration is not a placeable emitted object",
        start.span,
      ),
    );
    return context.recoverPoison(start);
  }
  if (
    context.check(TokenKind.KW_LET) ||
    context.check(TokenKind.KW_CONST) ||
    context.check(TokenKind.KW_LOADABLE)
  ) {
    return (
      context.parseVariable(false, true, undefined, context.check(TokenKind.KW_LOADABLE)) ??
      context.recoverPoison(context.current)
    );
  }
  if (context.check(TokenKind.KW_IF)) return parseIf(context);
  if (context.check(TokenKind.KW_WHILE)) return parseWhile(context);
  if (context.check(TokenKind.KW_DO)) return parseDoWhile(context);
  if (context.check(TokenKind.KW_FOR)) return parseFor(context);
  if (context.check(TokenKind.KW_SWITCH)) return parseSwitch(context);
  if (context.check(TokenKind.KW_FALLTHROUGH)) return parseFallthrough(context);
  if (context.check(TokenKind.KW_BREAK) || context.check(TokenKind.KW_CONTINUE)) {
    return parseLoopJump(context);
  }
  if (context.check(TokenKind.KW_RETURN)) return parseReturn(context);
  if (context.check(TokenKind.LBRACE)) return parseBlock(context);
  if (context.check(TokenKind.KW_COMPTIME)) {
    const start = context.current;
    context.reportExpected("a statement");
    return context.recoverPoison(start);
  }
  return parseExpressionStatement(context);
}

/** Parse a brace-delimited statement sequence with bounded sibling recovery. */
export function parseBlock(context: StatementContext): Block {
  if (!context.enterBlock()) {
    const unchecked = context.consumeUncheckedDeclaration();
    return Object.freeze({
      kind: "block",
      span: unchecked.span,
      statements: Object.freeze([unchecked]),
    });
  }
  const opener = context.expect(TokenKind.LBRACE, "'{'");
  if (opener === null) {
    context.leaveBlock();
    return Object.freeze({
      kind: "block",
      span: context.current.span,
      statements: Object.freeze([]),
    });
  }
  try {
    const statements: Statement[] = [];
    while (!context.check(TokenKind.RBRACE) && !context.check(TokenKind.EOF)) {
      const before = context.current;
      statements.push(parseStatement(context));
      if (context.current === before) context.advance();
    }
    const closer = context.expect(TokenKind.RBRACE, "'}'", opener);
    return Object.freeze({
      kind: "block",
      span: context.spanFrom(opener, closer ?? context.current),
      statements: Object.freeze(statements),
    });
  } finally {
    context.leaveBlock();
  }
}
