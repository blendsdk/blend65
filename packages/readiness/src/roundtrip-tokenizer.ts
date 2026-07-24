import type { LiteralSpellingClass, RoundTripDiagnostic } from "./roundtrip-model.js";

/** Token categories recognized by the independent emitted-subset tokenizer. */
export type RoundTripTokenKind =
  | "identifier"
  | "integer"
  | "boolean-literal"
  | "module"
  | "const"
  | "function"
  | "let"
  | "return"
  | "scalar-type"
  | "void"
  | "peek"
  | "peekw"
  | "poke"
  | "pokew"
  | "operator"
  | "lparen"
  | "rparen"
  | "lbrace"
  | "rbrace"
  | "comma"
  | "semicolon"
  | "colon"
  | "dot"
  | "eof";

/** One immutable token with a byte-offset source location. */
export interface RoundTripToken {
  /** Token category. */
  readonly kind: RoundTripTokenKind;
  /** Exact source lexeme. */
  readonly lexeme: string;
  /** ASCII byte offset in the validated source. */
  readonly offset: number;
  /** Literal spelling, present only for integer tokens. */
  readonly spelling?: LiteralSpellingClass;
}

/** Successful tokenization. */
export interface RoundTripTokenizeSuccess {
  /** Success discriminator. */
  readonly ok: true;
  /** Complete token stream ending in EOF. */
  readonly tokens: readonly RoundTripToken[];
  /** Successful tokenization carries no diagnostics. */
  readonly diagnostics: readonly [];
}

/** Failed tokenization. */
export interface RoundTripTokenizeFailure {
  /** Failure discriminator. */
  readonly ok: false;
  /** One bounded unsupported-source diagnostic. */
  readonly diagnostics: readonly RoundTripDiagnostic[];
}

/** Closed tokenizer result. */
export type RoundTripTokenizeResult = RoundTripTokenizeSuccess | RoundTripTokenizeFailure;

const KEYWORDS: Readonly<Record<string, RoundTripTokenKind>> = Object.freeze({
  module: "module",
  const: "const",
  function: "function",
  let: "let",
  return: "return",
  true: "boolean-literal",
  false: "boolean-literal",
  boolean: "scalar-type",
  byte: "scalar-type",
  sbyte: "scalar-type",
  word: "scalar-type",
  sword: "scalar-type",
  void: "void",
});

const TWO_CHARACTER_OPERATORS = new Set(["<<", ">>", "==", "!=", "<=", ">="]);
const ONE_CHARACTER_OPERATORS = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "&",
  "|",
  "^",
  "~",
  "!",
  "<",
  ">",
  "=",
]);

function unsupported(offset: number): RoundTripTokenizeFailure {
  return {
    ok: false,
    diagnostics: [
      Object.freeze({
        code: "roundtrip-unsupported",
        path: `/source/${offset}`,
        message: "source contains a token outside the rendered subset",
      }),
    ],
  };
}

function isIdentifierStart(character: string): boolean {
  return /^[A-Za-z]$/u.test(character);
}

function isIdentifierContinue(character: string): boolean {
  return /^[A-Za-z0-9_]$/u.test(character);
}

function isDecimalDigit(character: string): boolean {
  return character >= "0" && character <= "9";
}

function scanDigits(source: string, start: number, valid: (character: string) => boolean): number {
  let cursor = start;
  while (cursor < source.length && valid(source[cursor] ?? "")) {
    cursor += 1;
  }
  return cursor;
}

/**
 * Tokenizes only the deterministic source subset emitted by the renderer.
 *
 * @param source Fatal-UTF-8-decoded source text.
 * @returns Complete tokens or one bounded unsupported-token diagnostic.
 */
export function tokenizeRoundTripSource(source: string): RoundTripTokenizeResult {
  const tokens: RoundTripToken[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const character = source[cursor] ?? "";
    if (character === " " || character === "\t" || character === "\n") {
      cursor += 1;
      continue;
    }
    if (isIdentifierStart(character)) {
      const end = scanDigits(source, cursor + 1, isIdentifierContinue);
      const lexeme = source.slice(cursor, end);
      tokens.push(
        Object.freeze({
          kind: KEYWORDS[lexeme] ?? "identifier",
          lexeme,
          offset: cursor,
        }),
      );
      cursor = end;
      continue;
    }
    if (character === "$") {
      const end = scanDigits(source, cursor + 1, (item) => /^[0-9A-Fa-f]$/u.test(item));
      if (end === cursor + 1) {
        return unsupported(cursor);
      }
      tokens.push(
        Object.freeze({
          kind: "integer",
          lexeme: source.slice(cursor, end),
          offset: cursor,
          spelling: "hex-dollar",
        }),
      );
      cursor = end;
      continue;
    }
    if (isDecimalDigit(character)) {
      let spelling: LiteralSpellingClass = "decimal";
      let end = cursor;
      if (source.startsWith("0x", cursor)) {
        spelling = "hex-prefix";
        end = scanDigits(source, cursor + 2, (item) => /^[0-9A-Fa-f]$/u.test(item));
        if (end === cursor + 2) {
          return unsupported(cursor);
        }
      } else if (source.startsWith("0b", cursor)) {
        spelling = "binary-prefix";
        end = scanDigits(source, cursor + 2, (item) => item === "0" || item === "1");
        if (end === cursor + 2) {
          return unsupported(cursor);
        }
      } else {
        end = scanDigits(source, cursor, isDecimalDigit);
      }
      tokens.push(
        Object.freeze({
          kind: "integer",
          lexeme: source.slice(cursor, end),
          offset: cursor,
          spelling,
        }),
      );
      cursor = end;
      continue;
    }

    const pair = source.slice(cursor, cursor + 2);
    if (TWO_CHARACTER_OPERATORS.has(pair)) {
      tokens.push(Object.freeze({ kind: "operator", lexeme: pair, offset: cursor }));
      cursor += 2;
      continue;
    }
    if (ONE_CHARACTER_OPERATORS.has(character)) {
      tokens.push(Object.freeze({ kind: "operator", lexeme: character, offset: cursor }));
      cursor += 1;
      continue;
    }
    const punctuation: Readonly<Record<string, RoundTripTokenKind>> = {
      "(": "lparen",
      ")": "rparen",
      "{": "lbrace",
      "}": "rbrace",
      ",": "comma",
      ";": "semicolon",
      ":": "colon",
      ".": "dot",
    };
    const kind = punctuation[character];
    if (kind !== undefined) {
      tokens.push(Object.freeze({ kind, lexeme: character, offset: cursor }));
      cursor += 1;
      continue;
    }
    return unsupported(cursor);
  }
  tokens.push(Object.freeze({ kind: "eof", lexeme: "", offset: source.length }));
  return { ok: true, tokens: Object.freeze(tokens), diagnostics: [] };
}
