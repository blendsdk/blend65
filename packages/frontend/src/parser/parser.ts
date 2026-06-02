/**
 * The Blend65 parser entry point and source-structure layer (RD-03 §4.9, §4.13;
 * FR-12..FR-15, FR-47; AR-8).
 *
 * `parse()` turns the lexer's `Token[]` into a `ProgramNode`. It is recursive
 * descent for source structure / declarations / statements (Pratt for
 * expressions arrives in Phase 5). It **never throws** (FR-4): syntax errors are
 * appended to the shared {@link DiagnosticBag} and the tree is kept structurally
 * complete with error sentinels.
 *
 * This slice implements the module declaration (FR-13), `import` statements
 * (FR-14), the top-level declaration dispatch (FR-15) into the declaration
 * parsers (`parse-decl.ts`), and the panic-aware `emit` + top-level recovery
 * skeleton. Statements and full expressions are added in later phases by
 * extending the dispatch — never by changing what is here (FR-11).
 *
 * Lexeme text is recovered through the cursor's single `lexeme()` site (AR-8);
 * the frozen RD-02 lexer is untouched.
 */

import { DiagCode, TokenKind, makeSpan } from "@blend65/core";
import type {
  DiagCodeValue,
  DiagnosticBag,
  ImportStmtNode,
  ModuleDeclNode,
  ProgramNode,
  SourceId,
  SourceSpan,
  Token,
  TopLevelItem,
} from "@blend65/core";
import { createCursor } from "./cursor.js";
import type { Cursor } from "./cursor.js";
import type { ParserState } from "./state.js";
import { parseDeclByKeyword, parseExportedDecl } from "./parse-decl.js";

/**
 * Everything the parser needs for one source file (AR-8).
 *
 * An object — not positional parameters — so future phases (RD-14 language
 * server incremental re-parse, RD-15 programmatic CLI) can add **optional**
 * fields without a breaking signature change (F1-extensible).
 */
export interface ParseInput {
  /** The lexer's token stream (non-empty, terminated by exactly one `Eof`). */
  readonly tokens: readonly Token[];
  /** The full source text the tokens span; sliced by the cursor's `lexeme()`. */
  readonly source: string;
  /** The interned source identifier, embedded in every node span. */
  readonly sourceId: SourceId;
  /** The shared diagnostic accumulator syntax errors are appended to. */
  readonly bag: DiagnosticBag;
}

/** The result of parsing one source file. */
export interface ParseResult {
  /** The (possibly partial) AST root — always present, even on errors. */
  readonly ast: ProgramNode;
  /** `true` if any error-severity diagnostic was recorded during parsing. */
  readonly hasErrors: boolean;
}

/** Top-level synchronisation tokens (FR-6; 03-03 recovery table, AR-1: no `asm`). */
const TOP_LEVEL_SYNC: ReadonlySet<string> = new Set([
  TokenKind.KwFunction,
  TokenKind.KwInterrupt,
  TokenKind.KwStruct,
  TokenKind.KwEnum,
  TokenKind.KwLet,
  TokenKind.KwConst,
  TokenKind.KwZeropage,
  TokenKind.KwImport,
  TokenKind.KwExport,
]);

/** Declaration keywords that begin a top-level declaration (FR-15). */
const DECL_KEYWORDS: ReadonlySet<string> = new Set([
  TokenKind.KwFunction,
  TokenKind.KwInterrupt,
  TokenKind.KwStruct,
  TokenKind.KwEnum,
  TokenKind.KwLet,
  TokenKind.KwConst,
  TokenKind.KwZeropage,
]);

/**
 * Parses one source file into a {@link ParseResult} (FR-47). Never throws.
 *
 * @param input The tokens, source text, source id, and diagnostic bag (AR-8).
 * @returns The AST root plus whether any errors were recorded.
 */
