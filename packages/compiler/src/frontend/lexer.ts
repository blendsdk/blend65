import { firstUnpairedSurrogate } from "../project/positions.js";
import { escapeDiagnosticText, projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceRecord, SourceSpan } from "../project/types.js";
import { LITERAL_ITEM_KIND, PAYLOAD_KIND, TokenKind } from "./tokens.js";
import type { LexResult, LiteralItem, Token, TokenPayload } from "./tokens.js";

/** Source escape prefix, used directly in readable diagnostic spellings. */
const BACKSLASH = String.fromCharCode(92);
/** Closed escape suffixes; hex byte escapes are scanned separately. */
const SYMBOLIC_ESCAPES = new Set([BACKSLASH, '"', "'", "n", "r", "t", "0"]);
/** Canonical list expressed as source spellings, not host-string escaping. */
const VALID_ESCAPES = [...SYMBOLIC_ESCAPES, "xNN"]
  .map((suffix) => "'" + BACKSLASH + suffix + "'")
  .join(", ");

/** Exact keyword spellings; contextual and intrinsic names deliberately are absent. */
const KEYWORDS: ReadonlyMap<string, TokenKind> = new Map([
  ["module", TokenKind.KW_MODULE],
  ["import", TokenKind.KW_IMPORT],
  ["export", TokenKind.KW_EXPORT],
  ["from", TokenKind.KW_FROM],
  ["function", TokenKind.KW_FUNCTION],
  ["return", TokenKind.KW_RETURN],
  ["interrupt", TokenKind.KW_INTERRUPT],
  ["fn", TokenKind.KW_FN],
  ["comptime", TokenKind.KW_COMPTIME],
  ["if", TokenKind.KW_IF],
  ["else", TokenKind.KW_ELSE],
  ["while", TokenKind.KW_WHILE],
  ["do", TokenKind.KW_DO],
  ["for", TokenKind.KW_FOR],
  ["switch", TokenKind.KW_SWITCH],
  ["case", TokenKind.KW_CASE],
  ["default", TokenKind.KW_DEFAULT],
  ["fallthrough", TokenKind.KW_FALLTHROUGH],
  ["break", TokenKind.KW_BREAK],
  ["continue", TokenKind.KW_CONTINUE],
  ["let", TokenKind.KW_LET],
  ["const", TokenKind.KW_CONST],
  ["loadable", TokenKind.KW_LOADABLE],
  ["place", TokenKind.KW_PLACE],
  ["zeropage", TokenKind.KW_ZEROPAGE],
  ["struct", TokenKind.KW_STRUCT],
  ["byte", TokenKind.KW_BYTE],
  ["sbyte", TokenKind.KW_SBYTE],
  ["word", TokenKind.KW_WORD],
  ["sword", TokenKind.KW_SWORD],
  ["boolean", TokenKind.KW_BOOLEAN],
  ["void", TokenKind.KW_VOID],
  ["true", TokenKind.KW_TRUE],
  ["false", TokenKind.KW_FALSE],
  ["enum", TokenKind.KW_ENUM],
  ["type", TokenKind.KW_TYPE],
]);

