import type { SourceRecord, SourceSpan } from "../project/types.js";
import { PAYLOAD_KIND, TokenKind } from "./tokens.js";
import type { Token } from "./tokens.js";
import type {
  ArrayLiteralExpr,
  Expr,
  NamedTypeSyntax,
  StructLiteralField,
  TypeSyntax,
} from "./syntax.js";

/**
 * The token operations expression parsing shares with its declaration and
 * statement owner. The owner retains diagnostics and recovery policy.
 */
export interface ExpressionContext {
  /** Original immutable source, used only for exact source associations. */
  readonly source: SourceRecord;
  /** Token currently being considered. */
  readonly current: Token;
  /** Consume and return the current token. */
  advance(): Token;
  /** Test the current token without consuming it. */
  check(kind: TokenKind): boolean;
  /** Consume the current token when it has the requested kind. */
  match(kind: TokenKind): Token | null;
  /** Consume a required token or report the supplied expectation. */
  expect(kind: TokenKind, expected: string, opener?: Token): Token | null;
  /** Record a syntax expectation at the current token. */
  reportExpected(expected: string, opener?: Token): void;
  /** Parse a type operand using the shared type grammar. */
  parseType(): TypeSyntax | null;
  /** Parse an expression at or above the supplied binding power. */
  parseExpression(minBindingPower?: number): Expr | null;
}

/** Create a raw source span from two already validated token boundaries. */
function spanBetween(source: SourceRecord, start: Token, end: Token | Expr): SourceSpan {
  return Object.freeze({
    sourceId: source.sourceId,
    start: start.span.start,
    end: end.span.end,
  });
}

/** Read an identifier payload without falling back to raw source slicing. */
function identifierText(token: Token): string | null {
  return token.payload?.kind === PAYLOAD_KIND.identifier ? token.payload.text : null;
}

/** Parse a comma-separated argument list after its opening parenthesis. */
function parseArguments(
  context: ExpressionContext,
  opener: Token,
): { readonly arguments: readonly Expr[]; readonly closer: Token } | null {
  const arguments_: Expr[] = [];
  if (!context.check(TokenKind.RPAREN)) {
    do {
      const argument = context.parseExpression();
      if (argument === null) return null;
      arguments_.push(argument);
    } while (context.match(TokenKind.COMMA) !== null);
  }
  const closer = context.expect(TokenKind.RPAREN, "')'", opener);
  if (closer === null) return null;
  return Object.freeze({ arguments: Object.freeze(arguments_), closer });
}

/** Parse a bracket literal, preserving explicit values separately from its fill. */
function parseArrayLiteral(context: ExpressionContext, opener: Token): ArrayLiteralExpr | null {
  const elements: Expr[] = [];
  let fill: Expr | null = null;

  if (context.match(TokenKind.SEMICOLON) !== null) {
    fill = context.parseExpression();
    if (fill === null) return null;
  } else if (!context.check(TokenKind.RBRACKET)) {
    const first = context.parseExpression();
    if (first === null) return null;
    elements.push(first);
    while (context.match(TokenKind.COMMA) !== null) {
      const element = context.parseExpression();
      if (element === null) return null;
      elements.push(element);
    }
    if (context.match(TokenKind.SEMICOLON) !== null) {
      fill = context.parseExpression();
      if (fill === null) return null;
    }
  }

  const closer = context.expect(TokenKind.RBRACKET, "']'", opener);
  if (closer === null) return null;
  return Object.freeze({
    kind: "array-literal",
    span: spanBetween(context.source, opener, closer),
    elements: Object.freeze(elements),
    fill,
  });
}

/** Parse a contextual struct literal in expression position. */
function parseStructLiteral(context: ExpressionContext, opener: Token): Expr | null {
  const fields: StructLiteralField[] = [];
  if (context.check(TokenKind.RBRACE)) {
    context.reportExpected("an identifier", opener);
    return null;
  }
  while (!context.check(TokenKind.RBRACE) && !context.check(TokenKind.EOF)) {
    const nameToken = context.expect(TokenKind.IDENTIFIER, "an identifier");
    if (nameToken === null) return null;
    const name = identifierText(nameToken);
    if (name === null) return null;
    if (context.expect(TokenKind.COLON, "':'") === null) return null;
    const value = context.parseExpression();
    if (value === null) return null;
    fields.push(
      Object.freeze({
        name,
        nameSpan: nameToken.span,
        value,
        span: spanBetween(context.source, nameToken, value),
      }),
    );
    if (context.match(TokenKind.COMMA) === null) break;
    if (context.check(TokenKind.RBRACE)) break;
  }
  const closer = context.expect(TokenKind.RBRACE, "'}'", opener);
  if (closer === null) return null;
  return Object.freeze({
    kind: "struct-literal",
    span: spanBetween(context.source, opener, closer),
    fields: Object.freeze(fields),
  });
}

