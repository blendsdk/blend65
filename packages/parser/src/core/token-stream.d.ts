/**
 * Token Stream for Blend65 Parser
 *
 * Provides token navigation, lookahead, and snapshot capabilities.
 * Adapted from blend-lang for Blend65 multi-target 6502 language.
 */
import { Token, TokenType } from '@blend65/lexer';
/**
 * Token stream for parser navigation
 */
export declare class TokenStream {
    private tokens;
    private position;
    private snapshots;
    constructor(tokens: Token[]);
    /**
     * Check if we're at the end of the token stream
     */
    isAtEnd(): boolean;
    /**
     * Get the current position in the token stream
     */
    getPosition(): number;
    /**
     * Set the position in the token stream
     */
    setPosition(position: number): void;
    /**
     * Get all tokens
     */
    getTokens(): Token[];
    /**
     * Peek at the current token or look ahead
     */
    peek(offset?: number): Token;
    /**
     * Get the previous token
     */
    previous(offset?: number): Token;
    /**
     * Advance to the next token and return the current one
     */
    advance(): Token;
    /**
     * Advance by multiple tokens
     */
    advanceBy(count: number): void;
    /**
     * Check if the current token matches any of the given types
     */
    check(...types: TokenType[]): boolean;
    /**
     * Check if the current token matches a specific value/lexeme
     */
    checkLexeme(lexeme: string): boolean;
    /**
     * Check if the current token matches any of the given lexemes
     */
    checkLexemes(...lexemes: string[]): boolean;
    /**
     * Match and consume a token if it matches any of the given types
     */
    match(...types: TokenType[]): boolean;
    /**
     * Match and consume a token if it matches a specific lexeme
     */
    matchLexeme(lexeme: string): boolean;
    /**
     * Match and consume a token if it matches any of the given lexemes
     */
    matchLexemes(...lexemes: string[]): boolean;
    /**
     * Skip tokens of specific types
     */
    skip(...types: TokenType[]): void;
    /**
     * Skip tokens with specific lexemes
     */
    skipLexemes(...lexemes: string[]): void;
    /**
     * Skip whitespace tokens (newlines, comments, etc.)
     */
    skipWhitespace(): void;
    /**
     * Look ahead to find a token matching a predicate
     */
    lookAhead(predicate: (token: Token) => boolean, maxLookAhead?: number): number;
    /**
     * Look ahead to find a specific token type
     */
    lookAheadFor(type: TokenType, maxLookAhead?: number): number;
    /**
     * Look ahead to find a specific lexeme
     */
    lookAheadForLexeme(lexeme: string, maxLookAhead?: number): number;
    /**
     * Synchronize to a specific token type (for error recovery)
     */
    synchronize(...types: TokenType[]): void;
    /**
     * Synchronize to a specific lexeme (for error recovery)
     */
    synchronizeLexeme(...lexemes: string[]): void;
    /**
     * Synchronize to statement boundaries for error recovery
     */
    synchronizeToStatement(): void;
    /**
     * Create a snapshot of the current position
     */
    snapshot(): number;
    /**
     * Restore to a previous snapshot
     */
    restore(snapshotId: number): void;
    /**
     * Release a snapshot (cleanup)
     */
    releaseSnapshot(snapshotId: number): void;
    /**
     * Clear all snapshots
     */
    clearSnapshots(): void;
    /**
     * Get a slice of tokens from the current position
     */
    slice(length: number): Token[];
    /**
     * Check if there are tokens remaining
     */
    hasTokens(): boolean;
    /**
     * Get the remaining token count
     */
    remainingCount(): number;
    /**
     * Reset the stream to the beginning
     */
    reset(): void;
    /**
     * Clone the token stream
     */
    clone(): TokenStream;
    /**
     * Get debug information about the current state
     */
    getDebugInfo(): string;
    /**
     * Get a formatted view of tokens around the current position
     */
    getContextView(radius?: number): string;
}
//# sourceMappingURL=token-stream.d.ts.map