/** Fixed operator and punctuation spellings, consumed longest first. */
const FIXED_TOKENS: ReadonlyMap<string, TokenKind> = new Map([
  ["<<=", TokenKind.SHIFT_LEFT_EQUAL],
  [">>=", TokenKind.SHIFT_RIGHT_EQUAL],
  ["<<", TokenKind.SHIFT_LEFT],
  [">>", TokenKind.SHIFT_RIGHT],
  ["&&", TokenKind.LOGICAL_AND],
  ["||", TokenKind.LOGICAL_OR],
  ["==", TokenKind.EQUAL_EQUAL],
  ["!=", TokenKind.BANG_EQUAL],
  ["<=", TokenKind.LESS_EQUAL],
  [">=", TokenKind.GREATER_EQUAL],
  ["+=", TokenKind.PLUS_EQUAL],
  ["-=", TokenKind.MINUS_EQUAL],
  ["*=", TokenKind.STAR_EQUAL],
  ["/=", TokenKind.SLASH_EQUAL],
  ["%=", TokenKind.PERCENT_EQUAL],
  ["&=", TokenKind.AMPERSAND_EQUAL],
  ["|=", TokenKind.PIPE_EQUAL],
  ["^=", TokenKind.CARET_EQUAL],
  ["+", TokenKind.PLUS],
  ["-", TokenKind.MINUS],
  ["*", TokenKind.STAR],
  ["/", TokenKind.SLASH],
  ["%", TokenKind.PERCENT],
  ["&", TokenKind.AMPERSAND],
  ["|", TokenKind.PIPE],
  ["^", TokenKind.CARET],
  ["~", TokenKind.TILDE],
  ["!", TokenKind.BANG],
  ["<", TokenKind.LESS],
  [">", TokenKind.GREATER],
  ["=", TokenKind.EQUAL],
  ["?", TokenKind.QUESTION],
  [":", TokenKind.COLON],
  ["(", TokenKind.LPAREN],
  [")", TokenKind.RPAREN],
  ["[", TokenKind.LBRACKET],
  ["]", TokenKind.RBRACKET],
  ["{", TokenKind.LBRACE],
  ["}", TokenKind.RBRACE],
  [",", TokenKind.COMMA],
  [";", TokenKind.SEMICOLON],
  [".", TokenKind.DOT],
]);

/**
 * Track UTF-16 indexing separately from raw UTF-8 byte positions.
 * Advancing one scalar never splits a surrogate pair; CRLF is one line break.
 */
class SourceCursor {
  /** UTF-16 offset used only to index the original host string. */
  index = 0;
  /** Raw UTF-8 offset used for source spans. */
  byte = 0;
  /** One-based source line. */
  line = 1;
  /** One-based byte column. */
  column = 1;
  private previousCR = false;

  /** Keep the immutable source; no reads or normalization occur. */
  constructor(
    /** Original decoded source. */
    readonly source: SourceRecord,
  ) {}

  /** Current Unicode scalar, or the empty EOF sentinel. */
  get current(): string {
    const point = this.source.text.codePointAt(this.index);
    return point === undefined ? "" : String.fromCodePoint(point);
  }

  /** Move one scalar while retaining exact byte and newline accounting. */
  advance(): void {
    const scalar = this.current;
    if (scalar === "") return;
    const width = Buffer.byteLength(scalar);
    this.index += scalar.length;
    this.byte += width;
    if (scalar === "\r") {
      this.line += 1;
      this.column = 1;
    } else if (scalar === "\n") {
      if (!this.previousCR) this.line += 1;
      this.column = 1;
    } else {
      this.column += width;
    }
    this.previousCR = scalar === "\r";
  }

  /** Located raw-byte region ending at the current cursor. */
  span(start: number): SourceSpan {
    return Object.freeze({ sourceId: this.source.sourceId, start, end: this.byte });
  }
}

/**
 * Scan an immutable decoded source without host reads or target conversion.
 * Invalid regions never gain substitute token values.
 * @throws RangeError if a forged record has ill-formed Unicode or inconsistent bytes.
 * @example lexSource(sourceRecord).tokens // recognized tokens followed by EOF
 */