/** Parse one qualified name without consulting declarations. */
function parseQualifiedName(
  context: ExpressionContext,
): { readonly name: string; readonly span: SourceSpan } | null {
  const first = context.expect(TokenKind.IDENTIFIER, "an identifier");
  if (first === null) return null;
  const firstText = identifierText(first);
  if (firstText === null) return null;
  let name = firstText;
  let end = first;
  while (context.match(TokenKind.DOT) !== null) {
    const part = context.expect(TokenKind.IDENTIFIER, "an identifier");
    if (part === null) return null;
    const text = identifierText(part);
    if (text === null) return null;
    name += "." + text;
    end = part;
  }
  return Object.freeze({ name, span: spanBetween(context.source, first, end) });
}

/** Parse the three query forms whose operands are not uniform call arguments. */
function parseQuery(context: ExpressionContext, nameToken: Token, name: string): Expr | null {
  const opener = context.expect(TokenKind.LPAREN, "'('");
  if (opener === null) return null;
  if (name === "sizeof") {
    const operand = context.parseType();
    if (operand === null) return null;
    const closer = context.expect(TokenKind.RPAREN, "')'", opener);
    return closer === null
      ? null
      : Object.freeze({
          kind: "sizeof",
          span: spanBetween(context.source, nameToken, closer),
          operand,
        });
  }
  if (name === "offsetof") {
    const qualified = parseQualifiedName(context);
    if (qualified === null || context.expect(TokenKind.COMMA, "','") === null) return null;
    const fieldToken = context.expect(TokenKind.IDENTIFIER, "an identifier");
    if (fieldToken === null) return null;
    const field = identifierText(fieldToken);
    if (field === null) return null;
    const closer = context.expect(TokenKind.RPAREN, "')'", opener);
    if (closer === null) return null;
    const operand: NamedTypeSyntax = Object.freeze({
      kind: "named-type",
      name: qualified.name,
      span: qualified.span,
    });
    return Object.freeze({
      kind: "offsetof",
      span: spanBetween(context.source, nameToken, closer),
      operand,
      field,
      fieldSpan: fieldToken.span,
    });
  }
  const operand = context.parseExpression();
  if (operand === null) return null;
  const closer = context.expect(TokenKind.RPAREN, "')'", opener);
  return closer === null
    ? null
    : Object.freeze({
        kind: "length",
        span: spanBetween(context.source, nameToken, closer),
        operand,
      });
}

/** Parse one atomic expression, including primitive cast syntax. */
function parsePrimary(context: ExpressionContext): Expr | null {
  const token = context.current;
  if (token.kind === TokenKind.NUMBER && token.payload?.kind === PAYLOAD_KIND.number) {
    context.advance();
    return Object.freeze({ kind: "number", span: token.span, value: token.payload.value });
  }
  if (
    (token.kind === TokenKind.STRING || token.kind === TokenKind.CHAR) &&
    token.payload?.kind === PAYLOAD_KIND.literal
  ) {
    context.advance();
    return Object.freeze({
      kind: "literal",
      span: token.span,
      literalKind: token.kind === TokenKind.CHAR ? "character" : "string",
      items: token.payload.items,
    });
  }
  if (token.kind === TokenKind.KW_TRUE || token.kind === TokenKind.KW_FALSE) {
    context.advance();
    return Object.freeze({
      kind: "boolean",
      span: token.span,
      value: token.kind === TokenKind.KW_TRUE,
    });
  }
  if (
    token.kind === TokenKind.KW_BYTE ||
    token.kind === TokenKind.KW_SBYTE ||
    token.kind === TokenKind.KW_WORD ||
    token.kind === TokenKind.KW_SWORD
  ) {
    context.advance();
    const names: Readonly<Record<string, string>> = {
      [TokenKind.KW_BYTE]: "byte",
      [TokenKind.KW_SBYTE]: "sbyte",
      [TokenKind.KW_WORD]: "word",
      [TokenKind.KW_SWORD]: "sword",
    };
    const type: NamedTypeSyntax = Object.freeze({
      kind: "named-type",
      span: token.span,
      name: names[token.kind]!,
    });
    const opener = context.expect(TokenKind.LPAREN, "'('");
    if (opener === null) return null;
    const operand = context.parseExpression();
    if (operand === null) return null;
    const closer = context.expect(TokenKind.RPAREN, "')'", opener);
    return closer === null
      ? null
      : Object.freeze({
          kind: "cast",
          span: spanBetween(context.source, token, closer),
          type,
          operand,
        });
  }
  if (token.kind === TokenKind.IDENTIFIER) {
    context.advance();
    const name = identifierText(token);
    if (name === null) return null;
    if (
      (name === "sizeof" || name === "offsetof" || name === "length") &&
      context.check(TokenKind.LPAREN)
    ) {
      return parseQuery(context, token, name);
    }
    return Object.freeze({ kind: "name", span: token.span, name });
  }
  const parenthesis = context.match(TokenKind.LPAREN);
  if (parenthesis !== null) {
    const expression = context.parseExpression();
    if (expression === null) return null;
    return context.expect(TokenKind.RPAREN, "')'", parenthesis) === null ? null : expression;
  }
  const bracket = context.match(TokenKind.LBRACKET);
  if (bracket !== null) return parseArrayLiteral(context, bracket);
  const brace = context.match(TokenKind.LBRACE);
  if (brace !== null) return parseStructLiteral(context, brace);
  context.reportExpected("an expression");
  return null;
}

