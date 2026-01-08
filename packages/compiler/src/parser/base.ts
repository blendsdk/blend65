/**
 * Base Parser Class for Blend65 Compiler
 *
 * Provides fundamental parsing infrastructure:
 * - Token stream management (current, peek, advance)
 * - Error reporting and recovery (diagnostics, synchronization)
 * - Module scope tracking (ordering rules enforcement)
 * - Pratt expression parsing utilities (precedence, binding power)
 * - Helper methods for common parsing patterns
 *
 * This is the foundation that all concrete parsers build upon.
 */

import {
  BinaryExpression,
  Diagnostic,
  DiagnosticCode,
  DiagnosticCollector,
  Expression,
  SourceLocation,
} from '../ast/index.js';
import { Token, TokenType } from '../lexer/types.js';
import {
  ParserConfig,
  createParserConfig,
  getPrecedence,
  isBinaryOperator,
  isRightAssociative,
} from './index.js';
import { OperatorPrecedence } from './precedence.js';

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
 * Abstract base parser class
 *
 * Manages token stream and provides utilities for parsing.
 * Concrete parsers extend this to implement specific grammar rules.
 *
 * Design patterns used:
 * - Template Method: Base class provides structure, subclasses fill in details
 * - Strategy: Different parsers can use different strategies
 * - Collector: Diagnostics accumulate rather than throwing
 *
 * Usage:
 * ```typescript
 * class Blend65Parser extends Parser {
 *   public parse(): Program {
 *     // Use base class utilities to parse tokens
 *     return this.parseProgram();
 *   }
 *
 *   protected parseProgram(): Program {
 *     // Implementation using this.expect(), this.match(), etc.
 *   }
 * }
 * ```
 */