export function lexSource(source: SourceRecord): LexResult {
  if (
    firstUnpairedSurrogate(source.text) !== null ||
    Buffer.byteLength(source.text) !== source.byteLength
  ) {
    throw new RangeError("Expected an exact decoded UTF-8 source record");
  }
  const cursor = new SourceCursor(source);
  if (cursor.current === "\uFEFF") cursor.advance();
  const tokens: Token[] = [];
  const diagnostics: ProjectDiagnostic[] = [];
  const poisoned: SourceSpan[] = [];
  let errors = 0;
  let complete = true;

  /** Collect one root; the caller records the entire rejected lexeme separately. */
  function report(code: string, message: string, span: SourceSpan): void {
    diagnostics.push(projectDiagnostic(code, message, span));
    errors += 1;
  }

  /** Reject the original numeric spelling without inventing a valid value. */
  function number(start: number, index: number, line: number, column: number): void {
    let prefix = "";
    let radix = 10;
    let digit = /^[0-9]$/;
    if (cursor.current === "$") {
      prefix = "$";
      radix = 16;
      digit = /^[0-9a-fA-F]$/;
      cursor.advance();
    } else if (/^0[xXbB]/.test(source.text.slice(cursor.index, cursor.index + 2))) {
      prefix = source.text.slice(cursor.index, cursor.index + 2);
      radix = prefix[1]!.toLowerCase() === "x" ? 16 : 2;
      digit = radix === 16 ? /^[0-9a-fA-F]$/ : /^[01]$/;
      cursor.advance();
      cursor.advance();
    }
    const digitsStart = cursor.index;
    // Once a radix digit starts the literal, maximal munch follows that radix's
    // grammar. A later identifier is its own token. A missing first digit instead
    // consumes the failed prefix attempt (such as 0bytes) for one root diagnostic.
    if (digit.test(cursor.current) || cursor.current === "_") {
      while (digit.test(cursor.current) || cursor.current === "_") cursor.advance();
    } else {
      while (/^[A-Za-z0-9_]$/.test(cursor.current)) cursor.advance();
    }
    const raw = source.text.slice(index, cursor.index);
    const digits = source.text.slice(digitsStart, cursor.index);
    const location = cursor.span(start);
    let code: string | null = null;
    let message = "";
    // Separators are checked before conversion so BigInt never sees malformed input.
    for (let offset = 0; offset < digits.length; offset += 1) {
      if (
        digits[offset] === "_" &&
        (!digit.test(digits[offset - 1] ?? "") || !digit.test(digits[offset + 1] ?? ""))
      ) {
        code = "E10213";
        message =
          "Invalid underscore in numeric literal — underscores must occur singly between digits";
        break;
      }
    }
    const normalized = digits.replaceAll("_", "");
    if (code === null && (normalized === "" || [...normalized].some((char) => !digit.test(char)))) {
      code = radix === 16 ? "E10214" : "E10215";
      message =
        radix === 16
          ? `Invalid hexadecimal literal — expected a hexadecimal digit after '${prefix}'`
          : "Invalid binary literal — expected '0' or '1' after '0b'";
    }
    if (code !== null) {
      report(code, message, location);
      poisoned.push(location);
      return;
    }
    const value = BigInt((radix === 16 ? "0x" : radix === 2 ? "0b" : "") + normalized);
    if (value > 65535n) {
      report("E10216", `Numeric literal ${value} exceeds 65535`, location);
      poisoned.push(location);
      return;
    }
    tokens.push(
      Object.freeze({
        kind: TokenKind.NUMBER,
        span: location,
        line,
        column,
        payload: Object.freeze({ kind: PAYLOAD_KIND.number, value }),
      }),
    );
    if (radix === 10 && normalized.length > 1 && normalized[0] === "0") {
      diagnostics.push(
        Object.freeze({
          ...projectDiagnostic(
            "W10210",
            `Numeric literal '${raw}' has leading zeros — it is decimal ${value}, not octal`,
            location,
          ),
          severity: "warning",
        }),
      );
    }
  }

  /** Preserve literal content; rejected regions retain independent escape errors. */
  function literal(start: number, index: number, line: number, column: number): void {
    const quote = cursor.current;
    const kind = quote === '"' ? TokenKind.STRING : TokenKind.CHAR;
    const items: LiteralItem[] = [];
    let invalid = false;
    cursor.advance();

    /** Suppress cardinality/termination cascades from an already rejected content unit. */
    function reject(
      code: string,
      message: string,
      location: SourceSpan,
      independent = false,
    ): void {
      if (!invalid || independent) {
        if (errors < 20) report(code, message, location);
        else complete = false;
      }
      invalid = true;
    }

    while (cursor.current !== "" && cursor.current !== quote) {
      if (errors === 20) {
        complete = false;
        // Only locate a safe boundary after the ceiling; do not validate the rest.
        while (
          cursor.current !== "" &&
          cursor.current !== quote &&
          cursor.current !== "\r" &&
          cursor.current !== "\n"
        ) {
          const escaped = cursor.current === BACKSLASH;
          cursor.advance();
          if (escaped && cursor.current !== "\r" && cursor.current !== "\n") cursor.advance();
        }
        break;
      }
      if (cursor.current === "\r" || cursor.current === "\n") {
        reject(
          kind === TokenKind.STRING ? "E10217" : "E10223",
          kind === TokenKind.STRING
            ? "Newline in string literal — use an escape sequence"
            : "Unterminated character literal — expected closing single quote",
          kind === TokenKind.STRING
            ? Object.freeze({ sourceId: source.sourceId, start: cursor.byte, end: cursor.byte + 1 })
            : cursor.span(start),
          true,
        );
        break;
      }
      const itemStart = cursor.byte;
      const itemIndex = cursor.index;
      const scalar = cursor.current;
      cursor.advance();
      if (scalar !== BACKSLASH) {
        if (!invalid)
          items.push(
            Object.freeze({
              kind: LITERAL_ITEM_KIND.scalar,
              value: scalar,
              span: cursor.span(itemStart),
            }),
          );
        continue;
      }
      const suffix = cursor.current;
      // Never consume the newline: the outer loop owns its line boundary.
      if (suffix === "" || suffix === "\r" || suffix === "\n") continue;
      cursor.advance();
      if (suffix === "x") {
        let hex = "";
        while (hex.length < 2 && /^[0-9a-fA-F]$/.test(cursor.current)) {
          hex += cursor.current;
          cursor.advance();
        }
        if (hex.length !== 2) {
          reject(
            "E10220",
            "Incomplete hexadecimal escape — '" +
              BACKSLASH +
              "x' requires exactly two hexadecimal digits",
            cursor.span(itemStart),
            true,
          );
        } else if (!invalid) {
          items.push(
            Object.freeze({
              kind: LITERAL_ITEM_KIND.byte,
              value: Number.parseInt(hex, 16),
              span: cursor.span(itemStart),
            }),
          );
        }
      } else if (SYMBOLIC_ESCAPES.has(suffix)) {
        if (!invalid)
          items.push(
            Object.freeze({
              kind: LITERAL_ITEM_KIND.escape,
              value: source.text.slice(itemIndex, cursor.index),
              span: cursor.span(itemStart),
            }),
          );
      } else {
        reject(
          "E10219",
          "Unknown escape sequence '" +
            BACKSLASH +
            escapeDiagnosticText(suffix) +
            "' — valid escapes: " +
            VALID_ESCAPES,
          cursor.span(itemStart),
          true,
        );
      }
    }
    const contentEnd = cursor.index;
    if (cursor.current === quote) {
      cursor.advance();
      if (kind === TokenKind.CHAR && items.length !== 1) {
        reject(
          items.length === 0 ? "E10221" : "E10222",
          items.length === 0
            ? "Empty character literal — use exactly one character or escape sequence"
            : "Multi-character literal '" +
                escapeDiagnosticText(source.text.slice(index + 1, contentEnd)) +
                "' — use a double-quoted string for multiple characters",
          cursor.span(start),
        );
      }
    } else if (cursor.current !== "\r" && cursor.current !== "\n") {
      reject(
        kind === TokenKind.STRING ? "E10218" : "E10223",
        kind === TokenKind.STRING
          ? "Unterminated string literal — expected closing '\"' before end of line"
          : "Unterminated character literal — expected closing single quote",
        cursor.span(start),
        true,
      );
    }
    if (invalid) {
      poisoned.push(cursor.span(start));
    } else {
      tokens.push(
        Object.freeze({
          kind,
          span: cursor.span(start),
          line,
          column,
          payload: Object.freeze({ kind: PAYLOAD_KIND.literal, items: Object.freeze(items) }),
        }),
      );
    }
  }

  while (cursor.current !== "") {
    if (errors === 20) {
      complete = false;
      const start = cursor.byte;
      // Account for the EOF position, but do not pretend these bytes were checked.
      while (cursor.current !== "") cursor.advance();
      poisoned.push(cursor.span(start));
      break;
    }
    if (/^[ \t\r\n]$/.test(cursor.current)) {
      cursor.advance();
      continue;
    }
    const start = cursor.byte;
    const index = cursor.index;
    const line = cursor.line;
    const column = cursor.column;
    if (source.text.startsWith("//", index)) {
      while (cursor.current !== "" && cursor.current !== "\r" && cursor.current !== "\n")
        cursor.advance();
      continue;
    }
    if (source.text.startsWith("/*", index)) {
      cursor.advance();
      cursor.advance();
      while (cursor.current !== "" && !source.text.startsWith("*/", cursor.index)) cursor.advance();
      if (cursor.current === "") {
        report(
          "E10211",
          "Unterminated block comment — expected '*/' before end of file",
          cursor.span(start),
        );
        poisoned.push(cursor.span(start));
      } else {
        cursor.advance();
        cursor.advance();
      }
      continue;
    }
    if (cursor.current === '"' || cursor.current === "'") {
      literal(start, index, line, column);
      continue;
    }
    if (cursor.current === "$" || /^[0-9]$/.test(cursor.current)) {
      number(start, index, line, column);
      continue;
    }
    let kind: TokenKind | undefined;
    let payload: TokenPayload = null;
    if (/^[A-Za-z_]$/.test(cursor.current)) {
      do {
        cursor.advance();
      } while (/^[A-Za-z0-9_]$/.test(cursor.current));
      const text = source.text.slice(index, cursor.index);
      kind = KEYWORDS.get(text) ?? TokenKind.IDENTIFIER;
      if (kind === TokenKind.IDENTIFIER)
        payload = Object.freeze({ kind: PAYLOAD_KIND.identifier, text });
    } else {
      for (let length = 3; length >= 1; length -= 1) {
        kind = FIXED_TOKENS.get(source.text.slice(index, index + length));
        if (kind !== undefined) {
          for (let count = 0; count < length; count += 1) cursor.advance();
          break;
        }
      }
    }
    if (kind === undefined) {
      const char = cursor.current;
      cursor.advance();
      report(
        "E10210",
        `Unexpected character '${escapeDiagnosticText(char)}' (U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}) — non-ASCII characters are allowed only inside string literals, character literals, and comments`,
        cursor.span(start),
      );
      poisoned.push(cursor.span(start));
    } else {
      tokens.push(Object.freeze({ kind, span: cursor.span(start), line, column, payload }));
    }
  }
  tokens.push(
    Object.freeze({
      kind: TokenKind.EOF,
      span: cursor.span(cursor.byte),
      line: cursor.line,
      column: cursor.column,
      payload: null,
    }),
  );
  return Object.freeze({
    tokens: Object.freeze(tokens),
    // All reports share one source. Stable sorting preserves producer order for
    // equal keys, while a late-discovered boundary error can sort before its content.
    diagnostics: Object.freeze(
      diagnostics.sort(
        (left, right) =>
          (left.primarySpan?.start ?? Infinity) - (right.primarySpan?.start ?? Infinity) ||
          (left.primarySpan?.end ?? Infinity) - (right.primarySpan?.end ?? Infinity) ||
          (left.code < right.code ? -1 : left.code > right.code ? 1 : 0),
      ),
    ),
    complete,
    poisoned: Object.freeze(poisoned),
  });
}