/**
 * Parse an atomic expression followed by every call, index, and member suffix.
 * Suffixes are folded from left to right so source evaluation order is explicit.
 */
export function parsePostfixExpression(context: ExpressionContext): Expr | null {
  const primary = parsePrimary(context);
  if (primary === null) return null;
  let expression: Expr = primary;
  for (;;) {
    const opener = context.match(TokenKind.LPAREN);
    if (opener !== null) {
      const call = parseArguments(context, opener);
      if (call === null) return null;
      expression = Object.freeze({
        kind: "call",
        span: Object.freeze({
          sourceId: context.source.sourceId,
          start: expression.span.start,
          end: call.closer.span.end,
        }),
        callee: expression,
        arguments: call.arguments,
      });
      continue;
    }
    const bracket = context.match(TokenKind.LBRACKET);
    if (bracket !== null) {
      const index = context.parseExpression();
      if (index === null) return null;
      const closer = context.expect(TokenKind.RBRACKET, "']'", bracket);
      if (closer === null) return null;
      expression = Object.freeze({
        kind: "index",
        span: Object.freeze({
          sourceId: context.source.sourceId,
          start: expression.span.start,
          end: closer.span.end,
        }),
        object: expression,
        index,
      });
      continue;
    }
    if (context.match(TokenKind.DOT) !== null) {
      const memberToken = context.expect(TokenKind.IDENTIFIER, "an identifier");
      if (memberToken === null) return null;
      const member = identifierText(memberToken);
      if (member === null) return null;
      expression = Object.freeze({
        kind: "member",
        span: Object.freeze({
          sourceId: context.source.sourceId,
          start: expression.span.start,
          end: memberToken.span.end,
        }),
        object: expression,
        member,
        memberSpan: memberToken.span,
      });
      continue;
    }
    return expression;
  }
}

/** Fixed binding information for one infix operator. */
interface InfixBinding {
  /** Exact source spelling stored in syntax. */
  readonly operator: string;
  /** Binding power used to decide whether this operator belongs here. */
  readonly left: number;
  /** Minimum binding power used for the right operand. */
  readonly right: number;
  /** Whether the resulting node is assignment rather than binary. */
  readonly assignment: boolean;
}

