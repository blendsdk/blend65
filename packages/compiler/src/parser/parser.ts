/**
 * Phase 1 parser scaffolding that wires lexer tokens into AST construction.
 *
 * The goal of this module is to provide a well-documented Parser shell with all
 * traversal utilities, diagnostics plumbing, and the top-level `parseTokens`
 * entry point. Future phases can focus on actual grammar production rules while
 * reusing the infrastructure defined here.
 */

import type { Token } from '../lexer/types.js';
import { TokenType } from '../lexer/types.js';
import { type DeclarationNode, type ProgramNode, type StatementNode } from './ast.js';
import {
  createParserDiagnostic,
  ParserDiagnosticCode,
  ParserDiagnosticSeverity,
  type ParserDiagnostic,
} from './diagnostics.js';
import {
  reportDuplicateModule,
  reportEmptyImportList,
  reportImplicitMainExport,
  reportMissingFromClause,
} from './diagnostic-emitters.js';
import { createProgram } from './factory.js';
import { createSourceSpan, UNKNOWN_SOURCE_SPAN, type SourceSpan } from './source.js';

/**
 * Mutable bookkeeping container that tracks parser-level state across the span
 * of a single file parse. Having an explicit structure keeps future invariants
 * (implicit vs explicit modules, exported main counting, etc.) discoverable.
 */
export interface ParserState {
  /** True once the file declares a module explicitly. */
  hasExplicitModule: boolean;
  /** True when the parser synthesizes `module global`. */
  hasImplicitModule: boolean;
  /** Tracks whether `function main` has been seen at all. */
  sawMainFunction: boolean;
  /** Number of exported `main` declarations observed so far. */
  exportedMainCount: number;
  /** Span of the first exported `main`, used for duplicate diagnostics. */
  firstExportedMainSpan?: SourceSpan;
}

/**
 * Creates a parser state container with deterministic defaults.
 *
 * Abstracting the initialization into a helper keeps the constructor tidy and
 * gives tests a single location to validate expectations when future fields are
 * added.
 *
 * @returns Fresh parser state for an individual file parse.
 */
export function createParserState(): ParserState {
  return {
    hasExplicitModule: false,
    hasImplicitModule: false,
    sawMainFunction: false,
    exportedMainCount: 0,
  };
}

/**
 * Configuration toggles for the parser.
 * Additional switches (e.g., decorator support) can be appended without
 * breaking callers because partial options are accepted.
 */
export interface ParserOptions {
  /** When true, parser collects doc comments. Reserved for future work. */
  captureDocComments?: boolean;
}

/**
 * Result container returned by {@link parseTokens}. Keeping the diagnostics list
 * alongside the root AST node mirrors future multi-file registry APIs.
 */
export interface ParserResult {
  program: ProgramNode;
  diagnostics: ParserDiagnostic[];
}

/**
 * Public entry point that turns a token stream into an AST program node.
 * In later phases this function will be hooked into the lexer so callers can
 * simply pass raw source text; for now we accept tokens directly to keep the
 * scaffolding testable in isolation.
 *
 * @param tokens - Token stream emitted by the lexer (must end with EOF).
 * @param options - Optional parser configuration (defaults to empty object).
 * @returns Program node plus accumulated diagnostics.
 */
export function parseTokens(tokens: Token[], options: ParserOptions = {}): ParserResult {
  const parser = new Parser(tokens, options);
  const program = parser.parseProgram();
  return {
    program,
    diagnostics: parser.diagnostics,
  };
}

/**
 * Recursive-descent parser shell responsible for cursor management, diagnostics,
 * and recovery hooks. Grammar-specific methods will be implemented in future
 * phases, but Phase 1 focuses on robust infrastructure and documentation.
 */
export class Parser {
  /** Token buffer produced by the lexer. */
  protected readonly tokens: Token[];
  /** Parser configuration switches. */
  protected readonly options: ParserOptions;
  /** Cursor pointing at the current token index. */
  protected currentIndex = 0;
  /** Collected diagnostics emitted during the parse. */
  public readonly diagnostics: ParserDiagnostic[] = [];
  /** Span representing the entire input file. */
  protected readonly fileSpan: SourceSpan;
  /** Mutable bookkeeping about module/main parsing requirements. */
  protected readonly state: ParserState;

  /**
   * @param tokens - Token stream ending with EOF.
   * @param options - Parser configuration switches.
   */
  public constructor(tokens: Token[], options: ParserOptions = {}) {
    this.tokens = tokens.length > 0 ? tokens : Parser.createImplicitEOF();
    this.options = options;
    this.fileSpan = Parser.computeFileSpan(this.tokens);
    this.state = createParserState();
  }

