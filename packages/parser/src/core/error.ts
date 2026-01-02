/**
 * Parse Error Handling for Blend65
 *
 * Comprehensive error handling system with recovery strategies.
 * Adapted from blend-lang for Blend65 multi-target 6502 language.
 */

import { Token, SourcePosition, TokenType } from '@blend65/lexer';

/**
 * Base class for all parse errors
 */
export class ParseError extends Error {
  public readonly token: Token;
  public readonly position: SourcePosition;

  constructor(message: string, token: Token) {
    super(message);
    this.name = 'ParseError';
    this.token = token;
    this.position = token.start;
  }
}

/**
 * Unexpected token error
 */
export class UnexpectedTokenError extends ParseError {
  public readonly expected: string;
  public readonly actual: string;

  constructor(token: Token, expected: string) {
    const actual = token.type === TokenType.EOF ? 'end of file' : `'${token.value}'`;
    super(`Expected ${expected} but found ${actual}`, token);
    this.name = 'UnexpectedTokenError';
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Unexpected end of input error
 */
export class UnexpectedEOFError extends ParseError {
  constructor(token: Token, expected: string) {
    super(`Unexpected end of input, expected ${expected}`, token);
    this.name = 'UnexpectedEOFError';
  }
}

/**
 * Invalid syntax error
 */
export class InvalidSyntaxError extends ParseError {
  constructor(message: string, token: Token) {
    super(`Invalid syntax: ${message}`, token);
    this.name = 'InvalidSyntaxError';
  }
}

/**
 * Context information for error recovery
 */
export interface RecoveryContext {
  position: number;
  tokens: Token[];
}

/**
 * Error recovery strategy interface
 */
export interface ErrorRecoveryStrategy {
  recover(error: ParseError, context: RecoveryContext): boolean;
}

/**
 * Synchronization-based error recovery
 * Skips tokens until finding a synchronization point
 */
export class SynchronizationRecovery implements ErrorRecoveryStrategy {
  private syncTokens: Set<TokenType> = new Set([
    TokenType.NEWLINE,
    TokenType.SEMICOLON,
    TokenType.MODULE,
    TokenType.IMPORT,
    TokenType.EXPORT,
    TokenType.FUNCTION,
    TokenType.VAR,
    TokenType.TYPE,
    TokenType.IF,
    TokenType.WHILE,
    TokenType.FOR,
    TokenType.MATCH,
    TokenType.RETURN,
    TokenType.END,
    TokenType.EOF
  ]);

  recover(error: ParseError, context: RecoveryContext): boolean {
    const { tokens, position } = context;

    // Find the next synchronization token
    for (let i = position; i < tokens.length; i++) {
      const token = tokens[i];
      if (this.syncTokens.has(token.type)) {
        return true; // Found sync point
      }
    }

    return false; // No sync point found
  }

  /**
   * Add custom synchronization tokens
   */
  addSyncTokens(...tokens: TokenType[]): void {
    tokens.forEach(token => this.syncTokens.add(token));
  }
}

/**
 * Panic mode recovery
 * Discards tokens until finding a known good state
 */
export class PanicModeRecovery implements ErrorRecoveryStrategy {
  private panicTokens: Set<TokenType>;

  constructor(panicTokens: TokenType[] = []) {
    this.panicTokens = new Set(panicTokens);
  }

  recover(error: ParseError, context: RecoveryContext): boolean {
    const { tokens, position } = context;

    // Skip tokens until we find a panic recovery token
    for (let i = position; i < tokens.length; i++) {
      const token = tokens[i];
      if (this.panicTokens.has(token.type)) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Error reporter that collects and manages parse errors
 */
export class ErrorReporter {
  private errors: ParseError[] = [];
  private maxErrors: number;
  private hasRecoveredErrors: boolean = false;

  constructor(maxErrors: number = 100) {
    this.maxErrors = maxErrors;
  }

  /**
   * Report a parse error
   */
  report(error: ParseError, recovered: boolean = false, recoveryPoint?: Token): void {
    this.errors.push(error);
    this.hasRecoveredErrors = this.hasRecoveredErrors || recovered;

    if (this.errors.length >= this.maxErrors) {
      throw new Error(`Too many parse errors (max: ${this.maxErrors})`);
    }
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Get all reported errors
   */
  getErrors(): ParseError[] {
    return [...this.errors];
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.errors.length;
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.errors = [];
    this.hasRecoveredErrors = false;
  }

  /**
   * Format errors for display
   */
  formatErrors(): string[] {
    return this.errors.map(error => this.formatError(error));
  }

  /**
   * Format a single error for display
   */
  private formatError(error: ParseError): string {
    const { line, column } = error.position;
    return `${error.name} at line ${line}, column ${column}: ${error.message}`;
  }

  /**
   * Check if there were any recovered errors
   */
  hadRecoveredErrors(): boolean {
    return this.hasRecoveredErrors;
  }
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * Enhanced error information
 */
export interface ErrorInfo {
  error: ParseError;
  severity: ErrorSeverity;
  recovered: boolean;
  recoveryPoint?: Token;
  context?: string;
}
