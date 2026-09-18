import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";

/** Closed token vocabulary; keyword names preserve source case sensitivity. */
export enum TokenKind {
  /** Unsigned numeric source literal. */
  NUMBER = "NUMBER",
  /** Double-quoted literal. */
  STRING = "STRING",
  /** Single-quoted literal. */
  CHAR = "CHAR",
  /** ASCII name, including contextual and intrinsic spellings. */
  IDENTIFIER = "IDENTIFIER",
  /** Module declaration. */
  KW_MODULE = "KW_MODULE",
  /** Import declaration. */
  KW_IMPORT = "KW_IMPORT",
  /** Export modifier. */
  KW_EXPORT = "KW_EXPORT",
  /** Import source marker. */
  KW_FROM = "KW_FROM",
  /** Function declaration. */
  KW_FUNCTION = "KW_FUNCTION",
  /** Return statement. */
  KW_RETURN = "KW_RETURN",
  /** Interrupt modifier. */
  KW_INTERRUPT = "KW_INTERRUPT",
  /** Function type. */
  KW_FN = "KW_FN",
  /** Compile-time modifier. */
  KW_COMPTIME = "KW_COMPTIME",
  /** Conditional statement. */
  KW_IF = "KW_IF",
  /** Alternative branch. */
  KW_ELSE = "KW_ELSE",
  /** Pre-test loop. */
  KW_WHILE = "KW_WHILE",
  /** Post-test loop. */
  KW_DO = "KW_DO",
  /** Three-clause loop. */
  KW_FOR = "KW_FOR",
  /** Multi-way branch. */
  KW_SWITCH = "KW_SWITCH",
  /** Case label. */
  KW_CASE = "KW_CASE",
  /** Default label. */
  KW_DEFAULT = "KW_DEFAULT",
  /** Explicit case continuation. */
  KW_FALLTHROUGH = "KW_FALLTHROUGH",
  /** Loop or switch exit. */
  KW_BREAK = "KW_BREAK",
  /** Loop continuation. */
  KW_CONTINUE = "KW_CONTINUE",
  /** Mutable declaration. */
  KW_LET = "KW_LET",
  /** Constant declaration. */
  KW_CONST = "KW_CONST",
  /** Package-only modifier. */
  KW_LOADABLE = "KW_LOADABLE",
  /** Explicit placement. */
  KW_PLACE = "KW_PLACE",
  /** Zero-page declaration block. */
  KW_ZEROPAGE = "KW_ZEROPAGE",
  /** Struct declaration. */
  KW_STRUCT = "KW_STRUCT",
  /** Unsigned eight-bit type. */
  KW_BYTE = "KW_BYTE",
  /** Signed eight-bit type. */
  KW_SBYTE = "KW_SBYTE",
  /** Unsigned sixteen-bit type. */
  KW_WORD = "KW_WORD",
  /** Signed sixteen-bit type. */
  KW_SWORD = "KW_SWORD",
  /** Boolean type. */
  KW_BOOLEAN = "KW_BOOLEAN",
  /** No-value type. */
  KW_VOID = "KW_VOID",
  /** True literal. */
  KW_TRUE = "KW_TRUE",
  /** False literal. */
  KW_FALSE = "KW_FALSE",
  /** Enum declaration. */
  KW_ENUM = "KW_ENUM",
  /** Reserved future keyword. */
  KW_TYPE = "KW_TYPE",
  /** Addition or unary plus. */
  PLUS = "PLUS",
  /** Subtraction or negation. */
  MINUS = "MINUS",
  /** Multiplication. */
  STAR = "STAR",
  /** Division. */
  SLASH = "SLASH",
  /** Remainder. */
  PERCENT = "PERCENT",
  /** Bitwise AND or address-of. */
  AMPERSAND = "AMPERSAND",
  /** Bitwise OR. */
  PIPE = "PIPE",
  /** Bitwise XOR. */
  CARET = "CARET",
  /** Bitwise complement. */
  TILDE = "TILDE",
  /** Left shift. */
  SHIFT_LEFT = "SHIFT_LEFT",
  /** Right shift. */
  SHIFT_RIGHT = "SHIFT_RIGHT",
  /** Short-circuit AND. */
  LOGICAL_AND = "LOGICAL_AND",
  /** Short-circuit OR. */
  LOGICAL_OR = "LOGICAL_OR",
  /** Boolean negation. */
  BANG = "BANG",
  /** Equality comparison. */
  EQUAL_EQUAL = "EQUAL_EQUAL",
  /** Inequality comparison. */
  BANG_EQUAL = "BANG_EQUAL",
  /** Less-than comparison. */
  LESS = "LESS",
  /** Less-than-or-equal comparison. */
  LESS_EQUAL = "LESS_EQUAL",
  /** Greater-than comparison. */
  GREATER = "GREATER",
  /** Greater-than-or-equal comparison. */
  GREATER_EQUAL = "GREATER_EQUAL",
  /** Simple assignment. */
  EQUAL = "EQUAL",
  /** Compound addition. */
  PLUS_EQUAL = "PLUS_EQUAL",
  /** Compound subtraction. */
  MINUS_EQUAL = "MINUS_EQUAL",
  /** Compound multiplication. */
  STAR_EQUAL = "STAR_EQUAL",
  /** Compound division. */
  SLASH_EQUAL = "SLASH_EQUAL",
  /** Compound remainder. */
  PERCENT_EQUAL = "PERCENT_EQUAL",
  /** Compound bitwise AND. */
  AMPERSAND_EQUAL = "AMPERSAND_EQUAL",
  /** Compound bitwise OR. */
  PIPE_EQUAL = "PIPE_EQUAL",
  /** Compound bitwise XOR. */
  CARET_EQUAL = "CARET_EQUAL",
  /** Compound left shift. */
  SHIFT_LEFT_EQUAL = "SHIFT_LEFT_EQUAL",
  /** Compound right shift. */
  SHIFT_RIGHT_EQUAL = "SHIFT_RIGHT_EQUAL",
  /** Conditional expression marker. */
  QUESTION = "QUESTION",
  /** Opening parenthesis. */
  LPAREN = "LPAREN",
  /** Closing parenthesis. */
  RPAREN = "RPAREN",
  /** Opening bracket. */
  LBRACKET = "LBRACKET",
  /** Closing bracket. */
  RBRACKET = "RBRACKET",
  /** Opening brace. */
  LBRACE = "LBRACE",
  /** Closing brace. */
  RBRACE = "RBRACE",
  /** List separator. */
  COMMA = "COMMA",
  /** Statement terminator. */
  SEMICOLON = "SEMICOLON",
  /** Type, case or conditional separator. */
  COLON = "COLON",
  /** Qualified name or member separator. */
  DOT = "DOT",
  /** Zero-width end-of-input marker. */
  EOF = "EOF",
}

