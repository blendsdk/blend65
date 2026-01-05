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
import { ErrorRecoveryStrategy, ErrorReporter, ParseError } from './error.js';
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
export declare abstract class BaseParser<T extends ASTNode = ASTNode> {
    protected stream: TokenStream;
    protected factory: ASTNodeFactory;
    protected errorReporter: ErrorReporter;
    protected recoveryStrategy: ErrorRecoveryStrategy;
    protected enableRecovery: boolean;
    constructor(tokens: Token[], options?: ParserOptions);
    /**
     * Filter tokens based on options
     */
    private filterTokens;
    /**
     * Parse the tokens into an AST
     * Must be implemented by subclasses
     */
    abstract parse(): T;
    /**
     * Check if we're at the end of the token stream
     */
    protected isAtEnd(): boolean;
    /**
     * Get the current token without advancing
     */
    protected peek(offset?: number): Token;
    /**
     * Get the previous token
     */
    protected previous(offset?: number): Token;
    /**
     * Advance to the next token and return the current one
     */
    protected advance(): Token;
    /**
     * Check if the current token matches any of the given types
     */
    protected check(...types: TokenType[]): boolean;
    /**
     * Check if the current token matches a specific lexeme
     */
    protected checkLexeme(lexeme: string): boolean;
    /**
     * Check if the current token matches any of the given lexemes
     */
    protected checkLexemes(...lexemes: string[]): boolean;
    /**
     * Match and consume a token if it matches any of the given types
     */
    protected match(...types: TokenType[]): boolean;
    /**
     * Match and consume a token if it matches a specific lexeme
     */
    protected matchLexeme(lexeme: string): boolean;
    /**
     * Match and consume a token if it matches any of the given lexemes
     */
    protected matchLexemes(...lexemes: string[]): boolean;
    /**
     * Consume a token of the expected type or throw an error
     */
    protected consume(type: TokenType, errorMessage: string): Token;
    /**
     * Consume a token with the expected lexeme or throw an error
     */
    protected consumeLexeme(lexeme: string, errorMessage: string): Token;
    /**
     * Skip tokens of specific types
     */
    protected skip(...types: TokenType[]): void;
    /**
     * Skip tokens with specific lexemes
     */
    protected skipLexemes(...lexemes: string[]): void;
    /**
     * Look ahead to find a token matching a predicate
     */
    protected lookAhead(predicate: (token: Token) => boolean, maxLookAhead?: number): number;
    /**
     * Report a parse error
     */
    protected reportError(error: ParseError): void;
    /**
     * Attempt to recover from an error
     */
    protected recover(error: ParseError): void;
    /**
     * Synchronize to a specific token type (for error recovery)
     */
    protected synchronize(...types: TokenType[]): void;
    /**
     * Synchronize to a specific lexeme (for error recovery)
     */
    protected synchronizeLexeme(...lexemes: string[]): void;
    /**
     * Get the error reporter
     */
    getErrorReporter(): ErrorReporter;
    /**
     * Check if there are any errors
     */
    hasErrors(): boolean;
    /**
     * Get all errors
     */
    getErrors(): ParseError[];
    /**
     * Get the AST node factory
     */
    protected getFactory(): ASTNodeFactory;
    /**
     * Create a node with position information from tokens
     */
    protected createNode(type: string, startToken: Token, endToken: Token, props?: any): ASTNode;
    /**
     * Create a snapshot of the current parser state
     */
    protected snapshot(): number;
    /**
     * Restore to a previous snapshot
     */
    protected restore(snapshot: number): void;
    /**
     * Get the current position in the token stream
     */
    protected getPosition(): number;
    /**
     * Get all tokens
     */
    protected getTokens(): Token[];
}
//# sourceMappingURL=base-parser.d.ts.map