export abstract class Parser {
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
   * Creates a new parser
   *
   * @param tokens - Token stream from lexer
   * @param config - Parser configuration (optional)
   */
  constructor(tokens: Token[], config: Partial<ParserConfig> = {}) {
    this.tokens = tokens;
    this.config = createParserConfig(config);
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
   * Checks if current token matches any of the given types
   *
   * Does NOT consume the token - just checks.
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
   * If token doesn't match, reports error and may throw or recover.
   *
   * @param type - Expected token type
   * @param message - Error message if not found
   * @returns The consumed token
   * @throws ParseError if continueOnError is false
   *
   * @example
   * ```typescript
   * this.expect(TokenType.LEFT_PAREN, "Expected '(' after function name");
   * ```
   */
  protected expect(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }

    // Report error
    this.reportError(DiagnosticCode.EXPECTED_TOKEN, message);

    // If not continuing on errors, throw
    if (!this.config.continueOnError) {
      throw new ParseError(message, this.getCurrentToken());
    }

    // Return current token anyway (recovery)
    return this.getCurrentToken();
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
      TokenType.LET,
      TokenType.CONST,
      TokenType.TYPE,
      TokenType.ENUM,
      TokenType.ZP, // Storage classes
      TokenType.RAM,
      TokenType.DATA,
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
  // PRATT EXPRESSION PARSING INFRASTRUCTURE
  // ============================================

  /**
   * Parses a primary expression (abstract method)
   *
   * Primary expressions are the "atoms" of the language - the simplest
   * expressions that cannot be broken down further. These are the base
   * case for recursive expression parsing.
   *
   * Subclasses MUST implement this to define what constitutes a
   * "primary" expression in their specific grammar.
   *
   * Common primary expressions:
   * - Literals: numbers, strings, booleans (42, "hello", true)
   * - Identifiers: variable/function names (myVar, counter)
   * - Parenthesized expressions: (2 + 3)
   * - Array literals: [1, 2, 3] (in full parser)
   * - Function calls: foo(x, y) (may be handled as postfix)
   *
   * @returns Expression AST node representing a primary expression
   *
   * @example
   * ```typescript
   * // In SimpleExampleParser:
   * protected parsePrimaryExpression(): Expression {
   *   if (this.check(TokenType.NUMBER)) {
   *     return new LiteralExpression(parseNumberValue(...));
   *   }
   *   // ... handle other primary types
   * }
   * ```
   */
  protected abstract parsePrimaryExpression(): Expression;

  /**
   * Parses an expression using Pratt parser with precedence climbing
   *
   * This is a universal expression parsing algorithm that works for any grammar.
   * It handles operator precedence and associativity by recursively parsing
   * operands and building binary expression trees.
   *
   * The algorithm:
   * 1. Parse left operand (primary expression)
   * 2. While current token is a binary operator with sufficient precedence:
   *    a. Save the operator and its precedence
   *    b. Consume the operator
   *    c. Calculate next minimum precedence (handles associativity)
   *    d. Recursively parse right operand
   *    e. Build binary expression node with merged locations
   *    f. Continue with result as new left operand
   * 3. Return final expression tree
   *
   * Examples of parsed expressions:
   * - Simple: 42 → LiteralExpression(42)
   * - Variable: counter → IdentifierExpression("counter")
   * - Binary: 2 + 3 → BinaryExpression(2, PLUS, 3)
   * - Precedence: x * y + z → BinaryExpression((x * y), PLUS, z)
   * - Associativity: a = b = c → BinaryExpression(a, ASSIGN, (b = c))
   *
   * @param minPrecedence - Minimum precedence for operators (default: NONE)
   *                        Used internally for precedence climbing
   * @returns Expression AST node representing the parsed expression
   *
   * @remarks
   * This method delegates to parsePrimaryExpression() for base cases,
   * which must be implemented by subclasses to define grammar-specific
   * primary expressions.
   */
  protected parseExpression(minPrecedence: number = OperatorPrecedence.NONE): Expression {
    // Parse left side (primary expression)
    let left = this.parsePrimaryExpression();

    // Parse binary operators with precedence climbing
    while (this.isBinaryOp() && this.getCurrentPrecedence() > minPrecedence) {
      const operator = this.getCurrentToken().type;
      const precedence = this.getCurrentPrecedence();

      this.advance(); // Consume operator

      // For right-associative operators (like =), use same precedence
      // For left-associative operators, use precedence + 1 to force tighter binding on right
      const nextMinPrecedence = this.isRightAssoc(operator) ? precedence : precedence + 1;

      const right = this.parseExpression(nextMinPrecedence);

      // Merge locations from left and right operands
      const location = this.mergeLocations(left.getLocation(), right.getLocation());

      left = new BinaryExpression(left, operator, right, location);
    }

    return left;
  }

  /**
   * Gets the precedence of the current token
   *
   * Used by Pratt parser to decide how to group operators.
   *
   * @returns Precedence level (0 = not an operator)
   */
  protected getCurrentPrecedence(): number {
    return getPrecedence(this.getCurrentToken().type);
  }

  /**
   * Checks if current token is a binary operator
   *
   * @returns True if current token is a binary operator
   */
  protected isBinaryOp(): boolean {
    return isBinaryOperator(this.getCurrentToken().type);
  }

  /**
   * Checks if an operator is right-associative
   *
   * Right-associative: a = b = c → a = (b = c)
   * Left-associative: a + b + c → (a + b) + c
   *
   * @param tokenType - Operator to check
   * @returns True if right-associative
   */
  protected isRightAssoc(tokenType: TokenType): boolean {
    return isRightAssociative(tokenType);
  }

  // ============================================
  // UTILITY HELPERS
  // ============================================

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
   * Creates a SourceLocation from current token
   *
   * Shorthand for single-token nodes.
   *
   * @returns SourceLocation for current token
   */
  protected currentLocation(): SourceLocation {
    const token = this.getCurrentToken();
    return this.createLocation(token, token);
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
   * Storage classes: @zp, @ram, @data
   *
   * Note: This only checks for explicit storage class tokens.
   * Use parseStorageClass() to get the effective storage class (including default).
   *
   * @returns True if current token is an explicit storage class token
   */
  protected isStorageClass(): boolean {
    return this.check(TokenType.ZP, TokenType.RAM, TokenType.DATA);
  }

  /**
   * Checks if current token is an export modifier
   * @returns True if current token is 'export'
   */
  protected isExportModifier(): boolean {
    return this.check(TokenType.EXPORT);
  }

  /**
   * Checks if current token is 'let' or 'const'
   *
   * @protected
   * @return {*}  {boolean}
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
   * @returns
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
