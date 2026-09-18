import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SourceRecord } from "../project/types.js";
import { lexSource } from "./lexer.js";
import { TokenKind } from "./tokens.js";

/** Exact immutable records exercise the real scanner without filesystem ownership. */
function source(text: string): SourceRecord {
  return Object.freeze({
    sourceId: "edge.blend",
    text,
    sha256: createHash("sha256").update(text).digest("hex"),
    byteLength: Buffer.byteLength(text),
    resolvedPath: "/unused/edge.blend",
  });
}

describe("lexer cursor and recovery", () => {
  it.each(["\n", "\r", "\r\n"])(
    "should count %j as one line break with byte columns",
    (breakText) => {
      const result = lexSource(source("\tx" + breakText + "\ty"));
      expect(result.tokens.slice(0, 2).map(({ line, column }) => ({ line, column }))).toEqual([
        { line: 1, column: 2 },
        { line: 2, column: 2 },
      ]);
      expect(result.tokens[1]?.span.start).toBe(3 + Buffer.byteLength(breakText));
      expect(result.tokens.at(-1)?.column).toBe(3);
    },
  );

  it.each(["", "\uFEFF", " \t\r\n"])("should finish empty syntax %j with a located EOF", (text) => {
    const input = source(text);
    const result = lexSource(input);
    expect(result.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]?.span).toEqual({
      sourceId: input.sourceId,
      start: input.byteLength,
      end: input.byteLength,
    });
  });

  it("should retain astral and combining scalar identity without encoding or composition", () => {
    const result = lexSource(source('"🎮e\u0301"'));
    expect(result.tokens[0]?.payload).toMatchObject({
      kind: "literal",
      items: [
        { kind: "scalar", value: "🎮", span: { start: 1, end: 5 } },
        { kind: "scalar", value: "e", span: { start: 5, end: 6 } },
        { kind: "scalar", value: "\u0301", span: { start: 6, end: 8 } },
      ],
    });
    expect(lexSource(source("'e\u0301'")).diagnostics[0]?.code).toBe("E10222");
    expect(lexSource(source("'🎮'")).diagnostics).toEqual([]);
  });

  it.each(["\\", '\"', "\'", "n", "r", "t", "0"])(
    "should retain symbolic escape %j verbatim",
    (suffix) => {
      const spelling = String.fromCharCode(92) + suffix;
      const result = lexSource(source('"' + spelling + '"'));
      expect(result.diagnostics).toEqual([]);
      expect(result.tokens[0]?.payload).toMatchObject({
        kind: "literal",
        items: [{ kind: "escape", value: spelling }],
      });
    },
  );

  it("should insert exactly two hex digits as one byte and leave a third digit as content", () => {
    const result = lexSource(source(String.raw`"\x004\xFF"`));
    expect(result.diagnostics).toEqual([]);
    expect(result.tokens[0]?.payload).toMatchObject({
      kind: "literal",
      items: [
        { kind: "byte", value: 0 },
        { kind: "scalar", value: "4" },
        { kind: "byte", value: 255 },
      ],
    });
  });

  it.each(["1_", "0x_FF", "$F__F", "0b1_", "0b_1"])(
    "should reject malformed separators in %j without conversion",
    (text) => {
      const result = lexSource(source(text));
      expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10213"]);
      expect(result.tokens.map(({ kind }) => kind)).toEqual([TokenKind.EOF]);
      expect(result.poisoned[0]?.end).toBe(Buffer.byteLength(text));
    },
  );

  it.each(["$", "$G", "0X", "0xG", "0b", "0B2"])(
    "should reject invalid radix digits in %j without throwing",
    (text) => {
      const result = lexSource(source(text));
      expect(result.diagnostics[0]?.code).toBe(
        text.toLowerCase().startsWith("0b") ? "E10215" : "E10214",
      );
      expect(result.tokens.map(({ kind }) => kind)).toEqual([TokenKind.EOF]);
    },
  );

  it("should preserve exact boundary values and decimal leading-zero meaning", () => {
    const result = lexSource(source("0 65535 $FFFF 0B1111_1111_1111_1111 0_07"));
    expect(result.tokens.slice(0, -1).map(({ payload }) => payload)).toEqual(
      [0n, 65535n, 65535n, 65535n, 7n].map((value) => ({ kind: "number", value })),
    );
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["W10210"]);
  });

  it("should preserve following independent tokens after malformed literals and numbers", () => {
    const result = lexSource(source(String.raw`"\q" let valid: byte = 2; 1__0 other`));
    expect(result.complete).toBe(true);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10219", "E10213"]);
    expect(result.tokens.map(({ kind }) => kind)).toEqual([
      TokenKind.KW_LET,
      TokenKind.IDENTIFIER,
      TokenKind.COLON,
      TokenKind.KW_BYTE,
      TokenKind.EQUAL,
      TokenKind.NUMBER,
      TokenKind.SEMICOLON,
      TokenKind.IDENTIFIER,
      TokenKind.EOF,
    ]);
    expect(result.poisoned).toHaveLength(2);
  });

  it("should stop a valid radix literal before a following independent identifier", () => {
    const result = lexSource(source("$FFname 0xFFg 0b10next"));
    expect(result.diagnostics).toEqual([]);
    expect(result.tokens.slice(0, -1).map(({ payload }) => payload)).toEqual([
      { kind: "number", value: 255n },
      { kind: "identifier", text: "name" },
      { kind: "number", value: 255n },
      { kind: "identifier", text: "g" },
      { kind: "number", value: 2n },
      { kind: "identifier", text: "next" },
    ]);
  });

  it("should retain independent malformed escapes without cardinality cascades", () => {
    const result = lexSource(source(String.raw`'\q\z'`));
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10219", "E10219"]);
    const limited = lexSource(source('"' + String.raw`\q`.repeat(21) + '\\"still literal"'));
    expect(limited.diagnostics).toHaveLength(20);
    expect(limited.complete).toBe(false);
    expect(limited.tokens.map(({ kind }) => kind)).toEqual([TokenKind.EOF]);
    expect(limited.poisoned).toHaveLength(1);
  });

  it.each([
    [String.raw`"\q`, ["E10218", "E10219"]],
    [String.raw`'\q`, ["E10223", "E10219"]],
    [String.raw`"\q` + "\n", ["E10219", "E10217"]],
  ] as const)("should retain ordered independent literal-boundary errors in %j", (text, codes) => {
    const result = lexSource(source(text));
    expect(result.diagnostics.map(({ code }) => code)).toEqual(codes);
    expect(result.tokens.map(({ kind }) => kind)).toEqual([TokenKind.EOF]);
    expect(result.poisoned).toHaveLength(1);
  });

  it.each(["\n", "\r", "\r\n"])(
    "should recover at raw string newline %j without a termination cascade",
    (breakText) => {
      const result = lexSource(source('"bad' + breakText + "let x: byte = 1;"));
      expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10217"]);
      expect(result.tokens[0]?.kind).toBe(TokenKind.KW_LET);
      expect(result.tokens[0]?.line).toBe(2);
      expect(result.poisoned[0]).toMatchObject({ start: 0, end: 4 });
    },
  );

  it.each(['"bad', '"bad\\', "'bad", "'\\"])("should terminate safely on EOF inside %j", (text) => {
    const result = lexSource(source(text));
    expect(result.complete).toBe(true);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      text[0] === '"' ? "E10218" : "E10223",
    ]);
    expect(result.tokens.map(({ kind }) => kind)).toEqual([TokenKind.EOF]);
  });

  it("should discard arbitrary comment bytes and end line comments at bare CR", () => {
    const result = lexSource(source("/*\u0000🎮*/ //é\rlet x: byte = 1;"));
    expect(result.diagnostics).toEqual([]);
    expect(result.tokens[0]?.kind).toBe(TokenKind.KW_LET);
    expect(result.tokens[0]?.line).toBe(2);
  });

  it("should stop lexical checks at twenty errors and account for the unchecked remainder", () => {
    const input = source("é".repeat(21) + "\r\nlet unseen: byte = 1;");
    const result = lexSource(input);
    expect(result.complete).toBe(false);
    expect(result.diagnostics).toHaveLength(20);
    expect(result.poisoned.at(-1)).toMatchObject({ start: 40, end: input.byteLength });
    expect(result.tokens.map(({ kind }) => kind)).toEqual([TokenKind.EOF]);
    expect(result.tokens[0]).toMatchObject({ line: 2, column: 22 });
    expect(lexSource(source("é".repeat(20))).complete).toBe(true);
  });

  it("should escape raw terminal controls in fallback diagnostics", () => {
    const result = lexSource(source("\u0000\u001b\u007f"));
    expect(result.diagnostics).toHaveLength(3);
    for (const diagnostic of result.diagnostics)
      expect(diagnostic.message).not.toMatch(/[\u0000-\u001f\u007f]/);
  });

  it("should reject forged byte metadata and unpaired surrogate text before replacement", () => {
    expect(() => lexSource({ ...source("é"), byteLength: 1 })).toThrow(RangeError);
    expect(() => lexSource(source("\uD800"))).toThrow(RangeError);
    expect(() => lexSource(source("\uDC00"))).toThrow(RangeError);
  });

  it("should scan long identifiers and deeply nested punctuation without host recursion", () => {
    const name = "a".repeat(100_000);
    const result = lexSource(source(name + "(".repeat(10_000) + ")".repeat(10_000)));
    expect(result.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.tokens).toHaveLength(20_002);
    expect(result.tokens[0]?.payload).toEqual({ kind: "identifier", text: name });
  });

  it("should keep source and nested output records immutable", () => {
    const input = source(String.raw`"£\x41"`);
    const before = JSON.stringify(input);
    const result = lexSource(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.tokens)).toBe(true);
    const token = result.tokens[0]!;
    expect(Object.isFrozen(token)).toBe(true);
    expect(Object.isFrozen(token.span)).toBe(true);
    expect(Object.isFrozen(token.payload)).toBe(true);
    if (token.payload?.kind !== "literal") throw new Error("Expected literal payload");
    expect(Object.isFrozen(token.payload.items)).toBe(true);
    expect(
      token.payload.items.every((item) => Object.isFrozen(item) && Object.isFrozen(item.span)),
    ).toBe(true);
  });

  it("should choose every fixed operator and punctuation token by longest spelling", () => {
    const pairs = [
      ["<<=", "SHIFT_LEFT_EQUAL"],
      [">>=", "SHIFT_RIGHT_EQUAL"],
      ["<<", "SHIFT_LEFT"],
      [">>", "SHIFT_RIGHT"],
      ["&&", "LOGICAL_AND"],
      ["||", "LOGICAL_OR"],
      ["==", "EQUAL_EQUAL"],
      ["!=", "BANG_EQUAL"],
      ["<=", "LESS_EQUAL"],
      [">=", "GREATER_EQUAL"],
      ["+=", "PLUS_EQUAL"],
      ["-=", "MINUS_EQUAL"],
      ["*=", "STAR_EQUAL"],
      ["/=", "SLASH_EQUAL"],
      ["%=", "PERCENT_EQUAL"],
      ["&=", "AMPERSAND_EQUAL"],
      ["|=", "PIPE_EQUAL"],
      ["^=", "CARET_EQUAL"],
      ["+", "PLUS"],
      ["-", "MINUS"],
      ["*", "STAR"],
      ["/", "SLASH"],
      ["%", "PERCENT"],
      ["&", "AMPERSAND"],
      ["|", "PIPE"],
      ["^", "CARET"],
      ["~", "TILDE"],
      ["!", "BANG"],
      ["<", "LESS"],
      [">", "GREATER"],
      ["=", "EQUAL"],
      ["?", "QUESTION"],
      [":", "COLON"],
      ["(", "LPAREN"],
      [")", "RPAREN"],
      ["[", "LBRACKET"],
      ["]", "RBRACKET"],
      ["{", "LBRACE"],
      ["}", "RBRACE"],
      [",", "COMMA"],
      [";", "SEMICOLON"],
      [".", "DOT"],
    ];
    const spellings = pairs.map(([spelling]) => spelling);
    const kinds = [...pairs.map(([, kind]) => kind), "EOF"];
    const result = lexSource(source(spellings.join(" ")));
    expect(result.diagnostics).toEqual([]);
    expect(result.tokens.map(({ kind }) => kind)).toEqual(kinds);
  });
});
