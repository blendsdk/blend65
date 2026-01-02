/**
 * Base Parser
 *
 * Abstract base class for all parsers. Provides common functionality for
 * token navigation, error handling, and AST construction.
 *
 * Adapted for Blend65 from original blend-lang implementation.
 */

import { Token, TokenType } from '@blend65/lexer';
import { ASTNodeFactory } from '@blend65/ast';
import { ASTNode } from '@blend65/ast';
import {
  ErrorRecoveryStrategy,
  ErrorReporter,
  ParseError,
  SynchronizationRecovery,
  UnexpectedTokenError,
} from './error.js';
import { TokenStream } from './token-stream.js';

/**
 * Parser configuration options
 */
export interface ParserOptions {
  /**
   * Whether to filter out comments
   */
  filterComments?: boolean;

  /**
   * Whether to filter out newlines
   */
  filterNewlines?: boolean;

  /**
   * Custom token filters
   */
  tokenFilters?: ((token: Token) => boolean)[];

  /**
   * Maximum number of errors before stopping
   */
  maxErrors?: number;

  /**
   * Error recovery strategy
   */
  recoveryStrategy?: ErrorRecoveryStrategy;

  /**
   * Whether to enable error recovery
   */
  enableRecovery?: boolean;
}

/**
 * Abstract base parser class for Blend65
 */
export abstract class BaseParser<T extends ASTNode = ASTNode> {
  protected stream: TokenStream;
  protected factory: ASTNodeFactory;
  protected errorReporter: ErrorReporter;
  protected recoveryStrategy: ErrorRecoveryStrategy;
  protected enableRecovery: boolean;

  constructor(tokens: Token[], options: ParserOptions = {}) {
    // Apply token filters
    const filteredTokens = this.filterTokens(tokens, options);

    // Initialize token stream
    this.stream = new TokenStream(filteredTokens);

    // Initialize AST factory
    this.factory = new ASTNodeFactory();

    // Initialize error handling
    this.errorReporter = new ErrorReporter(options.maxErrors);
    this.recoveryStrategy = options.recoveryStrategy || new SynchronizationRecovery();
    this.enableRecovery = options.enableRecovery !== false;
  }

  /**
   * Filter tokens based on options
   */
  private filterTokens(tokens: Token[], options: ParserOptions): Token[] {
    let filtered = tokens;

    // Filter comments
    if (options.filterComments) {
      filtered = filtered.filter(
        t => t.type !== TokenType.LINE_COMMENT && t.type !== TokenType.BLOCK_COMMENT
      );
    }

    // Filter newlines
    if (options.filterNewlines) {
      filtered = filtered.filter(t => t.type !== TokenType.NEWLINE);
    }

    // Apply custom filters
    if (options.tokenFilters) {
      for (const filter of options.tokenFilters) {
        filtered = filtered.filter(filter);
      }
    }

    return filtered;
  }

  /**
   * Parse the tokens into an AST
   * Must be implemented by subclasses
   */
  abstract parse(): T;

  // -----------------------
  // Token Navigation
  // -----------------------

  /**
   * Check if we're at the end of the token stream
   */
  protected isAtEnd(): boolean {
    return this.stream.isAtEnd();
  }

  /**
   * Get the current token without advancing
   */
  protected peek(offset: number = 0): Token {
    return this.stream.peek(offset);
  }

  /**
   * Get the previous token
   */
  protected previous(offset: number = 1): Token {
    return this.stream.previous(offset);
  }

  /**
   * Advance to the next token and return the current one
   */
  protected advance(): Token {
    return this.stream.advance();
  }

  /**
   * Check if the current token matches any of the given types
   */
  protected check(...types: TokenType[]): boolean {
    return this.stream.check(...types);
  }

  /**
   * Check if the current token matches a specific lexeme
   */
  protected checkLexeme(lexeme: string): boolean {
    return this.stream.checkLexeme(lexeme);
  }

  /**
   * Check if the current token matches any of the given lexemes
   */
  protected checkLexemes(...lexemes: string[]): boolean {
    return this.stream.checkLexemes(...lexemes);
  }

