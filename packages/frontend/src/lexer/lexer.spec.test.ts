import { describe, expect, it } from "vitest";
import { TokenKind, createDiagnosticBag } from "@blend65/core";
import type { Diagnostic, Token } from "@blend65/core";
// Import through the package's PUBLIC entry (not "./lexer.js") so this tier also
// pins that `lex`/`LexResult` are actually re-exported from `@blend65/frontend`
// (FR-38, AC-1).
import { lex } from "../index.js";

/** The synthetic source id used by every snapshot in this file. */
const SRC = 1;

/**
 * Renders one token in the canonical, human-readable debug format
 * `<Kind> <start>..<end> [value]` — the foundation for a future `--emit-tokens`
 * flag (RD-02 §6). String-valued `TokenKind` (AR-L6) is what keeps this readable.
 * A literal value is JSON-encoded so raw escape text (`\n`, quotes) stays visible.
 */
function formatToken(t: Token): string {
  const head = `${t.kind} ${t.span.start}..${t.span.end}`;
  return t.value === undefined ? head : `${head} ${JSON.stringify(t.value)}`;
}

/** Renders the whole token stream as one newline-joined golden block. */
function formatTokens(tokens: readonly Token[]): string {
  return tokens.map(formatToken).join("\n");
}

/**
 * Renders one diagnostic as `<code> <severity> <start>..<end> <message>`.
 * Including the span and message pins both recovery ordering (AC-13) and the
 * Ch 01 §14 message strings (AC-12) in a single golden snapshot.
 */
function formatDiag(d: Diagnostic): string {
  const span = d.primarySpan;
  const where = span === null ? "<no-span>" : `${span.start}..${span.end}`;
  return `${d.code} ${d.severity} ${where} ${d.message}`;
}

/** Renders the ordered diagnostic list as one newline-joined golden block. */
function formatDiagnostics(diags: readonly Diagnostic[]): string {
  return diags.length === 0 ? "<none>" : diags.map(formatDiag).join("\n");
}

describe("lexer — Phase 6 behavioral spec & golden snapshots", () => {
  // ----- ST-L39: public API surface (AC-1, FR-38) -----
  describe("ST-L39: public API surface", () => {
    it("re-exports `lex` from the @blend65/frontend public entry", () => {
      expect(typeof lex).toBe("function");
    });

    it("re-exports the token vocabulary from @blend65/core", () => {
      // `TokenKind` is a string-valued const map (AR-L6); `Token`/`LexResult`
      // are type-only and erased at runtime, so we assert the value export that
      // both `frontend` and `language-server` share without touching `codegen`.
      expect(TokenKind.Eof).toBe("Eof");
      expect(TokenKind.Number).toBe("Number");
    });

    it("returns a LexResult carrying tokens and a lineMap", () => {
      const bag = createDiagnosticBag();
      const result = lex(SRC, "x", bag);
      expect(Array.isArray(result.tokens)).toBe(true);
      expect(result.tokens.at(-1)?.kind).toBe(TokenKind.Eof);
      // The lineMap is built once over the source (AR-L1/L2); offset 0 is line 1.
      expect(result.lineMap.getLineCol(0)).toEqual({ line: 1, column: 1 });
    });
  });

  // ----- ST-L40: golden token list for a representative .blend (AC-15) -----
  describe("ST-L40: golden token list (representative program)", () => {
    it("tokenizes a small well-formed program to a canonical snapshot", () => {
      // Mirrors examples/gate/main.blend in spirit (module + function + poke),
      // inlined so the golden is hermetic and independent of the example file.
      const source = [
        "module Main;",
        "",
        "function main(): void {",
        "  poke(0xD020, 5);  // border color",
        "}",
        "",
      ].join("\n");
      const bag = createDiagnosticBag();
      const { tokens } = lex(SRC, source, bag);

      // A well-formed program produces no diagnostics …
      expect(bag.getAll()).toHaveLength(0);
      // … and every token's span round-trips back to its source lexeme.
      for (const t of tokens) {
        if (t.kind === TokenKind.Eof) {
          continue;
        }
        expect(source.slice(t.span.start, t.span.end).length).toBe(
          t.span.end - t.span.start,
        );
      }

      expect(formatTokens(tokens)).toMatchSnapshot();
    });
  });

  // ----- ST-L41: golden tokens + ordered diagnostics (AC-13, AC-15) -----
  describe("ST-L41: golden tokens + ordered diagnostics (error-bearing)", () => {
    // One source exercising several independent recovery paths at once:
    //   $        → E10214 (bad hex, recovery value 0)
    //   99999    → E10216 (overflow, saturates to 65535)
    //   "oops    → E10218 (unterminated string at EOF)
    const errorSource = 'let x = $ + 99999;\nlet s = "oops';

    it("snapshots the recovered token stream", () => {
      const bag = createDiagnosticBag();
      const { tokens } = lex(SRC, errorSource, bag);
      // Recovery is total: the stream still terminates in exactly one Eof.
      expect(tokens.filter((t) => t.kind === TokenKind.Eof)).toHaveLength(1);
      expect(formatTokens(tokens)).toMatchSnapshot();
    });

    it("snapshots the ordered diagnostic list (pins recovery + ordering)", () => {
      const bag = createDiagnosticBag();
      lex(SRC, errorSource, bag);
      expect(formatDiagnostics(bag.getAll())).toMatchSnapshot();
    });

    it("is deterministic — a second lex is byte-for-byte identical", () => {
      const a = createDiagnosticBag();
      const b = createDiagnosticBag();
      const ra = lex(SRC, errorSource, a);
      const rb = lex(SRC, errorSource, b);
      expect(formatTokens(rb.tokens)).toBe(formatTokens(ra.tokens));
      expect(formatDiagnostics(b.getAll())).toBe(formatDiagnostics(a.getAll()));
    });
  });
});