  /**
   * Parses the entire program by looping over top-level items until EOF.
   * Future phases will extend {@link parseTopLevelItem} to differentiate
   * between declarations and statements.
   */
  public parseProgram(): ProgramNode {
    const body: Array<DeclarationNode | StatementNode> = [];

    while (!this.isAtEnd()) {
      this.skipTrivia();
      this.skipNewlines();
      if (this.isAtEnd()) {
        break;
      }

      const lookahead = this.peekEffectiveToken();
      if (lookahead.type === TokenType.EOF) {
        break;
      }

      const item = this.parseTopLevelItem();
      if (item) {
        body.push(item);
        continue;
      }

      // If parsing failed, enter recovery mode to avoid infinite loops.
      this.synchronize();
    }

    return createProgram(body, { span: this.fileSpan });
  }

  /**
   * Phase 2 will specialize this dispatcher so declarations and statements are
   * handled by their dedicated hooks. For now we only route and emit scaffolding
   * diagnostics so future work has a clear insertion point.
   */
  protected parseTopLevelItem(): DeclarationNode | StatementNode | null {
    const token = this.current();

    if (this.isDeclarationKeyword(token.type)) {
      return this.parseDeclaration();
    }

    return this.parseStatement();
  }

  /**
   * Placeholder hook for declaration parsing. Phase 2 will replace the
   * scaffolding diagnostics with real grammar production rules.
   *
   * Minimal stub wiring for Task 2.2.2: Invokes diagnostic helper emitters so
   * integration tests can verify helper reachability before full parsing arrives.
   */
  protected parseDeclaration(): DeclarationNode | StatementNode | null {
    const keyword = this.current();
    const keywordSpan = createSourceSpan(keyword.start, keyword.end);
    this.advance();

    // Stub logic for MODULE keyword: detect duplicate module declarations
    if (keyword.type === TokenType.MODULE) {
      if (this.state.hasExplicitModule) {
        reportDuplicateModule(this.diagnostics, keywordSpan);
      }
      this.state.hasExplicitModule = true;
    }

    // Stub logic for IMPORT keyword: detect missing from clause and empty lists
    if (keyword.type === TokenType.IMPORT) {
      const nextToken = this.current();
      
      // If we see FROM immediately, the import list is empty
      if (nextToken.type === TokenType.FROM) {
        reportEmptyImportList(this.diagnostics, keywordSpan);
      } else if (nextToken.type === TokenType.IDENTIFIER) {
        // Consume identifier(s) and check for FROM clause
        this.advance();
        const followingToken = this.current();
        
        // If no FROM follows, it's missing
        if (followingToken.type !== TokenType.FROM && !this.isAtEnd()) {
          reportMissingFromClause(this.diagnostics, keywordSpan);
        }
      }
      
      // If at EOF without seeing FROM, also report missing
      if (this.isAtEnd()) {
        reportMissingFromClause(this.diagnostics, keywordSpan);
        return null;
      }
    }

    // Stub logic for FUNCTION keyword: detect implicit main export
    if (keyword.type === TokenType.FUNCTION) {
      const nextToken = this.current();
      
      if (nextToken.type === TokenType.IDENTIFIER && nextToken.value === 'main') {
        reportImplicitMainExport(this.diagnostics, createSourceSpan(nextToken.start, nextToken.end));
      }
    }

    // TODO(#phase2): Parse module/function/import/export declarations fully.
    const declarationNameExpectation = `${keyword.value || keyword.type} name`;
    if (this.isAtEnd()) {
      this.reportUnexpectedEOF(declarationNameExpectation);
      return null;
    }

    if (this.current().type !== TokenType.IDENTIFIER) {
      this.reportMissingIdentifier(this.current(), declarationNameExpectation);
      this.advance();
      return null;
    }

    this.advance(); // Consume identifier to maintain forward progress.
    return null;
  }

  /**
   * Placeholder hook for statement parsing. Future phases will extend this to
   * recognize expressions, assignments, and control-flow constructs.
   */
  protected parseStatement(): StatementNode | null {
    const token = this.current();

    if (token.type === TokenType.IDENTIFIER) {
      this.reportMissingDeclarationKeyword(token);
    } else {
      this.reportUnexpectedToken(token, 'top-level declaration or statement');
    }

    this.advance();
    return null;
  }

  /** Determines whether the token starts a declaration construct. */
  protected isDeclarationKeyword(tokenType: TokenType): boolean {
    switch (tokenType) {
      case TokenType.MODULE:
      case TokenType.FUNCTION:
      case TokenType.IMPORT:
      case TokenType.EXPORT:
        return true;
      default:
        return false;
    }
  }

  /** Determines whether a token should be treated as trivia. */
  protected isTriviaToken(tokenType: TokenType): boolean {
    switch (tokenType) {
      case TokenType.NEWLINE:
      case TokenType.LINE_COMMENT:
      case TokenType.BLOCK_COMMENT:
        return true;
      default:
        return false;
    }
  }

  /**
   * Peeks ahead while skipping trivia tokens so callers can reason about the
   * next meaningful token without mutating the parser cursor.
   *
   * @param offset - Number of non-trivia tokens to skip before returning.
   * @returns The offset-th non-trivia token or EOF when the stream ends.
   */
  protected peekEffectiveToken(offset = 0): Token {
    let index = this.currentIndex;
    let remaining = offset;

    while (index < this.tokens.length) {
      const token = this.tokens[index];
      if (!this.isTriviaToken(token.type)) {
        if (remaining === 0) {
          return token;
        }
        remaining -= 1;
      }
      index += 1;
    }

    return this.tokens[this.tokens.length - 1];
  }

