/**
 * Base Parser
 *
 * Abstract base class for all parsers. Provides common functionality for
 * token navigation, error handling, and AST construction.
 *
 * Adapted for Blend65 from original blend-lang implementation.
 */
import { TokenType } from '@blend65/lexer';
import { ASTNodeFactory } from '@blend65/ast';
import { ErrorReporter, SynchronizationRecovery, UnexpectedTokenError, } from './error.js';
import { TokenStream } from './token-stream.js';
/**
 * Abstract base parser class for Blend65
 */
export class BaseParser {
    stream;
    factory;
    errorReporter;
    recoveryStrategy;
    enableRecovery;
    constructor(tokens, options = {}) {
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
    filterTokens(tokens, options) {
        let filtered = tokens;
        // Filter comments
        if (options.filterComments) {
            filtered = filtered.filter(t => t.type !== TokenType.LINE_COMMENT && t.type !== TokenType.BLOCK_COMMENT);
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
    // -----------------------
    // Token Navigation
    // -----------------------
    /**
     * Check if we're at the end of the token stream
     */
    isAtEnd() {
        return this.stream.isAtEnd();
    }
    /**
     * Get the current token without advancing
     */
    peek(offset = 0) {
        return this.stream.peek(offset);
    }
    /**
     * Get the previous token
     */
    previous(offset = 1) {
        return this.stream.previous(offset);
    }
    /**
     * Advance to the next token and return the current one
     */
    advance() {
        return this.stream.advance();
    }
    /**
     * Check if the current token matches any of the given types
     */
    check(...types) {
        return this.stream.check(...types);
    }
    /**
     * Check if the current token matches a specific lexeme
     */
    checkLexeme(lexeme) {
        return this.stream.checkLexeme(lexeme);
    }
    /**
     * Check if the current token matches any of the given lexemes
     */
    checkLexemes(...lexemes) {
        return this.stream.checkLexemes(...lexemes);
    }
    /**
     * Match and consume a token if it matches any of the given types
     */
    match(...types) {
        return this.stream.match(...types);
    }
    /**
     * Match and consume a token if it matches a specific lexeme
     */
    matchLexeme(lexeme) {
        return this.stream.matchLexeme(lexeme);
    }
    /**
     * Match and consume a token if it matches any of the given lexemes
     */
    matchLexemes(...lexemes) {
        return this.stream.matchLexemes(...lexemes);
    }
    /**
     * Consume a token of the expected type or throw an error
     */
    consume(type, errorMessage) {
        if (this.check(type)) {
            return this.advance();
        }
        const err = new UnexpectedTokenError(this.peek(), errorMessage || TokenType[type] || String(type));
        this.reportError(err);
        throw err;
    }
    /**
     * Consume a token with the expected lexeme or throw an error
     */
    consumeLexeme(lexeme, errorMessage) {
        if (this.checkLexeme(lexeme)) {
            return this.advance();
        }
        const err = new UnexpectedTokenError(this.peek(), errorMessage || lexeme);
        this.reportError(err);
        throw err;
    }
    /**
     * Skip tokens of specific types
     */
    skip(...types) {
        this.stream.skip(...types);
    }
    /**
     * Skip tokens with specific lexemes
     */
    skipLexemes(...lexemes) {
        this.stream.skipLexemes(...lexemes);
    }
    /**
     * Look ahead to find a token matching a predicate
     */
    lookAhead(predicate, maxLookAhead = 10) {
        return this.stream.lookAhead(predicate, maxLookAhead);
    }
    // -----------------------
    // Error Handling
    // -----------------------
    /**
     * Report a parse error
     */
    reportError(error) {
        this.errorReporter.report(error);
        if (this.enableRecovery) {
            this.recover(error);
        }
        else {
            throw error;
        }
    }
    /**
     * Attempt to recover from an error
     */
    recover(error) {
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
    synchronize(...types) {
        this.stream.synchronize(...types);
    }
    /**
     * Synchronize to a specific lexeme (for error recovery)
     */
    synchronizeLexeme(...lexemes) {
        this.stream.synchronizeLexeme(...lexemes);
    }
    /**
     * Get the error reporter
     */
    getErrorReporter() {
        return this.errorReporter;
    }
    /**
     * Check if there are any errors
     */
    hasErrors() {
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
    getFactory() {
        return this.factory;
    }
    /**
     * Create a node with position information from tokens
     */
    createNode(type, startToken, endToken, props = {}) {
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
    snapshot() {
        return this.stream.snapshot();
    }
    /**
     * Restore to a previous snapshot
     */
    restore(snapshot) {
        this.stream.restore(snapshot);
    }
    /**
     * Get the current position in the token stream
     */
    getPosition() {
        return this.stream.getPosition();
    }
    /**
     * Get all tokens
     */
    getTokens() {
        return this.stream.getTokens();
    }
}
//# sourceMappingURL=base-parser.js.map