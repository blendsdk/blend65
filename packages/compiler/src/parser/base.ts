/**
 * Base Parser Class for Blend65 Compiler
 *
 * Provides fundamental parsing infrastructure:
 * - Token stream management (current, peek, advance)
 * - Error reporting and recovery (diagnostics, synchronization)
 * - Module scope tracking (ordering rules enforcement)
 * - Helper methods for common parsing patterns
 *
 * This is the foundation that all parser layers build upon.
 */

import { Diagnostic, DiagnosticCode, DiagnosticCollector, SourceLocation } from '../ast/index.js';
import { Token, TokenType } from '../lexer/types.js';
import { ParserConfig, createParserConfig } from './config.js';
import { ScopeManager } from './scope-manager.js';

/**
 * Parser error class
 *
 * Thrown when a fatal parse error occurs that prevents recovery.
 * Most errors should be collected via diagnostics instead.
 */
export class ParseError extends Error {
  /**
   * Creates a parse error
   * @param message - Error message
   * @param token - Token where error occurred
   */
  constructor(
    message: string,
    public readonly token: Token
  ) {
    super(`Parse error at line ${token.start.line}, column ${token.start.column}: ${message}`);
    this.name = 'ParseError';
  }
}

/**
 * Abstract base parser class providing core parsing infrastructure
 *
 * All specialized parsers extend this class to get access to:
 * - Token stream management
 * - Error handling and recovery
 * - Module scope validation
 * - Utility helper methods
 *
 * This class cannot be instantiated directly - use a concrete parser implementation.
 */
export abstract class BaseParser {
  /** Token stream from lexer */
  protected tokens: Token[];

  /** Current position in token stream */
  protected current: number = 0;

  /** Diagnostic collector for errors/warnings */
  protected diagnostics: DiagnosticCollector = new DiagnosticCollector();

  /** Parser configuration */
  protected config: ParserConfig;

  /** Tracks if module declaration was encountered */
  protected hasExplicitModule: boolean = false;

  /** Tracks if we're currently at module scope (top level) */
  protected isModuleScope: boolean = true;

  /**
   * Centralized scope manager for function and loop tracking (Task 2.2)
   *
   * Manages all scope-related operations:
   * - Function scope lifecycle (enter/exit with parameters)
   * - Loop scope lifecycle (enter/exit for break/continue validation)
   * - Variable tracking within function scopes
   * - Scope chain lookup
   *
   * Replaces fragmented scope tracking across multiple classes.
   */
  protected scopeManager: ScopeManager;

  /**
   * Creates a new base parser
   *
   * @param tokens - Token stream from lexer
   * @param config - Parser configuration (optional)
   */
  constructor(tokens: Token[], config: Partial<ParserConfig> = {}) {
    this.tokens = tokens;
    this.config = createParserConfig(config);

    // Initialize ScopeManager with error reporter callback (Task 2.2)
    this.scopeManager = new ScopeManager((code, message, location) => {
      this.reportError(code, message, location);
    });
  }

  // ============================================
  // TOKEN STREAM MANAGEMENT
  // ============================================

