import { describe, expect, it } from "vitest";
import { DiagCode, TokenKind, createDiagnosticBag } from "@blend65/core";
import type { DiagnosticBag, Token } from "@blend65/core";
import { lex } from "./lexer.js";

/** The synthetic source id used by every test in this file. */
const SRC = 1;

/** Lexes `text` with a fresh bag and returns both for assertions. */
function run(text: string): { tokens: readonly Token[]; bag: DiagnosticBag } {
  const bag = createDiagnosticBag();
  const { tokens } = lex(SRC, text, bag);
  return { tokens, bag };
}

/** Returns the token `kind` sequence (handy for shape assertions). */
function kinds(text: string): string[] {
  return run(text).tokens.map((t) => t.kind);
}

/** Lexes a single literal and returns its first token plus the bag. */
function one(text: string): { token: Token; bag: DiagnosticBag } {
  const { tokens, bag } = run(text);
  return { token: tokens[0]!, bag };
}


describe("lexer — Phase 2 skeleton (identifiers, keywords, comments, operators)", () => {
  // ----- ST-L3: empty input -----
  it("ST-L3: empty input yields [Eof] with no diagnostics", () => {
    const { tokens, bag } = run("");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.kind).toBe(TokenKind.Eof);
    expect(bag.getAll()).toHaveLength(0);
  });

  // ----- ST-L4: whitespace-only & comment-only -----
  it("ST-L4: whitespace-only and comment-only inputs yield [Eof], no diagnostics", () => {
    for (const src of ["   \t\n\r\n  ", "// just a comment", "/* a block */"]) {
      const { tokens, bag } = run(src);
      expect(tokens.map((t) => t.kind)).toEqual([TokenKind.Eof]);
      expect(bag.getAll()).toHaveLength(0);
    }
  });

  // ----- ST-L5: every keyword lexes to its Kw* kind -----
  it("ST-L5: each of the 32 keywords lexes to its Kw* kind", () => {
    const cases: ReadonlyArray<[string, string]> = [
      ["module", TokenKind.KwModule],
      ["import", TokenKind.KwImport],
      ["export", TokenKind.KwExport],
      ["from", TokenKind.KwFrom],
      ["function", TokenKind.KwFunction],
      ["return", TokenKind.KwReturn],
      ["interrupt", TokenKind.KwInterrupt],
      ["if", TokenKind.KwIf],
      ["else", TokenKind.KwElse],
      ["while", TokenKind.KwWhile],
      ["do", TokenKind.KwDo],
      ["for", TokenKind.KwFor],
      ["switch", TokenKind.KwSwitch],
      ["case", TokenKind.KwCase],
      ["default", TokenKind.KwDefault],
      ["fallthrough", TokenKind.KwFallthrough],
      ["break", TokenKind.KwBreak],
      ["continue", TokenKind.KwContinue],
      ["let", TokenKind.KwLet],
      ["const", TokenKind.KwConst],
      ["zeropage", TokenKind.KwZeropage],
      ["struct", TokenKind.KwStruct],
      ["byte", TokenKind.KwByte],
      ["sbyte", TokenKind.KwSbyte],
      ["word", TokenKind.KwWord],
      ["sword", TokenKind.KwSword],
      ["boolean", TokenKind.KwBoolean],
      ["void", TokenKind.KwVoid],
      ["true", TokenKind.KwTrue],
      ["false", TokenKind.KwFalse],
      ["enum", TokenKind.KwEnum],
      ["type", TokenKind.KwType],
    ];
    expect(cases).toHaveLength(32);
    for (const [lexeme, kind] of cases) {
      const { tokens, bag } = run(lexeme);
      expect(tokens.map((t) => t.kind)).toEqual([kind, TokenKind.Eof]);
      expect(bag.getAll()).toHaveLength(0);
    }
  });

  // ----- ST-L6: case-sensitive keyword miss -----
  it("ST-L6: Break / BYTE / iff are Identifiers (case-sensitive miss)", () => {
    for (const src of ["Break", "BYTE", "iff"]) {
      expect(kinds(src)).toEqual([TokenKind.Identifier, TokenKind.Eof]);
    }
  });

  // ----- ST-L7: contextual keywords are Identifiers -----
  it("ST-L7: until to downto step lex to four Identifier tokens", () => {
    expect(kinds("until to downto step")).toEqual([
      TokenKind.Identifier,
      TokenKind.Identifier,
      TokenKind.Identifier,
      TokenKind.Identifier,
      TokenKind.Eof,
    ]);
  });

  // ----- ST-L8: true/false/type -----
  it("ST-L8: true/false map to KwTrue/KwFalse; type maps to KwType (no diagnostic)", () => {
    const { tokens, bag } = run("true false type");
    expect(tokens.map((t) => t.kind)).toEqual([
      TokenKind.KwTrue,
      TokenKind.KwFalse,
      TokenKind.KwType,
      TokenKind.Eof,
    ]);
    expect(bag.getAll()).toHaveLength(0);
  });

  // ----- ST-L9: reserved built-ins are plain Identifiers -----
  it("ST-L9: peek main encode lex to Identifiers (no lexer special-casing)", () => {
    expect(kinds("peek main encode")).toEqual([
      TokenKind.Identifier,
      TokenKind.Identifier,
      TokenKind.Identifier,
      TokenKind.Eof,
    ]);
  });

  // ----- ST-L10: identifier span round-trips -----
  it("ST-L10: identifier span round-trips via text.slice", () => {
    const text = "playerScore";
    const { tokens } = run(text);
    expect(tokens.map((t) => t.kind)).toEqual([TokenKind.Identifier, TokenKind.Eof]);
    const span = tokens[0]?.span;
    expect(span).toBeDefined();
    expect(text.slice(span!.start, span!.end)).toBe("playerScore");
  });

  // ----- ST-L26: line comment -----
  it("ST-L26: line comment is discarded; trailing identifier survives", () => {
    const { tokens, bag } = run("// comment\nx");
    expect(tokens.map((t) => t.kind)).toEqual([TokenKind.Identifier, TokenKind.Eof]);
    expect(text(tokens[0]!, "// comment\nx")).toBe("x");
    expect(bag.getAll()).toHaveLength(0);
  });

  // ----- ST-L27: block comments + unterminated cascade -----
  it("ST-L27: block comments are discarded; unterminated emits E10211 then only Eof", () => {
    const closed = run("/* a */ x");
    expect(closed.tokens.map((t) => t.kind)).toEqual([TokenKind.Identifier, TokenKind.Eof]);
    expect(closed.bag.getAll()).toHaveLength(0);

    const multiline = run("/* line1\n line2 */ y");
    expect(multiline.tokens.map((t) => t.kind)).toEqual([
      TokenKind.Identifier,
      TokenKind.Eof,
    ]);
    expect(multiline.bag.getAll()).toHaveLength(0);

    const open = run("a /* never closes");
    // The identifier before the comment survives; the comment swallows the rest.
    expect(open.tokens.map((t) => t.kind)).toEqual([TokenKind.Identifier, TokenKind.Eof]);
    const errs = open.bag.getAll();
    expect(errs).toHaveLength(1);
    expect(errs[0]?.code).toBe(DiagCode.UnterminatedBlockComment);
  });

  // ----- ST-L28: every operator lexeme -> its kind -----
  it("ST-L28: every operator lexeme lexes to its kind", () => {
    const cases: ReadonlyArray<[string, string]> = [
      ["+", TokenKind.Plus],
      ["-", TokenKind.Minus],
      ["*", TokenKind.Star],
      ["/", TokenKind.Slash],
      ["%", TokenKind.Percent],
      ["&", TokenKind.Ampersand],
      ["|", TokenKind.Pipe],
      ["^", TokenKind.Caret],
      ["~", TokenKind.Tilde],
      ["<<", TokenKind.ShiftLeft],
      [">>", TokenKind.ShiftRight],
      ["&&", TokenKind.LogicalAnd],
      ["||", TokenKind.LogicalOr],
      ["!", TokenKind.Bang],
      ["==", TokenKind.EqualEqual],
      ["!=", TokenKind.BangEqual],
      ["<", TokenKind.Less],
      ["<=", TokenKind.LessEqual],
      [">", TokenKind.Greater],
      [">=", TokenKind.GreaterEqual],
      ["=", TokenKind.Equal],
      ["+=", TokenKind.PlusEqual],
      ["-=", TokenKind.MinusEqual],
      ["*=", TokenKind.StarEqual],
      ["/=", TokenKind.SlashEqual],
      ["%=", TokenKind.PercentEqual],
      ["&=", TokenKind.AmpersandEqual],
      ["|=", TokenKind.PipeEqual],
      ["^=", TokenKind.CaretEqual],
      ["<<=", TokenKind.ShiftLeftEqual],
      [">>=", TokenKind.ShiftRightEqual],
      ["?", TokenKind.Question],
    ];
    expect(cases).toHaveLength(32);
    for (const [lexeme, kind] of cases) {
      const { tokens, bag } = run(lexeme);
      expect(tokens.map((t) => t.kind)).toEqual([kind, TokenKind.Eof]);
      expect(bag.getAll()).toHaveLength(0);
    }
  });

  // ----- ST-L29: every punctuation lexeme -> its kind -----
  it("ST-L29: every punctuation lexeme lexes to its kind", () => {
    const cases: ReadonlyArray<[string, string]> = [
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
    ];
    expect(cases).toHaveLength(10);
    for (const [lexeme, kind] of cases) {
      expect(kinds(lexeme)).toEqual([kind, TokenKind.Eof]);
    }
  });

  // ----- ST-L30: maximal munch -----
  it("ST-L30: maximal munch prefers the longest operator", () => {
    expect(kinds("<<=")).toEqual([TokenKind.ShiftLeftEqual, TokenKind.Eof]);
    expect(kinds(">>=")).toEqual([TokenKind.ShiftRightEqual, TokenKind.Eof]);
    expect(kinds("&&")).toEqual([TokenKind.LogicalAnd, TokenKind.Eof]);
    expect(kinds("==")).toEqual([TokenKind.EqualEqual, TokenKind.Eof]);
    expect(kinds("<=")).toEqual([TokenKind.LessEqual, TokenKind.Eof]);
    expect(kinds(">=")).toEqual([TokenKind.GreaterEqual, TokenKind.Eof]);
    expect(kinds("!=")).toEqual([TokenKind.BangEqual, TokenKind.Eof]);
    // `<<` then `=` would be wrong; `<<=` is one token, so `<< =` (spaced) splits.
    expect(kinds("<< =")).toEqual([TokenKind.ShiftLeft, TokenKind.Equal, TokenKind.Eof]);
  });

  // ----- ST-L31: disambiguation of &, ?, :, and lone / -----
  it("ST-L31: &x, a?b:c, and lone / disambiguate correctly", () => {
    expect(kinds("&x")).toEqual([TokenKind.Ampersand, TokenKind.Identifier, TokenKind.Eof]);
    expect(kinds("a?b:c")).toEqual([
      TokenKind.Identifier,
      TokenKind.Question,
      TokenKind.Identifier,
      TokenKind.Colon,
      TokenKind.Identifier,
      TokenKind.Eof,
    ]);
    expect(kinds("a / b")).toEqual([
      TokenKind.Identifier,
      TokenKind.Slash,
      TokenKind.Identifier,
      TokenKind.Eof,
    ]);
  });

  // ----- ST-L32: multi-token spans are correct half-open byte offsets -----
  it("ST-L32: each token's span is a correct half-open byte range that round-trips", () => {
    const src = "let x = y";
    const { tokens } = run(src);
    expect(tokens.map((t) => t.kind)).toEqual([
      TokenKind.KwLet,
      TokenKind.Identifier,
      TokenKind.Equal,
      TokenKind.Identifier,
      TokenKind.Eof,
    ]);
    expect(text(tokens[0]!, src)).toBe("let");
    expect(text(tokens[1]!, src)).toBe("x");
    expect(text(tokens[2]!, src)).toBe("=");
    expect(text(tokens[3]!, src)).toBe("y");
    // Eof is an empty span at end-of-input.
    expect(tokens[4]?.span.start).toBe(src.length);
    expect(tokens[4]?.span.end).toBe(src.length);
  });

  // ----- ST-L33: BOM is skipped, first token starts at offset 1 -----
  it("ST-L33: a leading BOM is skipped and excluded from the first token's span", () => {
    const src = "\uFEFFx";
    const { tokens, bag } = run(src);
    expect(tokens.map((t) => t.kind)).toEqual([TokenKind.Identifier, TokenKind.Eof]);
    expect(tokens[0]?.span.start).toBe(1);
    expect(tokens[0]?.span.end).toBe(2);
    expect(bag.getAll()).toHaveLength(0);
  });

  // ----- ST-L34: line map across LF, CRLF, bare-CR -----
  it("ST-L34: lineMap.getLineCol resolves token positions across LF, CRLF, bare CR", () => {
    for (const nl of ["\n", "\r\n", "\r"]) {
      const src = `a${nl}b`;
      const bag = createDiagnosticBag();
      const { tokens, lineMap } = lex(SRC, src, bag);
      const [a, b] = tokens;
      expect(a?.kind).toBe(TokenKind.Identifier);
      expect(b?.kind).toBe(TokenKind.Identifier);
      expect(lineMap.getLineCol(a!.span.start)).toEqual({ line: 1, column: 1 });
      expect(lineMap.getLineCol(b!.span.start)).toEqual({ line: 2, column: 1 });
    }
  });
});