export function parse(input: ParseInput): ParseResult {
  const { tokens, source, sourceId, bag } = input;
  const cursor = createCursor(tokens, source, sourceId, bag);

  // Cascade-suppression state (FR-7): `emit` reports the first error of a region
  // and then withholds follow-ons until a sync point resets `panicMode`.
  let panicMode = false;

  const state: ParserState = {
    cursor,
    sourceId,
    emit(code: DiagCodeValue, span: SourceSpan, message: string): void {
      if (panicMode) {
        return;
      }
      bag.addError(code, span, message);
      panicMode = true;
    },
    clearPanic(): void {
      panicMode = false;
    },
    here(): SourceSpan {
      return cursor.peek().span;
    },
  };

  /** The current token's span (already a {@link SourceSpan}). */
  function here(): SourceSpan {
    return cursor.peek().span;
  }

  /**
   * Parses a dotted name `Ident ('.' Ident)*` (module paths, import paths).
   * Returns the joined text and its start/end offsets, or `null` if no leading
   * identifier is present.
   */
  function parseDottedName(ctx: string): { name: string; start: number; end: number } | null {
    const first = cursor.expect(
      TokenKind.Identifier,
      DiagCode.ExpectedIdentifier,
      `identifier in ${ctx}`,
    );
    if (first === null) {
      return null;
    }
    let name = cursor.lexeme(first);
    let endTok = first;
    while (cursor.check(TokenKind.Dot)) {
      cursor.advance(); // consume '.'
      const part = cursor.expect(
        TokenKind.Identifier,
        DiagCode.ExpectedIdentifier,
        `identifier after '.' in ${ctx}`,
      );
      if (part === null) {
        break;
      }
      name += `.${cursor.lexeme(part)}`;
      endTok = part;
    }
    return { name, start: first.span.start, end: endTok.span.end };
  }

  /**
   * Parses the mandatory leading `module dotted.name;` (FR-13). The caller has
   * confirmed the current token is `KwModule`.
   */
  function parseModuleDecl(): ModuleDeclNode {
    const moduleTok = cursor.advance(); // KwModule
    const dotted = parseDottedName("module declaration");
    let end = dotted ? dotted.end : moduleTok.span.end;
    const semi = cursor.expect(
      TokenKind.Semicolon,
      DiagCode.MissingSemicolon,
      "';' after module declaration",
    );
    if (semi !== null) {
      end = semi.span.end;
    }
    const nameStart = dotted ? dotted.start : moduleTok.span.start;
    const nameEnd = dotted ? dotted.end : moduleTok.span.end;
    return {
      kind: "ModuleDecl",
      name: dotted ? dotted.name : "",
      nameSpan: makeSpan(sourceId, nameStart, nameEnd),
      span: makeSpan(sourceId, moduleTok.span.start, end),
    };
  }

  /**
   * Synthesises a zero-width `ModuleDecl` when the file has no leading `module`
   * (FR-13, E10001) so the `ProgramNode` is still structurally complete.
   */
  function synthesizeModuleDecl(): ModuleDeclNode {
    const zero = makeSpan(sourceId, 0, 0);
    return { kind: "ModuleDecl", name: "", nameSpan: zero, span: zero };
  }

  /** Parses `import { a, b } from Dotted.Path;` (FR-14). */
  function parseImport(): ImportStmtNode {
    const importTok = cursor.advance(); // KwImport
    const symbols: { name: string; span: SourceSpan }[] = [];

    const lbrace = cursor.expect(TokenKind.LBrace, DiagCode.UnexpectedToken, "'{' after 'import'");
    if (lbrace !== null && !cursor.check(TokenKind.RBrace)) {
      for (;;) {
        const id = cursor.expect(
          TokenKind.Identifier,
          DiagCode.ExpectedIdentifier,
          "imported symbol name",
        );
        if (id !== null) {
          symbols.push({ name: cursor.lexeme(id), span: id.span });
        }
        if (cursor.check(TokenKind.Comma)) {
          cursor.advance();
          continue;
        }
        break;
      }
    }
    if (lbrace !== null) {
      cursor.expect(TokenKind.RBrace, DiagCode.MissingCloseBrace, "'}' to close import list");
    }

    cursor.expect(TokenKind.KwFrom, DiagCode.UnexpectedToken, "'from' in import statement");
    const dotted = parseDottedName("import statement");

    let end = dotted ? dotted.end : importTok.span.end;
    const semi = cursor.expect(
      TokenKind.Semicolon,
      DiagCode.MissingSemicolon,
      "';' after import statement",
    );
    if (semi !== null) {
      end = semi.span.end;
    }

    const pathStart = dotted ? dotted.start : importTok.span.end;
    const pathEnd = dotted ? dotted.end : importTok.span.end;
    return {
      kind: "ImportStmt",
      symbols,
      modulePath: dotted ? dotted.name : "",
      modulePathSpan: makeSpan(sourceId, pathStart, pathEnd),
      span: makeSpan(sourceId, importTok.span.start, end),
    };
  }

  /**
   * Skips to the next top-level synchronisation point after a dispatch error
   * (FR-6). Always consumes at least the offending token so the loop makes
   * progress, then halts before the next sync keyword (or `Eof`) and clears
   * panic so the next declaration reports its own first error.
   */
  function recoverTopLevel(): void {
    if (!cursor.atEnd()) {
      cursor.advance();
    }
    while (!cursor.atEnd() && !TOP_LEVEL_SYNC.has(cursor.peekKind())) {
      cursor.advance();
    }
    state.clearPanic();
  }

  // ── parse() body ──────────────────────────────────────────────────────────

  // 1. Module declaration (FR-13): E10001 + synthesis when absent.
  let moduleDecl: ModuleDeclNode;
  if (cursor.check(TokenKind.KwModule)) {
    moduleDecl = parseModuleDecl();
  } else {
    state.emit(
      DiagCode.MissingModuleDecl,
      here(),
      "Missing 'module' declaration — a source file must begin with 'module Name;'",
    );
    moduleDecl = synthesizeModuleDecl();
  }
  // The module region is closed; top-level items each start a fresh region.
  state.clearPanic();

  // 2. Top-level items until Eof (FR-15).
  const items: TopLevelItem[] = [];
  while (!cursor.atEnd()) {
    state.clearPanic();
    const kind = cursor.peekKind();

    if (kind === TokenKind.KwImport) {
      items.push(parseImport());
      continue;
    }
    if (kind === TokenKind.KwExport) {
      items.push(parseExportedDecl(state));
      continue;
    }
    if (DECL_KEYWORDS.has(kind)) {
      items.push(parseDeclByKeyword(state, false, here().start));
      continue;
    }
    if (kind === TokenKind.KwModule) {
      state.emit(
        DiagCode.ModuleDeclNotFirst,
        here(),
        "Unexpected second 'module' declaration — only one is allowed, and it must be first",
      );
      recoverTopLevel();
      continue;
    }
    if (kind === TokenKind.KwType) {
      // AR-2: `type` is reserved for future use; no declaration semantics.
      state.emit(DiagCode.ReservedKeyword, here(), "'type' is reserved for future use");
      recoverTopLevel();
      continue;
    }

    state.emit(DiagCode.InvalidTopLevelDeclaration, here(), "Invalid top-level declaration");
    recoverTopLevel();
  }

  const ast: ProgramNode = {
    kind: "Program",
    moduleDecl,
    items,
    span: makeSpan(sourceId, 0, source.length),
  };
  return { ast, hasErrors: bag.hasErrors() };
}

// Re-export the cursor type so consumers can reference the parser's reader.
export type { Cursor };