/** Return the closed language binding for an infix token. */
function infixBinding(kind: TokenKind): InfixBinding | null {
  switch (kind) {
    case TokenKind.STAR:
      return { operator: "*", left: 12, right: 13, assignment: false };
    case TokenKind.SLASH:
      return { operator: "/", left: 12, right: 13, assignment: false };
    case TokenKind.PERCENT:
      return { operator: "%", left: 12, right: 13, assignment: false };
    case TokenKind.PLUS:
      return { operator: "+", left: 11, right: 12, assignment: false };
    case TokenKind.MINUS:
      return { operator: "-", left: 11, right: 12, assignment: false };
    case TokenKind.SHIFT_LEFT:
      return { operator: "<<", left: 10, right: 11, assignment: false };
    case TokenKind.SHIFT_RIGHT:
      return { operator: ">>", left: 10, right: 11, assignment: false };
    case TokenKind.LESS:
      return { operator: "<", left: 9, right: 10, assignment: false };
    case TokenKind.LESS_EQUAL:
      return { operator: "<=", left: 9, right: 10, assignment: false };
    case TokenKind.GREATER:
      return { operator: ">", left: 9, right: 10, assignment: false };
    case TokenKind.GREATER_EQUAL:
      return { operator: ">=", left: 9, right: 10, assignment: false };
    case TokenKind.EQUAL_EQUAL:
      return { operator: "==", left: 8, right: 9, assignment: false };
    case TokenKind.BANG_EQUAL:
      return { operator: "!=", left: 8, right: 9, assignment: false };
    case TokenKind.AMPERSAND:
      return { operator: "&", left: 7, right: 8, assignment: false };
    case TokenKind.CARET:
      return { operator: "^", left: 6, right: 7, assignment: false };
    case TokenKind.PIPE:
      return { operator: "|", left: 5, right: 6, assignment: false };
    case TokenKind.LOGICAL_AND:
      return { operator: "&&", left: 4, right: 5, assignment: false };
    case TokenKind.LOGICAL_OR:
      return { operator: "||", left: 3, right: 4, assignment: false };
    case TokenKind.EQUAL:
      return { operator: "=", left: 1, right: 1, assignment: true };
    case TokenKind.PLUS_EQUAL:
      return { operator: "+=", left: 1, right: 1, assignment: true };
    case TokenKind.MINUS_EQUAL:
      return { operator: "-=", left: 1, right: 1, assignment: true };
    case TokenKind.STAR_EQUAL:
      return { operator: "*=", left: 1, right: 1, assignment: true };
    case TokenKind.SLASH_EQUAL:
      return { operator: "/=", left: 1, right: 1, assignment: true };
    case TokenKind.PERCENT_EQUAL:
      return { operator: "%=", left: 1, right: 1, assignment: true };
    case TokenKind.AMPERSAND_EQUAL:
      return { operator: "&=", left: 1, right: 1, assignment: true };
    case TokenKind.PIPE_EQUAL:
      return { operator: "|=", left: 1, right: 1, assignment: true };
    case TokenKind.CARET_EQUAL:
      return { operator: "^=", left: 1, right: 1, assignment: true };
    case TokenKind.SHIFT_LEFT_EQUAL:
      return { operator: "<<=", left: 1, right: 1, assignment: true };
    case TokenKind.SHIFT_RIGHT_EQUAL:
      return { operator: ">>=", left: 1, right: 1, assignment: true };
    default:
      return null;
  }
}

/** Parse the closed set of prefix operators before continuing to postfix syntax. */
function parseUnaryExpression(context: ExpressionContext): Expr | null {
  const prefixes: { readonly token: Token; readonly operator: string }[] = [];
  for (;;) {
    const token = context.current;
    let operator: string | null = null;
    switch (token.kind) {
      case TokenKind.BANG:
        operator = "!";
        break;
      case TokenKind.TILDE:
        operator = "~";
        break;
      case TokenKind.MINUS:
        operator = "-";
        break;
      case TokenKind.AMPERSAND:
        operator = "&";
        break;
    }
    if (operator === null) break;
    prefixes.push(Object.freeze({ token: context.advance(), operator }));
  }

  const primary = parsePostfixExpression(context);
  if (primary === null) return null;
  let expression: Expr = primary;
  for (let index = prefixes.length - 1; index >= 0; index -= 1) {
    const prefix = prefixes[index]!;
    expression = Object.freeze({
      kind: "unary",
      span: spanBetween(context.source, prefix.token, expression),
      operator: prefix.operator,
      operand: expression,
    });
  }
  return expression;
}

/**
 * Parse one expression using the language's fixed binding powers.
 * Assignment and conditional nodes recurse at their own power to associate right.
 */
export function parseExpression(context: ExpressionContext, minBindingPower = 1): Expr | null {
  const first = parseUnaryExpression(context);
  if (first === null) return null;
  let left: Expr = first;

  for (;;) {
    if (context.check(TokenKind.QUESTION) && 2 >= minBindingPower) {
      context.advance();
      const whenTrue = context.parseExpression(1);
      if (whenTrue === null || context.expect(TokenKind.COLON, "':'") === null) return null;
      const whenFalse = context.parseExpression(2);
      if (whenFalse === null) return null;
      left = Object.freeze({
        kind: "conditional",
        span: Object.freeze({
          sourceId: context.source.sourceId,
          start: left.span.start,
          end: whenFalse.span.end,
        }),
        condition: left,
        whenTrue,
        whenFalse,
      });
      continue;
    }

    const binding = infixBinding(context.current.kind);
    if (binding === null || binding.left < minBindingPower) return left;
    context.advance();
    const right = context.parseExpression(binding.right);
    if (right === null) return null;
    left = binding.assignment
      ? Object.freeze({
          kind: "assignment",
          span: Object.freeze({
            sourceId: context.source.sourceId,
            start: left.span.start,
            end: right.span.end,
          }),
          operator: binding.operator,
          target: left,
          value: right,
        })
      : Object.freeze({
          kind: "binary",
          span: Object.freeze({
            sourceId: context.source.sourceId,
            start: left.span.start,
            end: right.span.end,
          }),
          operator: binding.operator,
          left,
          right,
        });
  }
}
