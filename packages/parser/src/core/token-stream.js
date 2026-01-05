/**
 * Token Stream for Blend65 Parser
 *
 * Provides token navigation, lookahead, and snapshot capabilities.
 * Adapted from blend-lang for Blend65 multi-target 6502 language.
 */
import { TokenType } from '@blend65/lexer';
/**
 * Token stream for parser navigation
 */
export class TokenStream {
    tokens;
    position = 0;
    snapshots = [];
    constructor(tokens) {
        this.tokens = tokens;
    }
    // ============================================================================
    // Position Management
    // ============================================================================
    /**
     * Check if we're at the end of the token stream
     */
    isAtEnd() {
        return this.position >= this.tokens.length || this.peek().type === TokenType.EOF;
    }
    /**
     * Get the current position in the token stream
     */
    getPosition() {
        return this.position;
    }
    /**
     * Set the position in the token stream
     */
    setPosition(position) {
        this.position = Math.max(0, Math.min(position, this.tokens.length - 1));
    }
    /**
     * Get all tokens
     */
    getTokens() {
        return this.tokens;
    }
    // ============================================================================
    // Token Access
    // ============================================================================
    /**
     * Peek at the current token or look ahead
     */
    peek(offset = 0) {
        const pos = this.position + offset;
        if (pos < 0 || pos >= this.tokens.length) {
            // Return EOF token if out of bounds
            return {
                type: TokenType.EOF,
                value: '',
                start: { line: 0, column: 0, offset: 0 },
                end: { line: 0, column: 0, offset: 0 },
            };
        }
        return this.tokens[pos];
    }
    /**
     * Get the previous token
     */
    previous(offset = 1) {
        return this.peek(-offset);
    }
    /**
     * Advance to the next token and return the current one
     */
    advance() {
        if (!this.isAtEnd()) {
            const token = this.peek();
            this.position++;
            return token;
        }
        return this.peek(); // Return EOF
    }
    /**
     * Advance by multiple tokens
     */
    advanceBy(count) {
        this.position = Math.min(this.position + count, this.tokens.length);
    }
    // ============================================================================
    // Token Matching
    // ============================================================================
    /**
     * Check if the current token matches any of the given types
     */
    check(...types) {
        if (this.isAtEnd())
            return false;
        const currentType = this.peek().type;
        return types.includes(currentType);
    }
    /**
     * Check if the current token matches a specific value/lexeme
     */
    checkLexeme(lexeme) {
        if (this.isAtEnd())
            return false;
        return this.peek().value === lexeme;
    }
    /**
     * Check if the current token matches any of the given lexemes
     */
    checkLexemes(...lexemes) {
        if (this.isAtEnd())
            return false;
        const currentValue = this.peek().value;
        return lexemes.includes(currentValue);
    }
    /**
     * Match and consume a token if it matches any of the given types
     */
    match(...types) {
        if (this.check(...types)) {
            this.advance();
            return true;
        }
        return false;
    }
    /**
     * Match and consume a token if it matches a specific lexeme
     */
    matchLexeme(lexeme) {
        if (this.checkLexeme(lexeme)) {
            this.advance();
            return true;
        }
        return false;
    }
    /**
     * Match and consume a token if it matches any of the given lexemes
     */
    matchLexemes(...lexemes) {
        if (this.checkLexemes(...lexemes)) {
            this.advance();
            return true;
        }
        return false;
    }
    // ============================================================================
    // Skip Operations
    // ============================================================================
    /**
     * Skip tokens of specific types
     */
    skip(...types) {
        while (!this.isAtEnd() && this.check(...types)) {
            this.advance();
        }
    }
    /**
     * Skip tokens with specific lexemes
     */
    skipLexemes(...lexemes) {
        while (!this.isAtEnd() && this.checkLexemes(...lexemes)) {
            this.advance();
        }
    }
    /**
     * Skip whitespace tokens (newlines, comments, etc.)
     */
    skipWhitespace() {
        this.skip(TokenType.NEWLINE, TokenType.LINE_COMMENT, TokenType.BLOCK_COMMENT);
    }
    // ============================================================================
    // Lookahead
    // ============================================================================
    /**
     * Look ahead to find a token matching a predicate
     */
    lookAhead(predicate, maxLookAhead = 10) {
        for (let i = 0; i < maxLookAhead && !this.isAtEnd(); i++) {
            const token = this.peek(i);
            if (token.type === TokenType.EOF)
                break;
            if (predicate(token)) {
                return i;
            }
        }
        return -1; // Not found
    }
    /**
     * Look ahead to find a specific token type
     */
    lookAheadFor(type, maxLookAhead = 10) {
        return this.lookAhead(token => token.type === type, maxLookAhead);
    }
    /**
     * Look ahead to find a specific lexeme
     */
    lookAheadForLexeme(lexeme, maxLookAhead = 10) {
        return this.lookAhead(token => token.value === lexeme, maxLookAhead);
    }
    // ============================================================================
    // Synchronization (Error Recovery)
    // ============================================================================
    /**
     * Synchronize to a specific token type (for error recovery)
     */
    synchronize(...types) {
        while (!this.isAtEnd()) {
            if (this.check(...types)) {
                break;
            }
            this.advance();
        }
    }
    /**
     * Synchronize to a specific lexeme (for error recovery)
     */
    synchronizeLexeme(...lexemes) {
        while (!this.isAtEnd()) {
            if (this.checkLexemes(...lexemes)) {
                break;
            }
            this.advance();
        }
    }
    /**
     * Synchronize to statement boundaries for error recovery
     */
    synchronizeToStatement() {
        this.synchronize(TokenType.NEWLINE, TokenType.SEMICOLON, TokenType.FUNCTION, TokenType.VAR, TokenType.IF, TokenType.WHILE, TokenType.FOR, TokenType.MATCH, TokenType.RETURN, TokenType.END, TokenType.EOF);
    }
    // ============================================================================
    // Snapshot Operations
    // ============================================================================
    /**
     * Create a snapshot of the current position
     */
    snapshot() {
        const snapshotId = this.snapshots.length;
        this.snapshots.push(this.position);
        return snapshotId;
    }
    /**
     * Restore to a previous snapshot
     */
    restore(snapshotId) {
        if (snapshotId >= 0 && snapshotId < this.snapshots.length) {
            const savedPosition = this.snapshots[snapshotId];
            if (savedPosition !== undefined && savedPosition !== -1) {
                // Check if valid and not released
                this.position = savedPosition;
            }
        }
    }
    /**
     * Release a snapshot (cleanup)
     */
    releaseSnapshot(snapshotId) {
        if (snapshotId >= 0 && snapshotId < this.snapshots.length) {
            this.snapshots[snapshotId] = -1; // Mark as released
        }
    }
    /**
     * Clear all snapshots
     */
    clearSnapshots() {
        this.snapshots = [];
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Get a slice of tokens from the current position
     */
    slice(length) {
        const end = Math.min(this.position + length, this.tokens.length);
        return this.tokens.slice(this.position, end);
    }
    /**
     * Check if there are tokens remaining
     */
    hasTokens() {
        return !this.isAtEnd();
    }
    /**
     * Get the remaining token count
     */
    remainingCount() {
        return Math.max(0, this.tokens.length - this.position);
    }
    /**
     * Reset the stream to the beginning
     */
    reset() {
        this.position = 0;
        this.clearSnapshots();
    }
    /**
     * Clone the token stream
     */
    clone() {
        const cloned = new TokenStream([...this.tokens]);
        cloned.position = this.position;
        return cloned;
    }
    // ============================================================================
    // Debug Utilities
    // ============================================================================
    /**
     * Get debug information about the current state
     */
    getDebugInfo() {
        const current = this.peek();
        const previous = this.position > 0 ? this.previous() : null;
        const next = !this.isAtEnd() ? this.peek(1) : null;
        return (`Position: ${this.position}/${this.tokens.length}, ` +
            `Previous: ${previous?.value || 'N/A'}, ` +
            `Current: ${current.value}, ` +
            `Next: ${next?.value || 'N/A'}`);
    }
    /**
     * Get a formatted view of tokens around the current position
     */
    getContextView(radius = 2) {
        const start = Math.max(0, this.position - radius);
        const end = Math.min(this.tokens.length, this.position + radius + 1);
        const context = this.tokens.slice(start, end).map((token, index) => {
            const globalIndex = start + index;
            const marker = globalIndex === this.position ? ' >>> ' : '     ';
            return `${marker}${globalIndex}: ${token.type} '${token.value}'`;
        });
        return context.join('\n');
    }
}
//# sourceMappingURL=token-stream.js.map