/** Payload discriminators, separate from grammar token kinds. */
export const PAYLOAD_KIND = Object.freeze({
  /** Normalized unsigned integer. */
  number: "number",
  /** Exact ASCII source name. */
  identifier: "identifier",
  /** Unencoded ordered literal content. */
  literal: "literal",
} as const);

/** Closed kinds of content preserved before target encoding. */
export const LITERAL_ITEM_KIND = Object.freeze({
  /** One original Unicode scalar. */
  scalar: "scalar",
  /** Symbolic source escape spelling. */
  escape: "escape",
  /** An exact byte that bypasses target encoding. */
  byte: "byte",
} as const);

/** A located literal unit; byte escapes are not Unicode conversion. */
export type LiteralItem = {
  /** Raw source bytes for this content unit, including escape prefix. */
  readonly span: SourceSpan;
} & (
  | {
      /** Unicode scalar identity. */
      readonly kind: typeof LITERAL_ITEM_KIND.scalar;
      /** Exactly one scalar, with no normalization. */
      readonly value: string;
    }
  | {
      /** A recognized symbolic escape. */
      readonly kind: typeof LITERAL_ITEM_KIND.escape;
      /** Exact two-character source spelling. */
      readonly value: string;
    }
  | {
      /** Literal byte insertion. */
      readonly kind: typeof LITERAL_ITEM_KIND.byte;
      /** Integer in 0..255. */
      readonly value: number;
    }
);

/** Only valid, recognized lexemes have a payload. */
export type TokenPayload =
  | null
  | {
      /** Numeric payload identity. */
      readonly kind: typeof PAYLOAD_KIND.number;
      /** Unsigned value in 0..65535. */
      readonly value: bigint;
    }
  | {
      /** Identifier payload identity. */
      readonly kind: typeof PAYLOAD_KIND.identifier;
      /** Exact ASCII spelling, including contextual names. */
      readonly text: string;
    }
  | {
      /** Literal payload identity. */
      readonly kind: typeof PAYLOAD_KIND.literal;
      /** Content in source order; no selected target encoding. */
      readonly items: readonly LiteralItem[];
    };

/** One recognized token with raw byte coordinates. */
export interface Token {
  /** Closed grammar category. */
  readonly kind: TokenKind;
  /** Half-open raw UTF-8 location. */
  readonly span: SourceSpan;
  /** One-based line, treating CRLF as one break. */
  readonly line: number;
  /** One-based byte column, including any leading BOM bytes. */
  readonly column: number;
  /** Decoded lexical content, or null for fixed spellings. */
  readonly payload: TokenPayload;
}

/** Scanning completion is independent of source validity or semantic acceptance. */
export interface LexResult {
  /** Recognized tokens, ending in an EOF marker even after incomplete scanning. */
  readonly tokens: readonly Token[];
  /** Canonical root reports, limited to twenty errors. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** True only when all lexical checks finished. */
  readonly complete: boolean;
  /** Rejected regions, plus any remainder whose checks could not finish. */
  readonly poisoned: readonly SourceSpan[];
}
