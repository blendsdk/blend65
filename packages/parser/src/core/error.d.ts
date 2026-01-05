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
export declare class ParseError extends Error {
    readonly token: Token;
    readonly position: SourcePosition;
    constructor(message: string, token: Token);
}
/**
 * Unexpected token error
 */
export declare class UnexpectedTokenError extends ParseError {
    readonly expected: string;
    readonly actual: string;
    constructor(token: Token, expected: string);
}
/**
 * Unexpected end of input error
 */
export declare class UnexpectedEOFError extends ParseError {
    constructor(token: Token, expected: string);
}
/**
 * Invalid syntax error
 */
export declare class InvalidSyntaxError extends ParseError {
    constructor(message: string, token: Token);
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
export declare class SynchronizationRecovery implements ErrorRecoveryStrategy {
    private syncTokens;
    recover(_error: ParseError, context: RecoveryContext): boolean;
    /**
     * Add custom synchronization tokens
     */
    addSyncTokens(...tokens: TokenType[]): void;
}
/**
 * Panic mode recovery
 * Discards tokens until finding a known good state
 */
export declare class PanicModeRecovery implements ErrorRecoveryStrategy {
    private panicTokens;
    constructor(panicTokens?: TokenType[]);
    recover(_error: ParseError, context: RecoveryContext): boolean;
}
/**
 * Error reporter that collects and manages parse errors
 */
export declare class ErrorReporter {
    private errors;
    private maxErrors;
    private hasRecoveredErrors;
    constructor(maxErrors?: number);
    /**
     * Report a parse error
     */
    report(error: ParseError, recovered?: boolean, _recoveryPoint?: Token): void;
    /**
     * Check if there are any errors
     */
    hasErrors(): boolean;
    /**
     * Get all reported errors
     */
    getErrors(): ParseError[];
    /**
     * Get error count
     */
    getErrorCount(): number;
    /**
     * Clear all errors
     */
    clear(): void;
    /**
     * Format errors for display
     */
    formatErrors(): string[];
    /**
     * Format a single error for display
     */
    private formatError;
    /**
     * Check if there were any recovered errors
     */
    hadRecoveredErrors(): boolean;
}
/**
 * Error severity levels
 */
export declare enum ErrorSeverity {
    ERROR = "error",
    WARNING = "warning",
    INFO = "info"
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
//# sourceMappingURL=error.d.ts.map