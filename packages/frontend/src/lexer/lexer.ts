import { DiagCode, LineMap, makeSpan, TokenKind } from "@blend65/core";
import type { DiagnosticBag, SourceId, Token, TokenKindValue } from "@blend65/core";
import { KEYWORD_MAP } from "./keyword-map.js";


/**
 * The result of tokenizing one source file.
 *
 * The token stream is always non-empty and always ends with exactly one `Eof`
 * token (FR-33), so consumers (the parser, RD-03) can rely on a terminator
 * without bounds-checking. The `lineMap` is built once over the raw source and
 * lets consumers convert any `token.span` offset to a line/column on demand.
 */
export interface LexResult {
  /** The complete token stream — always non-empty, always ends with one `Eof`. */
  readonly tokens: readonly Token[];
  /** Line-start map for the source, built once (AR-L1/L2). */
  readonly lineMap: LineMap;
}

/** Unicode BOM (U+FEFF) — skipped once if it leads the source (FR-29). */
const BOM = "\uFEFF";

/** `true` for the four whitespace characters the lexer skips (FR-22). */
function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

/** `true` for an identifier start character `[A-Za-z_]` (FR-6). */
function isIdentStart(ch: string): boolean {
  return (
    (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_"
  );
}

/** `true` for an identifier continuation character `[A-Za-z0-9_]` (FR-6). */
function isIdentContinue(ch: string): boolean {
  return isIdentStart(ch) || (ch >= "0" && ch <= "9");
}

/** `true` for a decimal digit `[0-9]` (FR-11). */
function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

/** `true` for a hexadecimal digit `[0-9A-Fa-f]` (FR-12, FR-13). */
function isHexDigit(ch: string): boolean {
  return isDigit(ch) || (ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F");
}

/** `true` for a binary digit `0` or `1` (FR-14). */
function isBinDigit(ch: string): boolean {
  return ch === "0" || ch === "1";
}

/** The maximum value any Blend65 numeric type can hold (16-bit). */
const MAX_NUMERIC = 0xffff;


/**
 * Tokenize a single source file (spec Ch 01).
 *
 * Never throws (FR-32): malformed input appends diagnostics to `bag` and yields
 * recovery tokens, so the returned stream is always complete and ends in `Eof`.
 *
 * @param sourceId Interned source identifier (read by the CompilerHost, AR-40).
 * @param text     The full UTF-8 source text.
 * @param bag      Accumulating diagnostic bag; lexer diagnostics are appended here.
 * @returns        The token stream plus the source's `LineMap`.
 */
export function lex(sourceId: SourceId, text: string, bag: DiagnosticBag): LexResult {
  const len = text.length;
  const tokens: Token[] = [];

  // Single forward cursor over `text`. All token-significant characters are
  // ASCII (Ch 01 §1), so one UTF-16 code unit equals one byte for them and
  // `pos` doubles as a byte offset for every emitted span (AR-72).
  let pos = 0;

  /** Returns the code unit `k` positions ahead, or `undefined` past the end. */
  function peek(k = 0): string | undefined {
    return text[pos + k];
  }

  /** Builds a token spanning `[start, pos)` with an optional semantic value. */
  function makeToken(kind: TokenKindValue, start: number, value?: number | string): Token {
    return value === undefined
      ? { kind, span: makeSpan(sourceId, start, pos) }
      : { kind, span: makeSpan(sourceId, start, pos), value };
  }

  /** Skips a maximal run of whitespace; emits no token (FR-22). */
  function skipWhitespace(): void {
    while (pos < len && isWhitespace(text[pos] as string)) {
      pos += 1;
    }
  }

  /** Skips a `//` line comment up to (but not including) the newline (FR-20). */
  function skipLineComment(): void {
    pos += 2; // consume the leading "//"
    while (pos < len && text[pos] !== "\n" && text[pos] !== "\r") {
      pos += 1;
    }
    // The newline itself is left for skipWhitespace on the next iteration.
  }

  /**
   * Skips a `/ * … * /` block comment. Block comments do not nest (FR-21): the
   * first `* /` closes. An unterminated comment swallows the rest of the file
   * and emits E10211, suppressing any cascade (FR-35).
   */
  function skipBlockComment(): void {
    const start = pos;
    pos += 2; // consume the leading "/*"
    while (pos < len) {
      if (text[pos] === "*" && peek(1) === "/") {
        pos += 2; // consume the closing "*/"
        return;
      }
      pos += 1;
    }
    // Reached EOF without a closing "*/": treat the rest as comment (pos is
    // already at len) and report. No further tokens follow (cascade, FR-35).
    bag.addError(
      DiagCode.UnterminatedBlockComment,
      makeSpan(sourceId, start, len),
      "Unterminated block comment — expected '*/' before end of file",
    );
  }

  /**
   * Scans an identifier-shaped run and classifies it via {@link KEYWORD_MAP}.
   * A hit yields the keyword's kind; a miss yields `Identifier`. Case-sensitive
   * (FR-9), so `Break` misses and becomes `Identifier`.
   */
  function scanIdentifier(): Token {
    const start = pos;
    while (pos < len && isIdentContinue(text[pos] as string)) {
      pos += 1;
    }
    const lexeme = text.slice(start, pos);
    const kind = KEYWORD_MAP.get(lexeme) ?? TokenKind.Identifier;
    return makeToken(kind, start);
  }

  /** Reports a misplaced underscore in a numeric literal (E10213). */
  function emitInvalidUnderscore(litStart: number): void {
    bag.addError(
      DiagCode.InvalidNumericUnderscore,
      makeSpan(sourceId, litStart, pos),
      "Invalid underscore in numeric literal — underscores must appear between digits only (no leading, trailing, or consecutive underscores)",
    );
  }

  /** Reports a `$`/`0x` prefix with no hex digit (E10214). */
  function emitBadHex(litStart: number, prefix: string): void {
    bag.addError(
      DiagCode.InvalidHexLiteral,
      makeSpan(sourceId, litStart, pos),
      `Invalid hexadecimal literal — expected hex digit (0–9, A–F) after '${prefix}'`,
    );
  }

  /** Reports a `0b` prefix with no binary digit (E10215). */
  function emitBadBinary(litStart: number): void {
    bag.addError(
      DiagCode.InvalidBinaryLiteral,
      makeSpan(sourceId, litStart, pos),
      "Invalid binary literal — expected binary digit (0 or 1) after '0b'",
    );
  }

  /** Reports a numeric literal exceeding the 16-bit maximum (E10216). */
  function emitOverflow(litStart: number, value: number): void {
    bag.addError(
      DiagCode.NumericLiteralOverflow,
      makeSpan(sourceId, litStart, pos),
      `Numeric literal value ${value} exceeds maximum (65535) — no Blend65 type can hold values larger than 16 bits`,
    );
  }

  /** Warns about a decimal literal with leading zeros (W10210). */
  function emitLeadingZeros(litStart: number, value: number): void {
    const literal = text.slice(litStart, pos);
    bag.addWarning(
      DiagCode.NumericLeadingZeros,
      makeSpan(sourceId, litStart, pos),
      `Numeric literal has leading zeros: '${literal}' — Blend65 does not have octal literals; this is decimal ${value}`,
    );
  }

  /**
   * Consumes a maximal run of `isClass` digits and `_` separators, returning the
   * digits with underscores stripped. Underscore-placement violations (leading,
   * trailing, or consecutive) emit a single E10213 for the run (FR-15); a stray
   * non-digit ends the run without being consumed.
   */
  function scanDigitRun(litStart: number, isClass: (ch: string) => boolean): string {
    let raw = "";
    let violation = false;
    let prevUnderscore = false;
    let atStart = true;
    while (pos < len) {
      const c = text[pos] as string;
      if (c === "_") {
        if (atStart || prevUnderscore) {
          violation = true; // leading or consecutive underscore
        }
        prevUnderscore = true;
        atStart = false;
        pos += 1;
        continue;
      }
      if (isClass(c)) {
        raw += c;
        prevUnderscore = false;
        atStart = false;
        pos += 1;
        continue;
      }
      break;
    }
    if (prevUnderscore) {
      violation = true; // trailing underscore
    }
    if (violation) {
      emitInvalidUnderscore(litStart);
    }
    return raw;
  }

  /** Parses `raw` (already underscore-stripped) in `radix`, saturating at 65535. */
  function finishNumber(litStart: number, raw: string, radix: number): Token {
    const parsed = raw.length > 0 ? parseInt(raw, radix) : 0;
    let value = parsed;
    if (parsed > MAX_NUMERIC) {
      emitOverflow(litStart, parsed); // E10216
      value = MAX_NUMERIC;
    }
    return makeToken(TokenKind.Number, litStart, value);
  }

  /** Scans a decimal literal (FR-11); flags overflow (E10216) and leading zeros (W10210). */
  function scanDecimal(): Token {
    const start = pos;
    const raw = scanDigitRun(start, isDigit);
    const parsed = raw.length > 0 ? parseInt(raw, 10) : 0;
    let value = parsed;
    if (parsed > MAX_NUMERIC) {
      emitOverflow(start, parsed);
      value = MAX_NUMERIC;
    }
    if (raw.length > 1 && raw[0] === "0") {
      emitLeadingZeros(start, value);
    }
    return makeToken(TokenKind.Number, start, value);
  }

  /** Scans a `$`-prefixed hex literal (FR-12); bare `$` → E10214 with value 0. */
  function scanHexDollar(): Token {
    const start = pos;
    pos += 1; // consume '$'
    const c = text[pos];
    if (c === undefined || (!isHexDigit(c) && c !== "_")) {
      emitBadHex(start, "$");
      return makeToken(TokenKind.Number, start, 0);
    }
    return finishNumber(start, scanDigitRun(start, isHexDigit), 16);
  }

  /** Scans a `0x`-prefixed hex literal (FR-13); bare `0x` → E10214 with value 0. */
  function scanHex0x(): Token {
    const start = pos;
    pos += 2; // consume '0x' / '0X'
    const c = text[pos];
    if (c === undefined || (!isHexDigit(c) && c !== "_")) {
      emitBadHex(start, "0x");
      return makeToken(TokenKind.Number, start, 0);
    }
    return finishNumber(start, scanDigitRun(start, isHexDigit), 16);
  }

  /** Scans a `0b`-prefixed binary literal (FR-14); bare `0b` → E10215 with value 0. */
  function scanBinary(): Token {
    const start = pos;
    pos += 2; // consume '0b' / '0B'
    const c = text[pos];
    if (c === undefined || (!isBinDigit(c) && c !== "_")) {
      emitBadBinary(start);
      return makeToken(TokenKind.Number, start, 0);
    }
    return finishNumber(start, scanDigitRun(start, isBinDigit), 2);
  }

  /** Reports a literal newline inside a string literal (E10217). */
  function emitNewlineInString(litStart: number): void {
    bag.addError(
      DiagCode.NewlineInString,
      makeSpan(sourceId, litStart, pos),
      "Newline in string literal — strings must be on a single line. Use \\n for newline characters",
    );
  }

  /** Reports a string with no closing `"` before end of line or file (E10218). */
  function emitUnterminatedString(litStart: number): void {
    bag.addError(
      DiagCode.UnterminatedString,
      makeSpan(sourceId, litStart, pos),
      'Unterminated string literal — expected closing \'"\' before end of line',
    );
  }

  /** Reports a backslash followed by a character outside the closed escape set (E10219). */
  function emitUnknownEscape(escPos: number, ch: string): void {
    bag.addError(
      DiagCode.UnknownEscapeSequence,
      makeSpan(sourceId, escPos, escPos + 2),
      `Unknown escape sequence '\\${ch}' — valid escapes are: \\\\, \\", \\', \\n, \\r, \\t, \\0, \\xNN`,
    );
  }

  /** Reports a `\x` escape with fewer than two hex digits (E10220). */
  function emitIncompleteHexEscape(escPos: number): void {
    const seen = text.slice(escPos, pos);
    bag.addError(
      DiagCode.IncompleteHexEscape,
      makeSpan(sourceId, escPos, pos),
      `Incomplete hex escape '${seen}' — \\x requires exactly two hex digits (e.g., \\x41)`,
    );
  }

  /** Reports an empty char literal `''` (E10221). */
  function emitEmptyChar(litStart: number): void {
    bag.addError(
      DiagCode.EmptyCharLiteral,
      makeSpan(sourceId, litStart, pos),
      "Empty character literal — char literals must contain exactly one character or escape sequence",
    );
  }

  /** Reports a char literal holding more than one character (E10222). */
  function emitMultiChar(litStart: number): void {
    const literal = text.slice(litStart, pos);
    bag.addError(
      DiagCode.MultiCharLiteral,
      makeSpan(sourceId, litStart, pos),
      `Multi-character literal '${literal}' — char literals must contain exactly one character. Use a string literal for multiple characters`,
    );
  }

  /** Reports a char literal with no closing `'` (E10223). */
  function emitUnterminatedChar(litStart: number): void {
    bag.addError(
      DiagCode.UnterminatedCharLiteral,
      makeSpan(sourceId, litStart, pos),
      "Unterminated character literal — expected closing '",
    );
  }

  /**
   * Validates one escape sequence shared by strings and chars (FR-19; §7.2).
   * `pos` is at the backslash on entry. The raw `\…` text is left in place (the
   * caller captures it via `text.slice`); only validation diagnostics are
   * emitted — byte resolution is RD-04's job. `\?` → E10219, short `\x` → E10220;
   * neither terminates the literal (the caller keeps scanning to the delimiter).
   */
  function validateEscape(): void {
    const escPos = pos;
    pos += 1; // consume the backslash
    if (pos >= len) {
      return; // dangling backslash at EOF — the caller's terminator logic handles it
    }
    const c = text[pos] as string;
    if (
      c === "\\" || c === '"' || c === "'" ||
      c === "n" || c === "r" || c === "t" || c === "0"
    ) {
      pos += 1; // valid simple escape
      return;
    }
    if (c === "x") {
      pos += 1; // consume 'x'
      const h1 = peek(0);
      const h2 = peek(1);
      if (h1 !== undefined && h2 !== undefined && isHexDigit(h1) && isHexDigit(h2)) {
        pos += 2; // valid \xNN
        return;
      }
      emitIncompleteHexEscape(escPos); // E10220 — keep '\x…' raw, leave the rest
      return;
    }
    emitUnknownEscape(escPos, c); // E10219 — keep '\<c>' raw
    pos += 1;
  }

  /**
   * Scans a double-quoted string literal (FR-17; §7). `Token.value` holds the raw
   * content between the quotes with escapes kept literally (resolved later by
   * RD-04). A literal newline ends the string with E10217; EOF before the closing
   * quote ends it with E10218 — either way a `String` token is still produced.
   */
  function scanString(): Token {
    const start = pos;
    pos += 1; // consume the opening '"'
    let value = "";
    while (pos < len) {
      const c = text[pos] as string;
      if (c === '"') {
        pos += 1; // consume the closing '"'
        return makeToken(TokenKind.String, start, value);
      }
      if (c === "\n" || c === "\r") {
        emitNewlineInString(start); // E10217 — newline left for skipWhitespace
        return makeToken(TokenKind.String, start, value);
      }
      if (c === "\\") {
        const escStart = pos;
        validateEscape();
        value += text.slice(escStart, pos);
        continue;
      }
      value += c;
      pos += 1;
    }
    emitUnterminatedString(start); // E10218 — reached EOF with no closing quote
    return makeToken(TokenKind.String, start, value);
  }

  /**
   * Scans a single-quoted character literal (FR-18; §8). `Token.value` holds the
   * one char/escape (raw). Recovery: empty `''` → E10221 (value `""`); multi-char
   * `'AB'` → E10222 (value = first unit); no closing `'` → E10223. A `Char` token
   * is always produced.
   */
  function scanChar(): Token {
    const start = pos;
    pos += 1; // consume the opening "'"
    const units: string[] = [];
    let terminated = false;
    while (pos < len) {
      const c = text[pos] as string;
      if (c === "'") {
        pos += 1; // consume the closing "'"
        terminated = true;
        break;
      }
      if (c === "\n" || c === "\r") {
        break; // newline ends an unterminated char literal; leave it for whitespace
      }
      if (c === "\\") {
        const escStart = pos;
        validateEscape();
        units.push(text.slice(escStart, pos));
        continue;
      }
      units.push(c);
      pos += 1;
    }
    const value = units.length > 0 ? (units[0] as string) : "";
    if (!terminated) {
      emitUnterminatedChar(start); // E10223
      return makeToken(TokenKind.Char, start, value);
    }
    if (units.length === 0) {
      emitEmptyChar(start); // E10221
      return makeToken(TokenKind.Char, start, "");
    }
    if (units.length > 1) {
      emitMultiChar(start); // E10222 — keep the first unit as the value
    }
    return makeToken(TokenKind.Char, start, value);
  }

  /**
   * Scans an operator or punctuation token using maximal munch (FR-24): a
   * 3-char operator is tried before 2-char before 1-char, so `<<=` never
   * splits into `<<` + `=`. Returns `null` when the character begins neither an
   * operator nor punctuation, so the caller can report E10210.

   */
  function scanOperatorOrPunctuation(): Token | null {
    const start = pos;
    const three = text.slice(pos, pos + 3);

    if (three === "<<=") {
      pos += 3;
      return makeToken(TokenKind.ShiftLeftEqual, start);
    }
    if (three === ">>=") {
      pos += 3;
      return makeToken(TokenKind.ShiftRightEqual, start);
    }

    const two = text.slice(pos, pos + 2);
    const twoKind = TWO_CHAR_OPERATORS.get(two);
    if (twoKind !== undefined) {
      pos += 2;
      return makeToken(twoKind, start);
    }

    const one = text[pos] as string;
    const oneKind = ONE_CHAR_TOKENS.get(one);
    if (oneKind !== undefined) {
      pos += 1;
      return makeToken(oneKind, start);
    }

    return null;
  }

  /**
   * Reports an unexpected (non-token) character (E10210) and skips exactly one
   * code unit so the main loop always makes progress (FR-30, FR-34).
   */
  function emitUnexpectedChar(start: number): void {
    const codePoint = text.codePointAt(start) ?? 0;
    const ch = String.fromCodePoint(codePoint);
    const hex = codePoint.toString(16).toUpperCase().padStart(4, "0");
    bag.addError(
      DiagCode.UnexpectedCharacter,
      makeSpan(sourceId, start, start + 1),
      `Unexpected character '${ch}' (U+${hex}) — only ASCII characters are valid in Blend65 source code`,
    );
    pos += 1; // skip the single offending code unit
  }

  // Skip a single leading BOM; it belongs to no token's span (FR-29).
  if (text[0] === BOM) {
    pos = 1;
  }

  while (pos < len) {
    skipWhitespace();
    if (pos >= len) {
      break;
    }

    const start = pos;
    const ch = text[pos] as string;

    // 1. Comments are recognized before operator scanning so a `//` or `/*`
    //    is never mistaken for a `Slash` (FR-23, §11.3).
    if (ch === "/" && peek(1) === "/") {
      skipLineComment();
      continue;
    }
    if (ch === "/" && peek(1) === "*") {
      skipBlockComment();
      continue;
    }

    // 2. Numeric literals: `$`hex, `0x`hex, `0b`binary, decimal (FR-11..16,
    //    §11.2). The prefix forms are checked before plain decimal so `0x`/`0b`
    //    are never mis-scanned as a leading-zero decimal.
    if (ch === "$") {
      tokens.push(scanHexDollar());
      continue;
    }
    if (isDigit(ch)) {
      const next = peek(1);
      if (ch === "0" && (next === "x" || next === "X")) {
        tokens.push(scanHex0x());
        continue;
      }
      if (ch === "0" && (next === "b" || next === "B")) {
        tokens.push(scanBinary());
        continue;
      }
      tokens.push(scanDecimal());
      continue;
    }

    // 3. String and character literals (FR-17, FR-18; §11.2 steps 1–2).
    if (ch === '"') {
      tokens.push(scanString());
      continue;
    }
    if (ch === "'") {
      tokens.push(scanChar());
      continue;
    }

    // 4. Identifiers and keywords.
    if (isIdentStart(ch)) {

      tokens.push(scanIdentifier());
      continue;
    }

    // 5. Operators (maximal munch) and punctuation.
    const op = scanOperatorOrPunctuation();
    if (op !== null) {
      tokens.push(op);
      continue;
    }

    // 6. Anything else is an unexpected character (E10210); skip one unit.
    emitUnexpectedChar(start);

  }


  tokens.push(makeToken(TokenKind.Eof, pos));
  return { tokens, lineMap: new LineMap(sourceId, text) };
}

/** Two-character operators, mapped to their kinds (maximal-munch tier 2). */
const TWO_CHAR_OPERATORS: ReadonlyMap<string, TokenKindValue> = new Map([
  ["<<", TokenKind.ShiftLeft],
  [">>", TokenKind.ShiftRight],
  ["&&", TokenKind.LogicalAnd],
  ["||", TokenKind.LogicalOr],
  ["==", TokenKind.EqualEqual],
  ["!=", TokenKind.BangEqual],
  ["<=", TokenKind.LessEqual],
  [">=", TokenKind.GreaterEqual],
  ["+=", TokenKind.PlusEqual],
  ["-=", TokenKind.MinusEqual],
  ["*=", TokenKind.StarEqual],
  ["/=", TokenKind.SlashEqual],
  ["%=", TokenKind.PercentEqual],
  ["&=", TokenKind.AmpersandEqual],
  ["|=", TokenKind.PipeEqual],
  ["^=", TokenKind.CaretEqual],
]);

/** Single-character operators and punctuation, mapped to their kinds (tier 3). */
const ONE_CHAR_TOKENS: ReadonlyMap<string, TokenKindValue> = new Map([
  // Operators
  ["+", TokenKind.Plus],
  ["-", TokenKind.Minus],
  ["*", TokenKind.Star],
  ["/", TokenKind.Slash],
  ["%", TokenKind.Percent],
  ["&", TokenKind.Ampersand],
  ["|", TokenKind.Pipe],
  ["^", TokenKind.Caret],
  ["~", TokenKind.Tilde],
  ["<", TokenKind.Less],
  [">", TokenKind.Greater],
  ["=", TokenKind.Equal],
  ["!", TokenKind.Bang],
  ["?", TokenKind.Question],
  // Punctuation
  ["(", TokenKind.LParen],
  [")", TokenKind.RParen],
  ["[", TokenKind.LBracket],
  ["]", TokenKind.RBracket],
  ["{", TokenKind.LBrace],
  ["}", TokenKind.RBrace],
  [",", TokenKind.Comma],
  [";", TokenKind.Semicolon],
  [":", TokenKind.Colon],
  [".", TokenKind.Dot],
]);
