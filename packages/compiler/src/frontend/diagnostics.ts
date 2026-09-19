import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import { TokenKind } from "./tokens.js";
import type { Token } from "./tokens.js";

/** Exact fixed spellings used in parser diagnostics. */
const TOKEN_SPELLINGS: Readonly<Partial<Record<TokenKind, string>>> = Object.freeze({
  [TokenKind.KW_MODULE]: "module",
  [TokenKind.KW_IMPORT]: "import",
  [TokenKind.KW_EXPORT]: "export",
  [TokenKind.KW_FROM]: "from",
  [TokenKind.KW_FUNCTION]: "function",
  [TokenKind.KW_RETURN]: "return",
  [TokenKind.KW_INTERRUPT]: "interrupt",
  [TokenKind.KW_FN]: "fn",
  [TokenKind.KW_IF]: "if",
  [TokenKind.KW_ELSE]: "else",
  [TokenKind.KW_WHILE]: "while",
  [TokenKind.KW_DO]: "do",
  [TokenKind.KW_FOR]: "for",
  [TokenKind.KW_BREAK]: "break",
  [TokenKind.KW_CONTINUE]: "continue",
  [TokenKind.KW_LET]: "let",
  [TokenKind.KW_CONST]: "const",
  [TokenKind.KW_LOADABLE]: "loadable",
  [TokenKind.KW_PLACE]: "place",
  [TokenKind.KW_ZEROPAGE]: "zeropage",
  [TokenKind.KW_STRUCT]: "struct",
  [TokenKind.KW_ENUM]: "enum",
  [TokenKind.KW_COMPTIME]: "comptime",
  [TokenKind.KW_SWITCH]: "switch",
  [TokenKind.KW_TYPE]: "type",
  [TokenKind.KW_CASE]: "case",
  [TokenKind.KW_DEFAULT]: "default",
  [TokenKind.KW_FALLTHROUGH]: "fallthrough",
  [TokenKind.KW_BYTE]: "byte",
  [TokenKind.KW_SBYTE]: "sbyte",
  [TokenKind.KW_WORD]: "word",
  [TokenKind.KW_SWORD]: "sword",
  [TokenKind.KW_BOOLEAN]: "boolean",
  [TokenKind.KW_VOID]: "void",
  [TokenKind.KW_TRUE]: "true",
  [TokenKind.KW_FALSE]: "false",
  [TokenKind.PLUS]: "+",
  [TokenKind.MINUS]: "-",
  [TokenKind.STAR]: "*",
  [TokenKind.SLASH]: "/",
  [TokenKind.PERCENT]: "%",
  [TokenKind.AMPERSAND]: "&",
  [TokenKind.PIPE]: "|",
  [TokenKind.CARET]: "^",
  [TokenKind.TILDE]: "~",
  [TokenKind.SHIFT_LEFT]: "<<",
  [TokenKind.SHIFT_RIGHT]: ">>",
  [TokenKind.LOGICAL_AND]: "&&",
  [TokenKind.LOGICAL_OR]: "||",
  [TokenKind.BANG]: "!",
  [TokenKind.EQUAL_EQUAL]: "==",
  [TokenKind.BANG_EQUAL]: "!=",
  [TokenKind.LESS]: "<",
  [TokenKind.LESS_EQUAL]: "<=",
  [TokenKind.GREATER]: ">",
  [TokenKind.GREATER_EQUAL]: ">=",
  [TokenKind.EQUAL]: "=",
  [TokenKind.PLUS_EQUAL]: "+=",
  [TokenKind.MINUS_EQUAL]: "-=",
  [TokenKind.STAR_EQUAL]: "*=",
  [TokenKind.SLASH_EQUAL]: "/=",
  [TokenKind.PERCENT_EQUAL]: "%=",
  [TokenKind.AMPERSAND_EQUAL]: "&=",
  [TokenKind.PIPE_EQUAL]: "|=",
  [TokenKind.CARET_EQUAL]: "^=",
  [TokenKind.SHIFT_LEFT_EQUAL]: "<<=",
  [TokenKind.SHIFT_RIGHT_EQUAL]: ">>=",
  [TokenKind.QUESTION]: "?",
  [TokenKind.LPAREN]: "(",
  [TokenKind.RPAREN]: ")",
  [TokenKind.LBRACKET]: "[",
  [TokenKind.RBRACKET]: "]",
  [TokenKind.LBRACE]: "{",
  [TokenKind.RBRACE]: "}",
  [TokenKind.COMMA]: ",",
  [TokenKind.SEMICOLON]: ";",
  [TokenKind.COLON]: ":",
  [TokenKind.DOT]: ".",
});

/** Describe a token using only a fixed spelling or fixed token category. */
export function describeFoundToken(token: Token): string {
  if (token.kind === TokenKind.EOF) return "end of file";
  if (token.kind === TokenKind.IDENTIFIER) return "'identifier'";
  if (
    token.kind === TokenKind.NUMBER ||
    token.kind === TokenKind.STRING ||
    token.kind === TokenKind.CHAR
  ) {
    return "'literal'";
  }
  const spelling = TOKEN_SPELLINGS[token.kind];
  return spelling === undefined ? `'${token.kind}'` : `'${spelling}'`;
}

/** Build the single approved general grammar diagnostic. */
export function syntaxDiagnostic(
  expected: string,
  token: Token,
  opener?: Token,
): ProjectDiagnostic {
  return projectDiagnostic(
    "PARSE_SYNTAX_ERROR",
    `Expected ${expected}, found ${describeFoundToken(token)}`,
    token.span,
    null,
    opener === undefined
      ? []
      : [Object.freeze({ span: opener.span, message: "Delimiter opened here" })],
  );
}

/** Sort parser and lexer reports by proving span, code, then producer order. */
export function sortFrontendDiagnostics(
  diagnostics: readonly ProjectDiagnostic[],
): readonly ProjectDiagnostic[] {
  return Object.freeze(
    diagnostics
      .map((diagnostic, productionOrder) => ({ diagnostic, productionOrder }))
      .sort(
        (left, right) =>
          (left.diagnostic.primarySpan?.start ?? Number.POSITIVE_INFINITY) -
            (right.diagnostic.primarySpan?.start ?? Number.POSITIVE_INFINITY) ||
          (left.diagnostic.primarySpan?.end ?? Number.POSITIVE_INFINITY) -
            (right.diagnostic.primarySpan?.end ?? Number.POSITIVE_INFINITY) ||
          (left.diagnostic.code < right.diagnostic.code
            ? -1
            : left.diagnostic.code > right.diagnostic.code
              ? 1
              : 0) ||
          left.productionOrder - right.productionOrder,
      )
      .map(({ diagnostic }) => diagnostic),
  );
}