describe("lexer — Phase 3 numeric literals (decimal, hex, binary)", () => {
  // ----- ST-L11: plain decimal -----
  it("ST-L11: decimal literals produce Number with the parsed value", () => {
    for (const [src, value] of [
      ["0", 0],
      ["1000", 1000],
      ["65535", 65535],
    ] as const) {
      const { token, bag } = one(src);
      expect(token.kind).toBe(TokenKind.Number);
      expect(token.value).toBe(value);
      expect(bag.getAll()).toHaveLength(0);
    }
  });

  // ----- ST-L12: hex via $ and 0x -----
  it("ST-L12: $hex and 0x hex literals parse, prefix excluded from value", () => {
    for (const [src, value] of [
      ["$0400", 0x0400],
      ["$FF", 0xff],
      ["0x0400", 0x0400],
      ["0XfF", 0xff],
    ] as const) {
      const { token, bag } = one(src);
      expect(token.kind).toBe(TokenKind.Number);
      expect(token.value).toBe(value);
      expect(bag.getAll()).toHaveLength(0);
    }
  });

  // ----- ST-L13: binary -----
  it("ST-L13: 0b binary literals parse to their value", () => {
    for (const [src, value] of [
      ["0b1010", 10],
      ["0B1111_0000", 240],
    ] as const) {
      const { token, bag } = one(src);
      expect(token.kind).toBe(TokenKind.Number);
      expect(token.value).toBe(value);
      expect(bag.getAll()).toHaveLength(0);
    }
  });

  // ----- ST-L14: underscores are digit separators -----
  it("ST-L14: valid underscores are stripped from the parsed value", () => {
    for (const [src, value] of [
      ["1_000", 1000],
      ["$FF_FF", 0xffff],
      ["0b1111_0000", 240],
    ] as const) {
      const { token, bag } = one(src);
      expect(token.kind).toBe(TokenKind.Number);
      expect(token.value).toBe(value);
      expect(bag.getAll()).toHaveLength(0);
    }
  });

  // ----- ST-L15: misplaced underscores -> E10213 -----
  it("ST-L15: leading/trailing/consecutive underscores emit E10213 but still produce a Number", () => {
    for (const src of ["$_FF", "$FF_", "$F__F"]) {
      const { token, bag } = one(src);
      expect(token.kind).toBe(TokenKind.Number);
      const errs = bag.getAll();
      expect(errs).toHaveLength(1);
      expect(errs[0]?.code).toBe(DiagCode.InvalidNumericUnderscore);
    }
  });

  // ----- ST-L16: bare prefixes -> E10214 / E10215, value 0 -----
  it("ST-L16: $/0x without a hex digit emit E10214; 0b without a binary digit emits E10215; value 0", () => {
    for (const src of ["$", "0x", "$G"]) {
      const { token, bag } = one(src);
      expect(token.kind).toBe(TokenKind.Number);
      expect(token.value).toBe(0);
      expect(bag.getAll()[0]?.code).toBe(DiagCode.InvalidHexLiteral);
    }
    for (const src of ["0b", "0b2"]) {
      const { token, bag } = one(src);
      expect(token.kind).toBe(TokenKind.Number);
      expect(token.value).toBe(0);
      expect(bag.getAll()[0]?.code).toBe(DiagCode.InvalidBinaryLiteral);
    }
  });

  // ----- ST-L17: overflow saturates at 65535 -> E10216 -----
  it("ST-L17: values over 65535 emit E10216 and saturate to 65535", () => {
    for (const src of ["65536", "$1FFFF", "99999"]) {
      const { token, bag } = one(src);
      expect(token.kind).toBe(TokenKind.Number);
      expect(token.value).toBe(65535);
      const errs = bag.getAll();
      expect(errs).toHaveLength(1);
      expect(errs[0]?.code).toBe(DiagCode.NumericLiteralOverflow);
    }
  });

  // ----- ST-L18: leading zeros -> W10210 -----
  it("ST-L18: decimal leading zeros emit W10210 but still produce the Number", () => {
    for (const [src, value] of [
      ["007", 7],
      ["0042", 42],
    ] as const) {
      const { token, bag } = one(src);
      expect(token.kind).toBe(TokenKind.Number);
      expect(token.value).toBe(value);
      const all = bag.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]?.code).toBe(DiagCode.NumericLeadingZeros);
    }
  });

  // ----- ST-L19: `0bytes` -> binary attempt rejected -----
  it("ST-L19: 0bytes scans 0b then a non-binary digit, emitting E10215", () => {
    const { tokens, bag } = run("0bytes");
    // `0b` is a bare binary prefix (value 0); `ytes` follows as an identifier.
    expect(tokens.map((t) => t.kind)).toEqual([
      TokenKind.Number,
      TokenKind.Identifier,
      TokenKind.Eof,
    ]);
    expect(tokens[0]?.value).toBe(0);
    expect(text(tokens[1]!, "0bytes")).toBe("ytes");
    expect(bag.getAll()[0]?.code).toBe(DiagCode.InvalidBinaryLiteral);
  });
});

