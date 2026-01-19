/**
 * Blend65 Lexer Implementation
 * A lexical analyzer for the Blend65 multi-target 6502 language
 *
 * The lexer converts source code into a stream of tokens that can be
 * consumed by the parser. It handles all Blend65 syntax including
 * keywords, operators, literals, and comments.
 */

import {
  KEYWORDS,
  SourcePosition,
  Token,
  TokenType,
  eModuleKeyword,
  eFunctionKeyword,
  eControlFlowKeyword,
  eDeclarationKeyword,
  eMutabilityModifier,
  eStorageClass,
  eMemoryMappingKeyword,
  ePrimitiveType,
} from './types.js';

/**
 * Configuration options for the lexer
 */
export interface LexerOptions {
  /** If true, comment tokens will be skipped and not included in output */
  skipComments?: boolean;
  /** If true, whitespace will be skipped (except newlines which are significant) */
  skipWhitespace?: boolean;
}

/**
 * Lexer class for tokenizing Blend65 source code
 *
 * The lexer maintains internal state including position, line, and column
 * numbers for accurate error reporting and source mapping.
 */
export class Lexer {
  /** The source code being tokenized */
  protected source: string;
  /** Current position (character index) in the source */
  protected position: number = 0;
  /** Current line number (1-indexed) */
  protected line: number = 1;
  /** Current column number (1-indexed) */
  protected column: number = 1;
  /** Lexer configuration options */
  protected options: LexerOptions;

  /**
   * Creates a new Lexer instance
   * @param source - The source code to tokenize
   * @param options - Configuration options for the lexer
   */
  constructor(source: string, options: LexerOptions = {}) {
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
  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token: Token;

    do {
      token = this.nextToken();
      tokens.push(token);
    } while (token.type !== TokenType.EOF);

    return tokens;
  }

  /**
   * Get the next token from the source
   */
  public nextToken(): Token {
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

    // Numbers (including hex and binary)
    if (this.isDigit(char) || (char === '$' && this.isHexDigit(this.peek()))) {
      return this.readNumber();
    }

    // Strings
    if (char === '"' || char === "'") {
      return this.readString(char);
    }

    // Keywords with @ prefix (storage classes and @address type)
    if (char === '@') {
      return this.readAtKeyword();
    }

    // Identifiers and keywords
    if (this.isAlpha(char) || char === '_') {
      return this.readIdentifierOrKeyword();
    }

    // Two-character operators
    const twoChar = char + this.peek();
    // Three-character operators
    const threeChar = char + this.peek() + this.peekAt(2);

    switch (threeChar) {
      case '<<=':
        return this.createThreeCharToken(TokenType.LEFT_SHIFT_ASSIGN);
      case '>>=':
        return this.createThreeCharToken(TokenType.RIGHT_SHIFT_ASSIGN);
    }

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
      case '&&':
        return this.createTwoCharToken(TokenType.AND);
      case '||':
        return this.createTwoCharToken(TokenType.OR);
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
      case '!':
        return this.createSingleCharToken(TokenType.NOT);
    }