  /**
   * Match and consume a token if it matches any of the given types
   */
  protected match(...types: TokenType[]): boolean {
    return this.stream.match(...types);
  }

  /**
   * Match and consume a token if it matches a specific lexeme
   */
  protected matchLexeme(lexeme: string): boolean {
    return this.stream.matchLexeme(lexeme);
  }

  /**
   * Match and consume a token if it matches any of the given lexemes
   */
  protected matchLexemes(...lexemes: string[]): boolean {
    return this.stream.matchLexemes(...lexemes);
  }

  /**
   * Consume a token of the expected type or throw an error
   */
  protected consume(type: TokenType, errorMessage: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const err = new UnexpectedTokenError(this.peek(), TokenType[type] || String(type));
    this.reportError(err);
    throw err;
  }

  /**
   * Consume a token with the expected lexeme or throw an error
   */
  protected consumeLexeme(lexeme: string, errorMessage: string): Token {
    if (this.checkLexeme(lexeme)) {
      return this.advance();
    }
    const err = new UnexpectedTokenError(this.peek(), lexeme);
    this.reportError(err);
    throw err;
  }

  /**
   * Skip tokens of specific types
   */
  protected skip(...types: TokenType[]): void {
    this.stream.skip(...types);
  }

  /**
   * Skip tokens with specific lexemes
   */
  protected skipLexemes(...lexemes: string[]): void {
    this.stream.skipLexemes(...lexemes);
  }

  /**
   * Look ahead to find a token matching a predicate
   */
  protected lookAhead(predicate: (token: Token) => boolean, maxLookAhead: number = 10): number {
    return this.stream.lookAhead(predicate, maxLookAhead);
  }

  // -----------------------
  // Error Handling
  // -----------------------

  /**
   * Report a parse error
   */
  protected reportError(error: ParseError): void {
    this.errorReporter.report(error);

    if (this.enableRecovery) {
      this.recover(error);
    } else {
      throw error;
    }
  }

  /**
   * Attempt to recover from an error
   */
  protected recover(error: ParseError): void {
    const recovered = this.recoveryStrategy.recover(error, {
      position: this.stream.getPosition(),
      tokens: this.stream.getTokens(),
    });

    if (recovered) {
      this.errorReporter.report(error, true, this.peek());
    }
  }

  /**
   * Synchronize to a specific token type (for error recovery)
   */
  protected synchronize(...types: TokenType[]): void {
    this.stream.synchronize(...types);
  }

  /**
   * Synchronize to a specific lexeme (for error recovery)
   */
  protected synchronizeLexeme(...lexemes: string[]): void {
    this.stream.synchronizeLexeme(...lexemes);
  }

  /**
   * Get the error reporter
   */
  getErrorReporter(): ErrorReporter {
    return this.errorReporter;
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errorReporter.hasErrors();
  }

  /**
   * Get all errors
   */
  getErrors() {
    return this.errorReporter.getErrors();
  }

  // -----------------------
  // AST Construction Helpers
  // -----------------------

  /**
   * Get the AST node factory
   */
  protected getFactory(): ASTNodeFactory {
    return this.factory;
  }

  /**
   * Create a node with position information from tokens
   */
  protected createNode(type: string, startToken: Token, endToken: Token, props: any = {}): ASTNode {
    return this.factory.create(type, {
      ...props,
      start: startToken.start,
      end: endToken.end,
    });
  }

  // -----------------------
  // Utility Methods
  // -----------------------

  /**
   * Create a snapshot of the current parser state
   */
  protected snapshot(): number {
    return this.stream.snapshot();
  }

  /**
   * Restore to a previous snapshot
   */
  protected restore(snapshot: number): void {
    this.stream.restore(snapshot);
  }

  /**
   * Get the current position in the token stream
   */
  protected getPosition(): number {
    return this.stream.getPosition();
  }

  /**
   * Get all tokens
   */
  protected getTokens(): Token[] {
    return this.stream.getTokens();
  }
}