describe("lexer — Phase 4 strings, characters, escapes", () => {
  // ----- ST-L20: well-formed strings -----
  it("ST-L20: string literals capture their raw content as the value", () => {
    for (const [src, value] of [
      ['"HELLO WORLD"', "HELLO WORLD"],
      ['""', ""],
      ['"a\\nb"', "a\\nb"],
      ['"tab\\tend"', "tab\\tend"],
      ['"hex\\x41"', "hex\\x41"],
      ['"quote\\""', 'quote\\"'],
    ] as const) {
      const { token, bag } = one(src);
      expect(token.kind).toBe(TokenKind.String);
      expect(token.value).toBe(value);
      expect(bag.getAll()).toHaveLength(0);
    }
  });

  // ----- ST-L21: well-formed char literals -----
  it("ST-L21: char literals capture the single char/escape as the value", () => {
    for (const [src, value] of [
      ["'A'", "A"],
      ["'\\n'", "\\n"],
      ["'\\x41'", "\\x41"],
      ["'\\''", "\\'"],
      ["'\\\\'", "\\\\"],
    ] as const) {
      const { token, bag } = one(src);
      expect(token.kind).toBe(TokenKind.Char);
      expect(token.value).toBe(value);
      expect(bag.getAll()).toHaveLength(0);
    }
  });

  // ----- ST-L22: newline & EOF in string -----
  it("ST-L22: a newline in a string emits E10217; EOF before close emits E10218", () => {
    const nl = run('"abc\ndef"');
    expect(nl.tokens[0]?.kind).toBe(TokenKind.String);
    expect(nl.tokens[0]?.value).toBe("abc");
    expect(nl.bag.getAll()[0]?.code).toBe(DiagCode.NewlineInString);
    // The text after the newline resumes normal scanning (identifier `def`).
    expect(nl.tokens.map((t) => t.kind)).toEqual([
      TokenKind.String,
      TokenKind.Identifier,
      TokenKind.String,
      TokenKind.Eof,
    ]);

    const eof = run('"unterminated');
    expect(eof.tokens.map((t) => t.kind)).toEqual([TokenKind.String, TokenKind.Eof]);
    expect(eof.tokens[0]?.value).toBe("unterminated");
    expect(eof.bag.getAll()[0]?.code).toBe(DiagCode.UnterminatedString);
  });

  // ----- ST-L23: escape validation -----
  it("ST-L23: unknown escapes emit E10219 and short \\x emit E10220, literal kept raw", () => {
    const unknown = run('"a\\qb"');
    expect(unknown.tokens[0]?.kind).toBe(TokenKind.String);
    expect(unknown.tokens[0]?.value).toBe("a\\qb");
    expect(unknown.bag.getAll()[0]?.code).toBe(DiagCode.UnknownEscapeSequence);

    const shortHex = run('"a\\x4"');
    expect(shortHex.tokens[0]?.kind).toBe(TokenKind.String);
    expect(shortHex.tokens[0]?.value).toBe("a\\x4");
    expect(shortHex.bag.getAll()[0]?.code).toBe(DiagCode.IncompleteHexEscape);
  });

  // ----- ST-L24: empty & multi-char literals -----
  it("ST-L24: empty char emits E10221; multi-char emits E10222 keeping the first unit", () => {
    const empty = one("''");
    expect(empty.token.kind).toBe(TokenKind.Char);
    expect(empty.token.value).toBe("");
    expect(empty.bag.getAll()[0]?.code).toBe(DiagCode.EmptyCharLiteral);

    const multi = one("'AB'");
    expect(multi.token.kind).toBe(TokenKind.Char);
    expect(multi.token.value).toBe("A");
    expect(multi.bag.getAll()[0]?.code).toBe(DiagCode.MultiCharLiteral);
  });

  // ----- ST-L25: unterminated char literal -----
  it("ST-L25: a char literal with no closing quote emits E10223", () => {
    const eof = run("'A");
    expect(eof.tokens.map((t) => t.kind)).toEqual([TokenKind.Char, TokenKind.Eof]);
    expect(eof.tokens[0]?.value).toBe("A");
    expect(eof.bag.getAll()[0]?.code).toBe(DiagCode.UnterminatedCharLiteral);

    const nl = run("'A\nx");
    expect(nl.tokens.map((t) => t.kind)).toEqual([
      TokenKind.Char,
      TokenKind.Identifier,
      TokenKind.Eof,
    ]);
    expect(nl.bag.getAll()[0]?.code).toBe(DiagCode.UnterminatedCharLiteral);
  });
});