    // Unknown character
    this.advance();
    throw new Error(`Unexpected character '${char}' at line ${start.line}, column ${start.column}`);
  }

  /**
   * Reads a numeric literal from the source
   * Supports decimal, hexadecimal ($xx or 0x), and binary (0b) formats
   * @returns Token containing the numeric value
   * @throws Error if number format is invalid
   */
  protected readNumber(): Token {
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

  /**
   * Reads a string literal from the source
   * Handles escape sequences (\n, \t, \r, \\, \", \')
   * Supports both single and double quoted strings
   * @param quote - The quote character (' or ") that started the string
   * @returns Token containing the string value
   * @throws Error if string is unterminated
   */
  protected readString(quote: string): Token {
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
      } else if (char === '\n') {
        this.line++;
        this.column = 1;
        value += char;
      } else {
        value += char;
      }

      this.advance();
    }

    if (this.isAtEnd()) {
      throw new Error(`Unterminated string at line ${start.line}, column ${start.column}`);
    }

    this.advance(); // Skip closing quote

    return this.createToken(TokenType.STRING_LITERAL, value, start);
  }

  /**
   * Reads keywords that start with '@' prefix
   * Handles storage classes (@zp, @ram, @data, @map) and the @address type
   * For unknown keywords like @buffer, returns just the @ token
   * @returns Token representing an @ keyword or just AT token
   */
  protected readAtKeyword(): Token {
    const start = this.getCurrentPosition();

    // Always consume the '@' character first
    this.advance();

    // Peek ahead to see what follows without consuming
    let keyword = '';
    let pos = this.position;
    while (pos < this.source.length && this.isAlphaNumeric(this.source[pos])) {
      keyword += this.source[pos];
      pos++;
    }

    // Check if it's a known @ keyword
    if (keyword === 'zp') {
      // Consume the keyword and return the full token
      this.advance(keyword.length);
      return this.createToken(TokenType.ZP, '@zp', start);
    } else if (keyword === 'ram') {
      this.advance(keyword.length);
      return this.createToken(TokenType.RAM, '@ram', start);
    } else if (keyword === 'data') {
      this.advance(keyword.length);
      return this.createToken(TokenType.DATA, '@data', start);
    } else if (keyword === 'map') {
      this.advance(keyword.length);
      return this.createToken(TokenType.MAP, '@map', start);
    } else if (keyword === 'address') {
      this.advance(keyword.length);
      return this.createToken(TokenType.ADDRESS, '@address', start);
    }

    // Unknown keyword after @, just return AT token
    // Don't consume the following identifier - let it be parsed separately
    return this.createToken(TokenType.AT, '@', start);
  }

  /**
   * Reads an identifier or keyword from the source
   * Also handles boolean literals (true/false)
   * @returns Token representing an identifier, keyword, or boolean literal
   */
  protected readIdentifierOrKeyword(): Token {
    const start = this.getCurrentPosition();
    let value = '';

    while (this.isAlphaNumeric(this.getCurrentChar())) {
      value += this.getCurrentChar();
      this.advance();
    }

    // Check for boolean literals
    if (value === 'true' || value === 'false') {
      return this.createToken(TokenType.BOOLEAN_LITERAL, value, start);
    }

    // Check if it's a keyword
    const type = KEYWORDS.has(value) ? this.getKeywordTokenType(value) : TokenType.IDENTIFIER;

    return this.createToken(type, value, start);
  }

  /**
   * Maps a keyword string to its corresponding TokenType
   * @param keyword - The keyword string to map
   * @returns The TokenType for the given keyword, or IDENTIFIER if not found
   */
  protected getKeywordTokenType(keyword: string): TokenType {
    switch (keyword) {
      case eModuleKeyword.MODULE:
        return TokenType.MODULE;
      case eModuleKeyword.IMPORT:
        return TokenType.IMPORT;
      case eModuleKeyword.EXPORT:
        return TokenType.EXPORT;
      case eModuleKeyword.FROM:
        return TokenType.FROM;
      case eFunctionKeyword.FUNCTION:
        return TokenType.FUNCTION;
      case eControlFlowKeyword.END:
        return TokenType.END;
      case eFunctionKeyword.RETURN:
        return TokenType.RETURN;
      case eControlFlowKeyword.IF:
        return TokenType.IF;
      case eControlFlowKeyword.THEN:
        return TokenType.THEN;
      case eControlFlowKeyword.ELSE:
        return TokenType.ELSE;
      case eControlFlowKeyword.ELSEIF:
        return TokenType.ELSEIF;
      case eControlFlowKeyword.WHILE:
        return TokenType.WHILE;
      case eControlFlowKeyword.FOR:
        return TokenType.FOR;
      case eControlFlowKeyword.TO:
        return TokenType.TO;
      case eControlFlowKeyword.NEXT:
        return TokenType.NEXT;
      case eControlFlowKeyword.MATCH:
        return TokenType.MATCH;
      case eControlFlowKeyword.CASE:
        return TokenType.CASE;
      case eControlFlowKeyword.BREAK:
        return TokenType.BREAK;
      case eControlFlowKeyword.CONTINUE:
        return TokenType.CONTINUE;
      case eControlFlowKeyword.DEFAULT:
        return TokenType.DEFAULT;
      case eDeclarationKeyword.TYPE:
        return TokenType.TYPE;
      case eDeclarationKeyword.ENUM:
        return TokenType.ENUM;
      case eMutabilityModifier.LET:
        return TokenType.LET;
      case eMutabilityModifier.CONST:
        return TokenType.CONST;
      case eStorageClass.ZP:
        return TokenType.ZP;
      case eStorageClass.RAM:
        return TokenType.RAM;
      case eStorageClass.DATA:
        return TokenType.DATA;
      case eMemoryMappingKeyword.AT:
        return TokenType.AT;
      case eMemoryMappingKeyword.LAYOUT:
        return TokenType.LAYOUT;
      case ePrimitiveType.BYTE:
        return TokenType.BYTE;
      case ePrimitiveType.WORD:
        return TokenType.WORD;
      case ePrimitiveType.VOID:
        return TokenType.VOID;
      case ePrimitiveType.CALLBACK:
        return TokenType.CALLBACK;
      case ePrimitiveType.STRING:
        return TokenType.STRING;
      case ePrimitiveType.BOOLEAN:
        return TokenType.BOOLEAN;
      case ePrimitiveType.ADDRESS:
        return TokenType.ADDRESS;
      default:
        return TokenType.IDENTIFIER;
    }
  }

  /**
   * Reads a line comment from the source (// style)
   * Comment continues until end of line
   * @returns Token containing the comment, or the next token if skipComments is enabled
   */
  protected readLineComment(): Token {
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

  /**
   * Reads a block comment from the source (slash-star star-slash style)
   * Tracks line numbers for proper error reporting
   * @returns Token containing the comment, or the next token if skipComments is enabled
   * @throws Error if block comment is unterminated
   */
  protected readBlockComment(): Token {
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

  /**
   * Skips whitespace characters (space, tab, carriage return, and newlines)
   * Newlines are now treated as trivial whitespace (semicolons separate statements)
   */
  protected skipWhitespace(): void {
    while (!this.isAtEnd() && this.isWhitespace(this.getCurrentChar())) {
      // Track line numbers for newlines
      if (this.getCurrentChar() === '\n') {
        this.line++;
        this.column = 1;
        this.position++;
      } else {
        this.advance();
      }
    }
  }

  /**
   * Gets the current character without advancing position
   * @returns Current character or '\0' if at end of source
   */
  protected getCurrentChar(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.position] || '\0';
  }

  /**
   * Peeks at the next character without advancing position
   * @returns Next character or '\0' if at end of source
   */
  protected peek(): string {
    return this.peekAt(1);
  }

  /**
   * Peeks at a character at a specific offset from current position
   * @param offset - Number of characters ahead to peek
   * @returns Character at offset or '\0' if beyond source length
   */
  protected peekAt(offset: number): string {
    const pos = this.position + offset;
    if (pos >= this.source.length) return '\0';
    return this.source[pos] || '\0';
  }

  /**
   * Advances the position by the specified number of characters
   * Automatically updates line and column tracking (column only increments for non-newline chars)
   * @param count - Number of characters to advance (default: 1)
   */
  protected advance(count: number = 1): void {
    for (let i = 0; i < count && !this.isAtEnd(); i++) {
      if (this.getCurrentChar() !== '\n') {
        this.column++;
      }
      this.position++;
    }
  }

  /**
   * Checks if the lexer has reached the end of the source
   * @returns True if at or beyond the end of source
   */
  protected isAtEnd(): boolean {
    return this.position >= this.source.length;
  }

  /**
   * Checks if a character is a decimal digit (0-9)
   * @param char - Character to check
   * @returns True if character is a decimal digit
   */
  protected isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  /**
   * Checks if a character is a hexadecimal digit (0-9, A-F, a-f)
   * @param char - Character to check
   * @returns True if character is a hexadecimal digit
   */
  protected isHexDigit(char: string): boolean {
    return this.isDigit(char) || (char >= 'A' && char <= 'F') || (char >= 'a' && char <= 'f');
  }

  /**
   * Checks if a character is a binary digit (0 or 1)
   * @param char - Character to check
   * @returns True if character is a binary digit
   */
  protected isBinaryDigit(char: string): boolean {
    return char === '0' || char === '1';
  }

  /**
   * Checks if a character is alphabetic or underscore
   * Valid for starting an identifier
   * @param char - Character to check
   * @returns True if character is alphabetic or underscore
   */
  protected isAlpha(char: string): boolean {
    return (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') || char === '_';
  }

  /**
   * Checks if a character is alphanumeric or underscore
   * Valid for identifier continuation
   * @param char - Character to check
   * @returns True if character is alphanumeric or underscore
   */
  protected isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  /**
   * Checks if a character is whitespace (space, tab, carriage return, or newline)
   * Newlines are now treated as trivial whitespace (semicolons separate statements)
   * @param char - Character to check
   * @returns True if character is whitespace
   */
  protected isWhitespace(char: string): boolean {
    return char === ' ' || char === '\r' || char === '\t' || char === '\n';
  }

  /**
   * Gets the current source position for token creation
   * @returns SourcePosition object with line, column, and offset
   */
  protected getCurrentPosition(): SourcePosition {
    return {
      line: this.line,
      column: this.column,
      offset: this.position,
    };
  }

  /**
   * Creates a token with the specified properties
   * @param type - Token type
   * @param value - Token value (the actual text)
   * @param start - Starting source position
   * @param end - Ending source position (defaults to current position if not provided)
   * @returns Complete Token object
   */
  protected createToken(
    type: TokenType,
    value: string,
    start: SourcePosition,
    end?: SourcePosition
  ): Token {
    return {
      type,
      value,
      start,
      end: end || this.getCurrentPosition(),
    };
  }

  /**
   * Creates a token for a single character operator or punctuation
   * Advances position by 1
   * @param type - Token type
   * @returns Token for the single character
   */
  protected createSingleCharToken(type: TokenType): Token {
    const start = this.getCurrentPosition();
    const char = this.getCurrentChar();
    this.advance();
    return this.createToken(type, char, start);
  }

  /**
   * Creates a token for a two-character operator
   * Advances position by 2
   * @param type - Token type
   * @returns Token for the two-character operator
   */
  protected createTwoCharToken(type: TokenType): Token {
    const start = this.getCurrentPosition();
    const value = this.getCurrentChar() + this.peek();
    this.advance(2);
    return this.createToken(type, value, start);
  }

  /**
   * Creates a token for a three-character operator
   * Advances position by 3
   * @param type - Token type
   * @returns Token for the three-character operator
   */
  protected createThreeCharToken(type: TokenType): Token {
    const start = this.getCurrentPosition();
    const value = this.getCurrentChar() + this.peek() + this.peekAt(2);
    this.advance(3);
    return this.createToken(type, value, start);
  }
}