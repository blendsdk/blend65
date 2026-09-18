import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SourceRecord, SourceSpan } from "../project/types.js";
import { lexSource } from "./lexer.js";

/** Construct exact decoded input without loading or changing any host file. */
function source(text: string): SourceRecord {
  return {
    sourceId: "game.blend",
    text,
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/unused/game.blend",
  };
}

function span(start: number, end: number): SourceSpan {
  return { sourceId: "game.blend", start, end };
}

describe("source lexing", () => {
  // Skipped syntax still occupies its original bytes and columns.
  it("should preserve raw byte coordinates through a BOM and Unicode comment", () => {
    const input = source("\uFEFFmodule Game;\r\n/*é🎮*/let x: byte = 1;");
    const result = lexSource(input);
    expect(result.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.poisoned).toEqual([]);
    expect(result.tokens.map((token) => token.kind)).toEqual([
      "KW_MODULE",
      "IDENTIFIER",
      "SEMICOLON",
      "KW_LET",
      "IDENTIFIER",
      "COLON",
      "KW_BYTE",
      "EQUAL",
      "NUMBER",
      "SEMICOLON",
      "EOF",
    ]);
    expect(result.tokens[0]).toEqual({
      kind: "KW_MODULE",
      span: span(3, 9),
      line: 1,
      column: 4,
      payload: null,
    });
    expect(result.tokens[3]).toEqual({
      kind: "KW_LET",
      span: span(27, 30),
      line: 2,
      column: 11,
      payload: null,
    });
    expect(result.tokens.at(-1)).toEqual({
      kind: "EOF",
      span: span(input.byteLength, input.byteLength),
      line: 2,
      column: 27,
      payload: null,
    });
    expect(input.text).toBe("\uFEFFmodule Game;\r\n/*é🎮*/let x: byte = 1;");
  });

  // Radix and separators change the value, never the raw source span.
  it("should normalize numeric values and warn only for decimal leading zeros", () => {
    const input = source("255 256 $FF 0Xff 0b1111 1_000 007");
    const result = lexSource(input);
    expect(result.complete).toBe(true);
    expect(result.poisoned).toEqual([]);
    expect(result.tokens.map((token) => token.kind)).toEqual([
      "NUMBER",
      "NUMBER",
      "NUMBER",
      "NUMBER",
      "NUMBER",
      "NUMBER",
      "NUMBER",
      "EOF",
    ]);
    expect(result.tokens.slice(0, -1).map((token) => token.payload)).toEqual(
      [255n, 256n, 255n, 255n, 15n, 1000n, 7n].map((value) => ({ kind: "number", value })),
    );
    expect(result.tokens.slice(0, -1).map((token) => token.span)).toEqual([
      span(0, 3),
      span(4, 7),
      span(8, 11),
      span(12, 16),
      span(17, 23),
      span(24, 29),
      span(30, 33),
    ]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "W10210",
      severity: "warning",
      primarySpan: span(30, 33),
      message: "Numeric literal '007' has leading zeros — it is decimal 7, not octal",
      related: [],
      pointer: null,
    });
  });

  // Contextual and intrinsic names stay identifiers until their owning later stage.
  it("should distinguish keyword case without reserving contextual or intrinsic identifiers", () => {
    const result = lexSource(source("for For as until to downto step peek type"));
    expect(result.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.poisoned).toEqual([]);
    expect(result.tokens.map((token) => token.kind)).toEqual([
      "KW_FOR",
      "IDENTIFIER",
      "IDENTIFIER",
      "IDENTIFIER",
      "IDENTIFIER",
      "IDENTIFIER",
      "IDENTIFIER",
      "IDENTIFIER",
      "KW_TYPE",
      "EOF",
    ]);
    expect(result.tokens.slice(1, 8).map((token) => token.payload)).toEqual(
      ["For", "as", "until", "to", "downto", "step", "peek"].map((text) => ({
        kind: "identifier",
        text,
      })),
    );
    expect(result.tokens[8]?.payload).toBeNull();
    expect(lexSource(source("let peek: byte = 1;")).diagnostics).toEqual([]);
  });

  // Longest operator matches happen after comment detection; block comments do not nest.
  it("should use longest operator matches and end a block comment at its first closer", () => {
    const result = lexSource(source("a<<=1; a&&b; a!=b; a/=2; //é\n/* one /* two */x"));
    expect(result.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.poisoned).toEqual([]);
    expect(result.tokens.map((token) => token.kind)).toEqual([
      "IDENTIFIER",
      "SHIFT_LEFT_EQUAL",
      "NUMBER",
      "SEMICOLON",
      "IDENTIFIER",
      "LOGICAL_AND",
      "IDENTIFIER",
      "SEMICOLON",
      "IDENTIFIER",
      "BANG_EQUAL",
      "IDENTIFIER",
      "SEMICOLON",
      "IDENTIFIER",
      "SLASH_EQUAL",
      "NUMBER",
      "SEMICOLON",
      "IDENTIFIER",
      "EOF",
    ]);
    expect(result.tokens.at(-2)?.payload).toEqual({ kind: "identifier", text: "x" });
  });

  // Literal recognition preserves source meaning and leaves target encoding undecided.
  it("should preserve an empty string a character Unicode a symbolic escape and an exact byte", () => {
    const result = lexSource(source('"" \'A\' "£\\n\\x41"'));
    expect(result.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.poisoned).toEqual([]);
    expect(result.tokens).toEqual([
      {
        kind: "STRING",
        span: span(0, 2),
        line: 1,
        column: 1,
        payload: { kind: "literal", items: [] },
      },
      {
        kind: "CHAR",
        span: span(3, 6),
        line: 1,
        column: 4,
        payload: { kind: "literal", items: [{ kind: "scalar", value: "A", span: span(4, 5) }] },
      },
      {
        kind: "STRING",
        span: span(7, 17),
        line: 1,
        column: 8,
        payload: {
          kind: "literal",
          items: [
            { kind: "scalar", value: "£", span: span(8, 10) },
            { kind: "escape", value: "\\n", span: span(10, 12) },
            { kind: "byte", value: 65, span: span(12, 16) },
          ],
        },
      },
      { kind: "EOF", span: span(17, 17), line: 1, column: 18, payload: null },
    ]);
  });

  // Each malformed input has its own root error and cannot become a valid literal.
  it.each([
    {
      text: "é",
      code: "E10210",
      start: 0,
      end: 2,
      message:
        "Unexpected character 'é' (U+00E9) — non-ASCII characters are allowed only inside string literals, character literals, and comments",
    },
    {
      text: "/*",
      code: "E10211",
      start: 0,
      end: 2,
      message: "Unterminated block comment — expected '*/' before end of file",
    },
    {
      text: "1__0",
      code: "E10213",
      start: 0,
      end: 4,
      message:
        "Invalid underscore in numeric literal — underscores must occur singly between digits",
    },
    {
      text: "0x",
      code: "E10214",
      start: 0,
      end: 2,
      message: "Invalid hexadecimal literal — expected a hexadecimal digit after '0x'",
    },
    {
      text: "0bytes",
      code: "E10215",
      start: 0,
      end: 6,
      message: "Invalid binary literal — expected '0' or '1' after '0b'",
    },
    {
      text: "65536",
      code: "E10216",
      start: 0,
      end: 5,
      message: "Numeric literal 65536 exceeds 65535",
    },
    {
      text: '"\\q"',
      code: "E10219",
      start: 1,
      end: 3,
      message: String.raw`Unknown escape sequence '\q' — valid escapes: '\\', '\"', '\'', '\n', '\r', '\t', '\0', '\xNN'`,
    },
    {
      text: '"\\x1"',
      code: "E10220",
      start: 1,
      end: 4,
      message: String.raw`Incomplete hexadecimal escape — '\x' requires exactly two hexadecimal digits`,
    },
    {
      text: "''",
      code: "E10221",
      start: 0,
      end: 2,
      message: "Empty character literal — use exactly one character or escape sequence",
    },
    {
      text: "'AB'",
      code: "E10222",
      start: 0,
      end: 4,
      message: "Multi-character literal 'AB' — use a double-quoted string for multiple characters",
    },
    {
      text: "'A",
      code: "E10223",
      start: 0,
      end: 2,
      message: "Unterminated character literal — expected closing single quote",
    },
  ])(
    "should report $code with canonical text and proving bytes for $text",
    ({ text, code, start, end, message }) => {
      const input = source(text);
      const result = lexSource(input);
      expect(result.complete).toBe(true);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code,
        severity: "error",
        message,
        primarySpan: span(start, end),
        related: [],
        pointer: null,
      });
      expect(result.poisoned).toEqual([span(0, input.byteLength)]);
      expect(
        result.tokens.filter((token) => ["NUMBER", "STRING", "CHAR"].includes(token.kind)),
      ).toEqual([]);
      expect(result.tokens.at(-1)?.kind).toBe("EOF");
      expect(result.tokens.at(-1)?.span).toEqual(span(input.byteLength, input.byteLength));
    },
  );
});
