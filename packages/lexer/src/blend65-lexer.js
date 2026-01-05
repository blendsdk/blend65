/**
 * Blend65 Lexer Implementation
 * A lexical analyzer for the Blend65 multi-target 6502 language
 */
import { TokenType, KEYWORDS } from './types.js';
export class Blend65Lexer {
    source;
    position = 0;
    line = 1;
    column = 1;
    options;
    constructor(source, options = {}) {
        this.source = source;
        this.options = {
            skipComments: true,
            skipWhitespace: true,
            ...options,
        };
    }
    /**
     * Tokenize the entire source and return all tokens
     */
    tokenize() {
        const tokens = [];
        let token;
        do {
            token = this.nextToken();
            tokens.push(token);
        } while (token.type !== TokenType.EOF);
        return tokens;
    }
    /**
     * Get the next token from the source
     */
    nextToken() {
        this.skipWhitespace();
        const start = this.getCurrentPosition();
        // End of file
        if (this.isAtEnd()) {
            return this.createToken(TokenType.EOF, '', start, start);
        }
        const char = this.getCurrentChar();
        // Skip line comments
        if (char === '/' && this.peek() === '/') {
            return this.readLineComment();
        }
        // Skip block comments
        if (char === '/' && this.peek() === '*') {
            return this.readBlockComment();
        }
        // Newlines (significant in Blend65 for statement separation)
        if (char === '\n') {
            const token = this.createToken(TokenType.NEWLINE, char, start);
            this.advance();
            this.line++;
            this.column = 1;
            return token;
        }
        // Numbers (including hex and binary)
        if (this.isDigit(char) || (char === '$' && this.isHexDigit(this.peek()))) {
            return this.readNumber();
        }
        // Strings
        if (char === '"' || char === "'") {
            return this.readString(char);
        }
        // Identifiers and keywords
        if (this.isAlpha(char) || char === '_') {
            return this.readIdentifierOrKeyword();
        }
        // Two-character operators
        const twoChar = char + this.peek();
        switch (twoChar) {
            case '==':
                return this.createTwoCharToken(TokenType.EQUAL);
            case '!=':
                return this.createTwoCharToken(TokenType.NOT_EQUAL);
            case '<=':
                return this.createTwoCharToken(TokenType.LESS_EQUAL);
            case '>=':
                return this.createTwoCharToken(TokenType.GREATER_EQUAL);
            case '<<':
                return this.createTwoCharToken(TokenType.LEFT_SHIFT);
            case '>>':
                return this.createTwoCharToken(TokenType.RIGHT_SHIFT);
            case '+=':
                return this.createTwoCharToken(TokenType.PLUS_ASSIGN);
            case '-=':
                return this.createTwoCharToken(TokenType.MINUS_ASSIGN);
            case '*=':
                return this.createTwoCharToken(TokenType.MULTIPLY_ASSIGN);
            case '/=':
                return this.createTwoCharToken(TokenType.DIVIDE_ASSIGN);
            case '%=':
                return this.createTwoCharToken(TokenType.MODULO_ASSIGN);
            case '&=':
                return this.createTwoCharToken(TokenType.BITWISE_AND_ASSIGN);
            case '|=':
                return this.createTwoCharToken(TokenType.BITWISE_OR_ASSIGN);
            case '^=':
                return this.createTwoCharToken(TokenType.BITWISE_XOR_ASSIGN);
            case '<<=': {
                // Handle three-character operator
                const token = this.createToken(TokenType.LEFT_SHIFT_ASSIGN, '<<=' + this.peekAt(2), start);
                this.advance(3);
                return token;
            }
            case '>>=': {
                // Handle three-character operator
                const token = this.createToken(TokenType.RIGHT_SHIFT_ASSIGN, '>>=' + this.peekAt(2), start);
                this.advance(3);
                return token;
            }
        }
        // Single-character tokens
        switch (char) {
            case '+':
                return this.createSingleCharToken(TokenType.PLUS);
            case '-':
                return this.createSingleCharToken(TokenType.MINUS);
            case '*':
                return this.createSingleCharToken(TokenType.MULTIPLY);
            case '/':
                return this.createSingleCharToken(TokenType.DIVIDE);
            case '%':
                return this.createSingleCharToken(TokenType.MODULO);
            case '=':
                return this.createSingleCharToken(TokenType.ASSIGN);
            case '<':
                return this.createSingleCharToken(TokenType.LESS_THAN);
            case '>':
                return this.createSingleCharToken(TokenType.GREATER_THAN);
            case '&':
                return this.createSingleCharToken(TokenType.BITWISE_AND);
            case '|':
                return this.createSingleCharToken(TokenType.BITWISE_OR);
            case '^':
                return this.createSingleCharToken(TokenType.BITWISE_XOR);
            case '~':
                return this.createSingleCharToken(TokenType.BITWISE_NOT);
            case '(':
                return this.createSingleCharToken(TokenType.LEFT_PAREN);
            case ')':
                return this.createSingleCharToken(TokenType.RIGHT_PAREN);
            case '[':
                return this.createSingleCharToken(TokenType.LEFT_BRACKET);
            case ']':
                return this.createSingleCharToken(TokenType.RIGHT_BRACKET);
            case '{':
                return this.createSingleCharToken(TokenType.LEFT_BRACE);
            case '}':
                return this.createSingleCharToken(TokenType.RIGHT_BRACE);
            case ',':
                return this.createSingleCharToken(TokenType.COMMA);
            case ';':
                return this.createSingleCharToken(TokenType.SEMICOLON);
            case ':':
                return this.createSingleCharToken(TokenType.COLON);
            case '.':
                return this.createSingleCharToken(TokenType.DOT);
        }
        // Unknown character
        this.advance();
        throw new Error(`Unexpected character '${char}' at line ${start.line}, column ${start.column}`);
    }
    readNumber() {
        const start = this.getCurrentPosition();
        let value = '';
        // Handle hex numbers starting with $
        if (this.getCurrentChar() === '$') {
            value += '$';
            this.advance();
            while (this.isHexDigit(this.getCurrentChar())) {
                value += this.getCurrentChar();
                this.advance();
            }
            if (value === '$') {
                throw new Error(`Invalid hex number at line ${start.line}, column ${start.column}`);
            }
            return this.createToken(TokenType.NUMBER, value, start);
        }
        // Handle hex numbers starting with 0x
        if (this.getCurrentChar() === '0' && this.peek() === 'x') {
            value += '0x';
            this.advance(2);
            while (this.isHexDigit(this.getCurrentChar())) {
                value += this.getCurrentChar();
                this.advance();
            }
            if (value === '0x') {
                throw new Error(`Invalid hex number at line ${start.line}, column ${start.column}`);
            }
            return this.createToken(TokenType.NUMBER, value, start);
        }
        // Handle binary numbers starting with 0b
        if (this.getCurrentChar() === '0' && this.peek() === 'b') {
            value += '0b';
            this.advance(2);
            while (this.isBinaryDigit(this.getCurrentChar())) {
                value += this.getCurrentChar();
                this.advance();
            }
            if (value === '0b') {
                throw new Error(`Invalid binary number at line ${start.line}, column ${start.column}`);
            }
            return this.createToken(TokenType.NUMBER, value, start);
        }
        // Handle decimal numbers
        while (this.isDigit(this.getCurrentChar())) {
            value += this.getCurrentChar();
            this.advance();
        }
        return this.createToken(TokenType.NUMBER, value, start);
    }
    readString(quote) {
        const start = this.getCurrentPosition();
        let value = '';
        this.advance(); // Skip opening quote
        while (!this.isAtEnd() && this.getCurrentChar() !== quote) {
            const char = this.getCurrentChar();
            if (char === '\\') {
                this.advance();
                if (this.isAtEnd()) {
                    throw new Error(`Unterminated string at line ${start.line}, column ${start.column}`);
                }
                const escaped = this.getCurrentChar();
                switch (escaped) {
                    case 'n':
                        value += '\n';
                        break;
                    case 't':
                        value += '\t';
                        break;
                    case 'r':
                        value += '\r';
                        break;
                    case '\\':
                        value += '\\';
                        break;
                    case '"':
                        value += '"';
                        break;
                    case "'":
                        value += "'";
                        break;
                    default:
                        value += escaped;
                        break;
                }
            }
            else if (char === '\n') {
                this.line++;
                this.column = 1;
                value += char;
            }
            else {
                value += char;
            }
            this.advance();
        }
        if (this.isAtEnd()) {
            throw new Error(`Unterminated string at line ${start.line}, column ${start.column}`);
        }
        this.advance(); // Skip closing quote
        return this.createToken(TokenType.STRING, value, start);
    }
    readIdentifierOrKeyword() {
        const start = this.getCurrentPosition();
        let value = '';
        while (this.isAlphaNumeric(this.getCurrentChar())) {
            value += this.getCurrentChar();
            this.advance();
        }
        // Check for boolean literals
        if (value === 'true' || value === 'false') {
            return this.createToken(TokenType.BOOLEAN, value, start);
        }
        // Check if it's a keyword
        const type = KEYWORDS.has(value) ? this.getKeywordTokenType(value) : TokenType.IDENTIFIER;
        return this.createToken(type, value, start);
    }
    getKeywordTokenType(keyword) {
        switch (keyword) {
            case 'module':
                return TokenType.MODULE;
            case 'import':
                return TokenType.IMPORT;
            case 'export':
                return TokenType.EXPORT;
            case 'from':
                return TokenType.FROM;
            case 'function':
                return TokenType.FUNCTION;
            case 'end':
                return TokenType.END;
            case 'return':
                return TokenType.RETURN;
            case 'if':
                return TokenType.IF;
            case 'then':
                return TokenType.THEN;
            case 'else':
                return TokenType.ELSE;
            case 'while':
                return TokenType.WHILE;
            case 'for':
                return TokenType.FOR;
            case 'to':
                return TokenType.TO;
            case 'next':
                return TokenType.NEXT;
            case 'match':
                return TokenType.MATCH;
            case 'case':
                return TokenType.CASE;
            case 'break':
                return TokenType.BREAK;
            case 'continue':
                return TokenType.CONTINUE;
            case 'default':
                return TokenType.DEFAULT;
            case 'var':
                return TokenType.VAR;
            case 'type':
                return TokenType.TYPE;
            case 'extends':
                return TokenType.EXTENDS;
            case 'enum':
                return TokenType.ENUM;
            case 'zp':
                return TokenType.ZP;
            case 'ram':
                return TokenType.RAM;
            case 'data':
                return TokenType.DATA;
            case 'const':
                return TokenType.CONST;
            case 'io':
                return TokenType.IO;
            case 'byte':
                return TokenType.BYTE;
            case 'word':
                return TokenType.WORD;
            case 'void':
                return TokenType.VOID;
            case 'callback':
                return TokenType.CALLBACK; // NEW: Add callback keyword mapping
            case 'and':
                return TokenType.AND;
            case 'or':
                return TokenType.OR;
            case 'not':
                return TokenType.NOT;
            default:
                return TokenType.IDENTIFIER;
        }
    }
    readLineComment() {
        const start = this.getCurrentPosition();
        let value = '';
        while (!this.isAtEnd() && this.getCurrentChar() !== '\n') {
            value += this.getCurrentChar();
            this.advance();
        }
        const token = this.createToken(TokenType.LINE_COMMENT, value, start);
        if (this.options.skipComments) {
            return this.nextToken();
        }
        return token;
    }
    readBlockComment() {
        const start = this.getCurrentPosition();
        let value = '';
        this.advance(2); // Skip /*
        value += '/*';
        while (!this.isAtEnd()) {
            if (this.getCurrentChar() === '*' && this.peek() === '/') {
                value += '*/';
                this.advance(2);
                break;
            }
            if (this.getCurrentChar() === '\n') {
                this.line++;
                this.column = 1;
            }
            value += this.getCurrentChar();
            this.advance();
        }
        if (!value.endsWith('*/')) {
            throw new Error(`Unterminated block comment at line ${start.line}, column ${start.column}`);
        }
        const token = this.createToken(TokenType.BLOCK_COMMENT, value, start);
        if (this.options.skipComments) {
            return this.nextToken();
        }
        return token;
    }
    // Helper methods
    skipWhitespace() {
        while (!this.isAtEnd() &&
            this.isWhitespace(this.getCurrentChar()) &&
            this.getCurrentChar() !== '\n') {
            this.advance();
        }
    }
    getCurrentChar() {
        if (this.isAtEnd())
            return '\0';
        return this.source[this.position] || '\0';
    }
    peek() {
        return this.peekAt(1);
    }
    peekAt(offset) {
        const pos = this.position + offset;
        if (pos >= this.source.length)
            return '\0';
        return this.source[pos] || '\0';
    }
    advance(count = 1) {
        for (let i = 0; i < count && !this.isAtEnd(); i++) {
            if (this.getCurrentChar() !== '\n') {
                this.column++;
            }
            this.position++;
        }
    }
    isAtEnd() {
        return this.position >= this.source.length;
    }
    isDigit(char) {
        return char >= '0' && char <= '9';
    }
    isHexDigit(char) {
        return this.isDigit(char) || (char >= 'A' && char <= 'F') || (char >= 'a' && char <= 'f');
    }
    isBinaryDigit(char) {
        return char === '0' || char === '1';
    }
    isAlpha(char) {
        return (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') || char === '_';
    }
    isAlphaNumeric(char) {
        return this.isAlpha(char) || this.isDigit(char);
    }
    isWhitespace(char) {
        return char === ' ' || char === '\r' || char === '\t';
    }
    getCurrentPosition() {
        return {
            line: this.line,
            column: this.column,
            offset: this.position,
        };
    }
    createToken(type, value, start, end) {
        return {
            type,
            value,
            start,
            end: end || this.getCurrentPosition(),
        };
    }
    createSingleCharToken(type) {
        const start = this.getCurrentPosition();
        const char = this.getCurrentChar();
        this.advance();
        return this.createToken(type, char, start);
    }
    createTwoCharToken(type) {
        const start = this.getCurrentPosition();
        const value = this.getCurrentChar() + this.peek();
        this.advance(2);
        return this.createToken(type, value, start);
    }
}
//# sourceMappingURL=blend65-lexer.js.map