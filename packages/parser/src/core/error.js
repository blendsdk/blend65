/**
 * Parse Error Handling for Blend65
 *
 * Comprehensive error handling system with recovery strategies.
 * Adapted from blend-lang for Blend65 multi-target 6502 language.
 */
import { TokenType } from '@blend65/lexer';
/**
 * Base class for all parse errors
 */
export class ParseError extends Error {
    token;
    position;
    constructor(message, token) {
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
    expected;
    actual;
    constructor(token, expected) {
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
    constructor(token, expected) {
        super(`Unexpected end of input, expected ${expected}`, token);
        this.name = 'UnexpectedEOFError';
    }
}
/**
 * Invalid syntax error
 */
export class InvalidSyntaxError extends ParseError {
    constructor(message, token) {
        super(`Invalid syntax: ${message}`, token);
        this.name = 'InvalidSyntaxError';
    }
}
/**
 * Synchronization-based error recovery
 * Skips tokens until finding a synchronization point
 */
export class SynchronizationRecovery {
    syncTokens = new Set([
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
        TokenType.EOF,
    ]);
    recover(_error, context) {
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
    addSyncTokens(...tokens) {
        tokens.forEach(token => this.syncTokens.add(token));
    }
}
/**
 * Panic mode recovery
 * Discards tokens until finding a known good state
 */
export class PanicModeRecovery {
    panicTokens;
    constructor(panicTokens = []) {
        this.panicTokens = new Set(panicTokens);
    }
    recover(_error, context) {
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
    errors = [];
    maxErrors;
    hasRecoveredErrors = false;
    constructor(maxErrors = 100) {
        this.maxErrors = maxErrors;
    }
    /**
     * Report a parse error
     */
    report(error, recovered = false, _recoveryPoint) {
        this.errors.push(error);
        this.hasRecoveredErrors = this.hasRecoveredErrors || recovered;
        if (this.errors.length >= this.maxErrors) {
            throw new Error(`Too many parse errors (max: ${this.maxErrors})`);
        }
    }
    /**
     * Check if there are any errors
     */
    hasErrors() {
        return this.errors.length > 0;
    }
    /**
     * Get all reported errors
     */
    getErrors() {
        return [...this.errors];
    }
    /**
     * Get error count
     */
    getErrorCount() {
        return this.errors.length;
    }
    /**
     * Clear all errors
     */
    clear() {
        this.errors = [];
        this.hasRecoveredErrors = false;
    }
    /**
     * Format errors for display
     */
    formatErrors() {
        return this.errors.map(error => this.formatError(error));
    }
    /**
     * Format a single error for display
     */
    formatError(error) {
        const { line, column } = error.position;
        return `${error.name} at line ${line}, column ${column}: ${error.message}`;
    }
    /**
     * Check if there were any recovered errors
     */
    hadRecoveredErrors() {
        return this.hasRecoveredErrors;
    }
}
/**
 * Error severity levels
 */
export var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["ERROR"] = "error";
    ErrorSeverity["WARNING"] = "warning";
    ErrorSeverity["INFO"] = "info";
})(ErrorSeverity || (ErrorSeverity = {}));
//# sourceMappingURL=error.js.map