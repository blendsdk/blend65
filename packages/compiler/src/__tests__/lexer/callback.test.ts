import { describe, expect, it } from 'vitest';
import { Lexer, TokenType } from '../../lexer/index.js';

describe('Callback Keyword Lexing', () => {
  it('should tokenize callback keyword', () => {
    const source = 'callback function';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.CALLBACK);
    expect(tokens[0].value).toBe('callback');
    expect(tokens[1].type).toBe(TokenType.FUNCTION);
    expect(tokens[1].value).toBe('function');
  });

  it('should recognize callback in function declaration context', () => {
    const source = 'callback function handler(): void';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.CALLBACK);
    expect(tokens[1].type).toBe(TokenType.FUNCTION);
    expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[2].value).toBe('handler');
  });

  it('should tokenize callback as type', () => {
    const source = 'let handler: callback = myFunction';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.LET);
    expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[1].value).toBe('handler');
    expect(tokens[2].type).toBe(TokenType.COLON);
    expect(tokens[3].type).toBe(TokenType.CALLBACK);
    expect(tokens[3].value).toBe('callback');
  });

  it('should handle callback as identifier when not a keyword', () => {
    const source = 'let callbackCount: byte = 0';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    // callbackCount should be IDENTIFIER, not CALLBACK + IDENTIFIER
    expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[1].value).toBe('callbackCount');
  });

  it('should handle case sensitivity', () => {
    const source = 'CALLBACK Callback CallBack';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    // All should be identifiers, not callback keyword (Blend65 is case-sensitive)
    expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
  });

  it('should tokenize callback in complex expressions', () => {
    const source = 'setRasterInterrupt(250, callback)';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.IDENTIFIER); // setRasterInterrupt
    expect(tokens[1].type).toBe(TokenType.LEFT_PAREN);
    expect(tokens[2].type).toBe(TokenType.NUMBER); // 250
    expect(tokens[3].type).toBe(TokenType.COMMA);
    expect(tokens[4].type).toBe(TokenType.CALLBACK); // callback as type or identifier
    expect(tokens[5].type).toBe(TokenType.RIGHT_PAREN);
  });

  it('should handle callback keyword in string literals', () => {
    const source = '"This is a callback function"';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.STRING_LITERAL);
    expect(tokens[0].value).toBe('This is a callback function');
  });

  it('should handle callback keyword in comments', () => {
    const source = '// This callback function does something';
    const lexer = new Lexer(source, { skipComments: false });
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.LINE_COMMENT);
    expect(tokens[0].value).toBe('// This callback function does something');
  });
});
