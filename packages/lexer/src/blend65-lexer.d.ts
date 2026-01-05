/**
 * Blend65 Lexer Implementation
 * A lexical analyzer for the Blend65 multi-target 6502 language
 */
import { Token } from './types.js';
export interface LexerOptions {
    skipComments?: boolean;
    skipWhitespace?: boolean;
}
export declare class Blend65Lexer {
    private source;
    private position;
    private line;
    private column;
    private options;
    constructor(source: string, options?: LexerOptions);
    /**
     * Tokenize the entire source and return all tokens
     */
    tokenize(): Token[];
    /**
     * Get the next token from the source
     */
    nextToken(): Token;
    private readNumber;
    private readString;
    private readIdentifierOrKeyword;
    private getKeywordTokenType;
    private readLineComment;
    private readBlockComment;
    private skipWhitespace;
    private getCurrentChar;
    private peek;
    private peekAt;
    private advance;
    private isAtEnd;
    private isDigit;
    private isHexDigit;
    private isBinaryDigit;
    private isAlpha;
    private isAlphaNumeric;
    private isWhitespace;
    private getCurrentPosition;
    private createToken;
    private createSingleCharToken;
    private createTwoCharToken;
}
//# sourceMappingURL=blend65-lexer.d.ts.map