  /**
   * Consumes contiguous NEWLINE tokens while leaving other trivia intact so
   * declaration parsers can make layout-sensitive decisions.
   */
  protected skipNewlines(): void {
    while (!this.isAtEnd() && this.current().type === TokenType.NEWLINE) {
      this.advance();
    }
  }

  /** Advances the cursor and returns the previous token. */
  protected advance(): Token {
    if (!this.isAtEnd()) {
      this.currentIndex += 1;
    }
    return this.previous();
  }

  /** Returns the token at the current cursor position. */
  protected current(): Token {
    return this.tokens[this.currentIndex];
  }

  /** Returns the token immediately before the cursor. */
  protected previous(): Token {
    const index = Math.max(0, this.currentIndex - 1);
    return this.tokens[index];
  }

  /** Peeks ahead without consuming tokens. */
  protected peek(offset = 0): Token {
    const index = Math.min(this.tokens.length - 1, this.currentIndex + offset);
    return this.tokens[index];
  }

  /** Checks whether the parser cursor reached EOF. */
  protected isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  /**
   * Consumes a token of the expected type or emits a diagnostic.
   *
   * @param type - Expected token type.
   * @param message - Diagnostic message when the expectation is not met.
   */
  protected consume(type: TokenType, message: string): Token | null {
    if (this.current().type === type) {
      return this.advance();
    }

    this.reportUnexpectedToken(this.current(), message);
    return null;
  }

  /**
   * Skips comment trivia while leaving newline tokens intact so layout-aware
   * helpers ({@link skipNewlines}) can make independent decisions.
   */
  protected skipTrivia(): void {
    while (!this.isAtEnd()) {
      const tokenType = this.current().type;
      if (tokenType === TokenType.LINE_COMMENT || tokenType === TokenType.BLOCK_COMMENT) {
        this.advance();
        continue;
      }
      break;
    }
  }

  /**
   * Lightweight panic-mode recovery that advances until a synchronizing token
   * (newline, END, or EOF) is encountered.
   */
  protected synchronize(): void {
    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.NEWLINE) {
        return;
      }

      switch (this.current().type) {
        case TokenType.EOF:
        case TokenType.END:
        case TokenType.MODULE:
        case TokenType.FUNCTION:
        case TokenType.IMPORT:
        case TokenType.EXPORT:
          return;
        default:
          this.advance();
      }
    }
  }

  /** Emits a standardized unexpected-token diagnostic. */
  protected reportUnexpectedToken(token: Token, expectation: string): void {
    const span = createSourceSpan(token.start, token.end);
    this.diagnostics.push(
      createParserDiagnostic(
        ParserDiagnosticCode.UnexpectedToken,
        ParserDiagnosticSeverity.Error,
        `Expected ${expectation} but found ${token.type}`,
        span
      )
    );
  }

  /** Emits a diagnostic when EOF is reached before completing the current construct. */
  protected reportUnexpectedEOF(expectation: string): void {
    this.diagnostics.push(
      createParserDiagnostic(
        ParserDiagnosticCode.UnexpectedEOF,
        ParserDiagnosticSeverity.Error,
        `Unexpected end of input while parsing ${expectation}`,
        this.fileSpan
      )
    );
  }

  /** Emits a diagnostic when an identifier is required but missing. */
  protected reportMissingIdentifier(token: Token, expectation: string): void {
    this.diagnostics.push(
      createParserDiagnostic(
        ParserDiagnosticCode.MissingIdentifier,
        ParserDiagnosticSeverity.Error,
        `Expected identifier for ${expectation} but found ${token.type}`,
        createSourceSpan(token.start, token.end)
      )
    );
  }

  /** Emits a diagnostic when a declaration keyword is missing. */
  protected reportMissingDeclarationKeyword(token: Token): void {
    this.diagnostics.push(
      createParserDiagnostic(
        ParserDiagnosticCode.MissingDeclarationKeyword,
        ParserDiagnosticSeverity.Error,
        `Expected declaration keyword before identifier '${token.value}'`,
        createSourceSpan(token.start, token.end)
      )
    );
  }

  /** Utility helper that synthesizes an EOF token when none is provided. */
  protected static createImplicitEOF(): Token[] {
    return [
      {
        type: TokenType.EOF,
        value: '',
        start: { line: 0, column: 0, offset: 0 },
        end: { line: 0, column: 0, offset: 0 },
      },
    ];
  }

  /** Derives a span covering the entire token stream. */
  protected static computeFileSpan(tokens: Token[]): SourceSpan {
    if (tokens.length === 0) {
      return UNKNOWN_SOURCE_SPAN;
    }

    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    return createSourceSpan(first.start, last.end);
  }
}