  /**
   * Gets the current token without consuming it
   *
   * Safe to call even at end of stream (returns EOF token).
   *
   * @returns Current token
   */
  protected getCurrentToken(): Token {
    if (this.current >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1]; // Return EOF
    }
    return this.tokens[this.current];
  }

  /**
   * Looks ahead at a future token without consuming
   *
   * Used for lookahead parsing when you need to check
   * what's coming next before deciding how to parse.
   *
   * @param offset - How many tokens ahead to look (default: 1)
   * @returns Token at offset, or EOF if beyond end
   *
   * @example
   * ```typescript
   * // Check if next token is '='
   * if (this.peek().type === TokenType.ASSIGN) {
   *   // It's an assignment
   * }
   * ```
   */
  protected peek(offset: number = 1): Token {
    const index = this.current + offset;
    if (index >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1]; // Return EOF
    }
    return this.tokens[index];
  }

  /**
   * Advances to the next token
   *
   * Consumes the current token and moves to the next one.
   * Safe to call at end of stream (stays at EOF).
   *
   * **Performance Note:**
   * Invalidates the currentLocation() cache since we've moved to a new position.
   *
   * @returns The token that was current before advancing
   *
   * @example
   * ```typescript
   * const token = this.advance(); // Get current and move forward
   * ```
   */
  protected advance(): Token {
    const token = this.getCurrentToken();
    if (!this.isAtEnd()) {
      this.current++;
      // Invalidate location cache since we moved
      this._currentLocationCache = null;
    }
    return token;
  }

  /**
   * Checks if we've reached the end of the token stream
   *
   * @returns True if at EOF token
   */
  protected isAtEnd(): boolean {
    return this.getCurrentToken().type === TokenType.EOF;
  }

  // ============================================
  // TOKEN CHECKING & CONSUMING
  // ============================================

  /**
   * Checks if current token matches a single type (optimized fast path)
   *
   * This is the most common case for token checking (single type).
   * Optimized version avoids array allocation and includes() search.
   *
   * Does NOT consume the token - just checks.
   *
   * @param type - Token type to check
   * @returns True if current token matches the type
   *
   * @example
   * ```typescript
   * if (this.checkSingle(TokenType.LET)) {
   *   // It's a let declaration
   * }
   * ```
   */
  protected checkSingle(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.getCurrentToken().type === type;
  }

  /**
   * Checks if current token matches any of the given types
   *
   * Does NOT consume the token - just checks.
   *
   * **Performance Note:**
   * For single token checks, prefer `checkSingle(type)` for better performance.
   * This method is optimized for multiple type checking (2+ types).
   *
   * @param types - Token types to check
   * @returns True if current token matches any type
   *
   * @example
   * ```typescript
   * if (this.check(TokenType.LET, TokenType.CONST)) {
   *   // It's a variable declaration
   * }
   * ```
   */
  protected check(...types: TokenType[]): boolean {
    if (this.isAtEnd()) return false;

    // Fast path for single type (common case)
    if (types.length === 1) {
      return this.getCurrentToken().type === types[0];
    }

    // Multiple types - use includes
    return types.includes(this.getCurrentToken().type);
  }

  /**
   * Checks if current token matches and consumes it
   *
   * Combines check + advance for convenience.
   *
   * @param types - Token types to match
   * @returns True if matched and consumed
   *
   * @example
   * ```typescript
   * if (this.match(TokenType.EXPORT)) {
   *   // Consumed 'export', now parse what follows
   * }
   * ```
   */
  protected match(...types: TokenType[]): boolean {
    if (this.check(...types)) {
      this.advance();
      return true;
    }
    return false;
  }

  /**
   * Expects a specific token type and consumes it
   *
   * **Error Recovery Strategy:**
   * If the expected token is not found, this method:
   * 1. Reports an error diagnostic (does NOT throw)
   * 2. Creates a dummy token of the expected type at the current position
   * 3. Returns the dummy token to allow parsing to continue
   *
   * This approach enables reporting multiple errors in a single pass
   * rather than stopping at the first error.
   *
   * **Why Dummy Tokens?**
   * Returning a dummy token satisfies the type system and allows
   * the parser to continue constructing a partial AST. This is better
   * than throwing exceptions because:
   * - Multiple errors can be reported to the developer
   * - Partial AST can be used for IDE features (autocomplete, etc.)
   * - Better developer experience (see all errors at once)
   *
   * @param type - Expected token type
   * @param message - Error message if not found
   * @returns The consumed token (or dummy token if error)
   *
   * @example
   * ```typescript
   * // Always succeeds - either returns real token or dummy for recovery
   * const leftParen = this.expect(TokenType.LEFT_PAREN, "Expected '(' after function name");
   * ```
   */
  protected expect(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }

    // Report error diagnostic
    this.reportError(DiagnosticCode.EXPECTED_TOKEN, message);

    // Check if we've hit max errors (throws if exceeded)
    // This is the only case where we throw - when error limit reached
    // (handled by reportError method)

    // Return dummy token for error recovery
    return this.createDummyToken(type);
  }

  // ============================================
  // ERROR HANDLING & RECOVERY
  // ============================================

  /**
   * Reports an error diagnostic
   *
   * Collects the error instead of throwing (better UX).
   * Stops parsing if max errors reached.
   *
   * @param code - Diagnostic code
   * @param message - Error message
   * @param location - Optional custom location (defaults to current token)
   */
  protected reportError(code: DiagnosticCode, message: string, location?: SourceLocation): void {
    const loc = location || this.createLocation(this.getCurrentToken(), this.getCurrentToken());

    this.diagnostics.error(code, message, loc);

    // Check if we've hit max errors
    if (this.diagnostics.getErrors().length >= this.config.maxErrors) {
      throw new ParseError(
        `Maximum error limit (${this.config.maxErrors}) reached`,
        this.getCurrentToken()
      );
    }
  }

  /**
   * Reports a warning diagnostic
   *
   * @param code - Diagnostic code
   * @param message - Warning message
   * @param location - Optional custom location
   */
  protected reportWarning(code: DiagnosticCode, message: string, location?: SourceLocation): void {
    if (!this.config.collectWarnings) return;

    const loc = location || this.createLocation(this.getCurrentToken(), this.getCurrentToken());

    this.diagnostics.warning(code, message, loc);
  }

  /**
   * Synchronizes the parser after an error
   *
   * Implements "panic mode" error recovery:
   * 1. Skip tokens until we find a "synchronization point"
   * 2. Resume parsing from a safe state
   *
   * Synchronization points for Blend65:
   * - SEMICOLON (statement separator)
   * - Statement/declaration keywords (function, let, if, while, etc.)
   * - EOF
   *
   * Why synchronization?
   * After an error, the parser is in an unknown state.
   * We skip forward to a known-good place to continue.
   * This allows reporting multiple errors instead of just the first.
   */
  protected synchronize(): void {
    this.advance(); // Skip the problematic token

    while (!this.isAtEnd()) {
      // Stop at semicolon (statement boundary)
      if (this.getCurrentToken().type === TokenType.SEMICOLON) {
        this.advance(); // Skip the semicolon
        return;
      }

      // Stop before these keywords (start of new construct)
      if (
        this.check(
          TokenType.FUNCTION,
          TokenType.LET,
          TokenType.CONST,
          TokenType.IF,
          TokenType.WHILE,
          TokenType.FOR,
          TokenType.RETURN,
          TokenType.MODULE,
          TokenType.IMPORT,
          TokenType.EXPORT,
          TokenType.MATCH,
          TokenType.TYPE,
          TokenType.ENUM
        )
      ) {
        return; // Don't skip the keyword - let parser handle it
      }

      this.advance();
    }
  }

  // ============================================
  // MODULE SCOPE VALIDATION
  // ============================================

  /**
   * Validates that a module declaration can appear here
   *
   * Enforces ordering rule: only one module per file
   *
   * @throws Reports error if module already declared
   */
  protected validateModuleDeclaration(): void {
    if (this.hasExplicitModule) {
      this.reportError(
        DiagnosticCode.DUPLICATE_MODULE,
        'Only one module declaration allowed per file'
      );
    }
    this.hasExplicitModule = true;
  }

  /**
   * Validates that current token is allowed at module scope
   *
   * Enforces ordering rule: only declarations at module level
   * No executable statements allowed (function calls, assignments, etc.)
   *
   * @param token - Token to validate
   */
  protected validateModuleScopeItem(token: Token): void {
    if (!this.isModuleScope) {
      return; // Inside function or block - allow anything
    }

    // At module scope - only declarations allowed
    const validModuleTokens = [
      TokenType.MODULE,
      TokenType.IMPORT,
      TokenType.EXPORT,
      TokenType.FUNCTION,
      TokenType.CALLBACK, // Phase 4: callback functions
      TokenType.LET,
      TokenType.CONST,
      TokenType.TYPE,
      TokenType.ENUM,
      TokenType.ZP, // Storage classes
      TokenType.RAM,
      TokenType.DATA,
      TokenType.MAP, // @map declarations
      TokenType.EOF,
      TokenType.NEWLINE,
      TokenType.LINE_COMMENT,
      TokenType.BLOCK_COMMENT,
    ];

    if (!validModuleTokens.includes(token.type)) {
      this.reportError(
        DiagnosticCode.INVALID_MODULE_SCOPE,
        `Unexpected token '${token.value}' at module scope. ` +
          `Only declarations (variables, functions, types, enums) and imports/exports are allowed at module level.`
      );
    }
  }

  /**
   * Enters a non-module scope (e.g., inside function body)
   *
   * After calling this, executable statements are allowed.
   */
  protected enterFunctionScope(): void {
    this.isModuleScope = false;
  }

  /**
   * Returns to module scope
   *
   * After calling this, only declarations are allowed.
   */
  protected exitFunctionScope(): void {
    this.isModuleScope = true;
  }

  // ============================================
  // UTILITY HELPERS
  // ============================================

  /**
   * Creates a dummy token for error recovery
   *
   * **Purpose:**
   * When the parser encounters an error (e.g., expected '(' but found 'x'),
   * we need to create a synthetic token to allow parsing to continue.
   * This dummy token satisfies the type system while indicating an error occurred.
   *
   * **Usage:**
   * Called by `expect()` when the expected token is not found.
   * The dummy token is positioned at the current location so error messages
   * point to the right place in the source code.
   *
   * **Why Not Just Return Current Token?**
   * Returning the actual current token would cause confusion:
   * - Type would be wrong (e.g., IDENTIFIER when we expected LEFT_PAREN)
   * - Value would be wrong (e.g., "x" when we expected "(")
   * - Parser logic might make incorrect decisions based on wrong type
   *
   * **Dummy Token Characteristics:**
   * - Has the expected token type (what we wanted)
   * - Has empty value (indicates it's synthetic)
   * - Has current position (so errors point to right place)
   * - Allows parser to continue with partial AST construction
   *
   * @param type - The expected token type that was missing
   * @returns A synthetic token for error recovery
   *
   * @example
   * ```typescript
   * // Parser expected '(' but found 'x'
   * // Creates dummy LEFT_PAREN token at current position
   * // Parser continues as if '(' was there (with error reported)
   * const leftParen = this.createDummyToken(TokenType.LEFT_PAREN);
   * ```
   */
  protected createDummyToken(type: TokenType): Token {
    const current = this.getCurrentToken();
    return {
      type,
      value: '', // Empty value indicates dummy token
      start: current.start,
      end: current.start, // Zero-width token at current position
    };
  }

  /**
   * Expects a semicolon token
   *
   * Used for statement separation (semicolons are now required).
   *
   * @param message - Error message if no semicolon found (optional)
   *
   * @example
   * ```typescript
   * const stmt = this.parseVariableDecl();
   * this.expectSemicolon('Expected semicolon after variable declaration');
   * ```
   */
  protected expectSemicolon(message: string = 'Expected semicolon'): void {
    if (!this.match(TokenType.SEMICOLON)) {
      // Report error even at EOF - semicolons are strictly required
      this.reportError(DiagnosticCode.EXPECTED_TOKEN, message);
    }
  }

  /**
   * Creates a SourceLocation from two tokens
   *
   * Useful when creating AST nodes that span multiple tokens.
   *
   * @param start - Starting token
   * @param end - Ending token
   * @returns SourceLocation spanning from start to end
   *
   * @example
   * ```typescript
   * const location = this.createLocation(nameToken, closeBraceToken);
   * return new FunctionDecl(..., location);
   * ```
   */
  protected createLocation(start: Token, end: Token): SourceLocation {
    const location: SourceLocation = {
      start: start.start,
      end: end.end,
    };

    // Optionally include source text
    if (this.config.trackSourceText) {
      // Would extract from original source here
      // For now, we leave it undefined
    }

    return location;
  }

  /**
   * Cached current token location for performance
   *
   * Many parser operations need the current location multiple times.
   * This cache avoids recreating the same location object repeatedly.
   * Cache is invalidated on every token advance.
   */
  protected _currentLocationCache: SourceLocation | null = null;
  protected _currentLocationCacheToken: number = -1;

  /**
   * Creates a SourceLocation from current token (with caching)
   *
   * Shorthand for single-token nodes. Caches the result to avoid
   * recreating the same location object when called multiple times
   * for the same token position.
   *
   * **Performance Note:**
   * This method caches the location for the current token position.
   * The cache is automatically invalidated when `advance()` is called.
   *
   * @returns SourceLocation for current token
   */
  protected currentLocation(): SourceLocation {
    // Check if cache is valid for current position
    if (this._currentLocationCache && this._currentLocationCacheToken === this.current) {
      return this._currentLocationCache;
    }

    // Cache miss - create new location
    const token = this.getCurrentToken();
    const location = this.createLocation(token, token);

    // Update cache
    this._currentLocationCache = location;
    this._currentLocationCacheToken = this.current;

    return location;
  }

  /**
   * Creates a SourceLocation by merging two existing locations
   *
   * Useful when combining AST nodes into a larger node.
   *
   * @param start - Starting location
   * @param end - Ending location
   * @returns Combined source location
   *
   * @example
   * ```typescript
   * const location = this.mergeLocations(
   *   left.getLocation(),
   *   right.getLocation()
   * );
   * return new BinaryExpression(left, op, right, location);
   * ```
   */
  protected mergeLocations(start: SourceLocation, end: SourceLocation): SourceLocation {
    return {
      start: start.start,
      end: end.end,
    };
  }

  /**
   * Checks if current token is a storage class
   *
   * Storage classes: @zp, @ram, @data, @map
   *
   * Note: This only checks for explicit storage class tokens.
   * Use parseStorageClass() to get the effective storage class (including default).
   *
   * @returns True if current token is an explicit storage class token
   */
  protected isStorageClass(): boolean {
    return this.check(TokenType.ZP, TokenType.RAM, TokenType.DATA, TokenType.MAP);
  }

  /**
   * Checks if current token is an export modifier (optimized)
   *
   * Uses fast path for single token check.
   *
   * @returns True if current token is 'export'
   */
  protected isExportModifier(): boolean {
    return this.checkSingle(TokenType.EXPORT);
  }

  /**
   * Checks if current token is 'let' or 'const'
   *
   * @returns True if current token is let or const
   */
  protected isLetOrConst(): boolean {
    return this.check(TokenType.LET, TokenType.CONST);
  }

  /**
   * Parses an optional storage class
   *
   * Consumes storage class token if present (@zp, @ram, @data).
   * When no storage class is specified, defaults to @ram.
   *
   * @returns Storage class token type (always returns a value; defaults to TokenType.RAM)
   *
   * @example
   * ```typescript
   * // Explicit storage class
   * // @zp let x: byte;     // Returns TokenType.ZP
   * // @ram let y: byte;    // Returns TokenType.RAM
   * // @data const z: byte; // Returns TokenType.DATA
   *
   * // No storage class specified
   * // let w: byte;         // Returns TokenType.RAM (default)
   * ```
   */
  protected parseStorageClass(): TokenType | null {
    if (this.match(TokenType.ZP)) return TokenType.ZP;
    if (this.match(TokenType.RAM)) return TokenType.RAM;
    if (this.match(TokenType.DATA)) return TokenType.DATA;
    return TokenType.RAM; // Default storage class
  }

  /**
   * Parses an optional export modifier
   *
   * Consumes 'export' token if present.
   * @returns True if export modifier was present
   */
  protected parseExportModifier(): boolean {
    return this.match(TokenType.EXPORT);
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Gets all collected diagnostics
   *
   * Call this after parsing to retrieve errors/warnings.
   *
   * @returns Array of diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return this.diagnostics.getAll();
  }

  /**
   * Checks if parsing had any errors
   *
   * Use this to determine if compilation can proceed.
   *
   * @returns True if errors occurred
   */
  public hasErrors(): boolean {
    return this.diagnostics.hasErrors();
  }

  /**
   * Gets diagnostic counts by severity
   *
   * @returns Object with error/warning/info/hint counts
   */
  public getDiagnosticCounts(): {
    errors: number;
    warnings: number;
    info: number;
    hints: number;
  } {
    return this.diagnostics.getCounts();
  }
}