describe("lexer — Phase 5 error tolerance, unexpected chars, determinism", () => {
  // ----- ST-L35: unexpected character -> E10210, skip one unit -----
  it("ST-L35: an unexpected character emits E10210 and scanning resumes after it", () => {
    const { tokens, bag } = run("a € b");
    // The non-ASCII '€' is reported once and skipped; the identifiers survive.
    expect(tokens.map((t) => t.kind)).toEqual([
      TokenKind.Identifier,
      TokenKind.Identifier,
      TokenKind.Eof,
    ]);
    const errs = bag.getAll();
    expect(errs).toHaveLength(1);
    expect(errs[0]?.code).toBe(DiagCode.UnexpectedCharacter);
  });

  // ----- ST-L36: mixed errors are all tolerated; stream still completes -----
  it("ST-L36: multiple independent errors are each reported; the stream still ends in Eof", () => {
    const { tokens, bag } = run('$ 0b "oops');
    // bare `$` (E10214), bare `0b` (E10215), unterminated string at EOF (E10218).
    expect(tokens[tokens.length - 1]?.kind).toBe(TokenKind.Eof);
    const codes = bag.getAll().map((d) => d.code);
    expect(codes).toContain(DiagCode.InvalidHexLiteral);
    expect(codes).toContain(DiagCode.InvalidBinaryLiteral);
    expect(codes).toContain(DiagCode.UnterminatedString);
  });


  // ----- ST-L37: determinism — identical input yields identical output twice -----
  it("ST-L37: lexing the same source twice yields deep-equal tokens and diagnostics", () => {
    const src = 'let x: byte = $FF; "hi\\n" 0b1010 // c\n €';
    const first = run(src);
    const second = run(src);
    expect(first.tokens).toEqual(second.tokens);
    expect(first.bag.getAll()).toEqual(second.bag.getAll());
  });

  // ----- ST-L38: no-hang — pathological inputs always terminate with one Eof -----
  it("ST-L38: pathological inputs terminate and always end in exactly one Eof", () => {
    for (const src of ["€€€€", "''''", '""""', "\\\\\\", "$$$", "0b0b0b", "/*/"]) {
      const { tokens } = run(src);
      const eofs = tokens.filter((t) => t.kind === TokenKind.Eof);
      expect(eofs).toHaveLength(1);
      expect(tokens[tokens.length - 1]?.kind).toBe(TokenKind.Eof);
    }
  });
});

/** Recovers a token's lexeme from the owning source via its span. */
function text(token: Token, source: string): string {
  return source.slice(token.span.start, token.span.end);
}



