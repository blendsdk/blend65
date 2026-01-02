import { describe, it, expect } from 'vitest';
import { Blend65Lexer, TokenType, tokenize } from '../index.js';

describe('Blend65Lexer', () => {
  describe('Keywords', () => {
    it('should recognize module system keywords', () => {
      const source = 'module import export from';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.MODULE);
      expect(tokens[1].type).toBe(TokenType.IMPORT);
      expect(tokens[2].type).toBe(TokenType.EXPORT);
      expect(tokens[3].type).toBe(TokenType.FROM);
    });

    it('should recognize function and control flow keywords', () => {
      const source = 'function end if then else while for to next match case';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.FUNCTION);
      expect(tokens[1].type).toBe(TokenType.END);
      expect(tokens[2].type).toBe(TokenType.IF);
      expect(tokens[3].type).toBe(TokenType.THEN);
      expect(tokens[4].type).toBe(TokenType.ELSE);
      expect(tokens[5].type).toBe(TokenType.WHILE);
      expect(tokens[6].type).toBe(TokenType.FOR);
      expect(tokens[7].type).toBe(TokenType.TO);
      expect(tokens[8].type).toBe(TokenType.NEXT);
      expect(tokens[9].type).toBe(TokenType.MATCH);
      expect(tokens[10].type).toBe(TokenType.CASE);
    });

    it('should recognize storage class keywords', () => {
      const source = 'zp ram data const io';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.ZP);
      expect(tokens[1].type).toBe(TokenType.RAM);
      expect(tokens[2].type).toBe(TokenType.DATA);
      expect(tokens[3].type).toBe(TokenType.CONST);
      expect(tokens[4].type).toBe(TokenType.IO);
    });

    it('should recognize primitive type keywords', () => {
      const source = 'byte word void';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.BYTE);
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[2].type).toBe(TokenType.VOID);
    });

    it('should recognize logical operators as keywords', () => {
      const source = 'and or not';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.AND);
      expect(tokens[1].type).toBe(TokenType.OR);
      expect(tokens[2].type).toBe(TokenType.NOT);
    });
  });

  describe('Numbers', () => {
    it('should parse decimal numbers', () => {
      const source = '123 0 255';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('123');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('0');
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].value).toBe('255');
    });

    it('should parse hex numbers with $ prefix', () => {
      const source = '$D000 $FF $00';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('$D000');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('$FF');
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].value).toBe('$00');
    });

    it('should parse hex numbers with 0x prefix', () => {
      const source = '0xD000 0xFF 0x00';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('0xD000');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('0xFF');
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].value).toBe('0x00');
    });

    it('should parse binary numbers', () => {
      const source = '0b1010 0b0001 0b1111';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('0b1010');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('0b0001');
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].value).toBe('0b1111');
    });
  });

  describe('Strings', () => {
    it('should parse double-quoted strings', () => {
      const source = '"Hello, World!"';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('Hello, World!');
    });

    it('should parse single-quoted strings', () => {
      const source = "'Hello, World!'";
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('Hello, World!');
    });

    it('should handle escape sequences', () => {
      const source = '"Hello\\nWorld\\t!"';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('Hello\nWorld\t!');
    });
  });

  describe('Booleans', () => {
    it('should recognize boolean literals', () => {
      const source = 'true false';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.BOOLEAN);
      expect(tokens[0].value).toBe('true');
      expect(tokens[1].type).toBe(TokenType.BOOLEAN);
      expect(tokens[1].value).toBe('false');
    });
  });

  describe('Operators', () => {
    it('should parse arithmetic operators', () => {
      const source = '+ - * / %';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.PLUS);
      expect(tokens[1].type).toBe(TokenType.MINUS);
      expect(tokens[2].type).toBe(TokenType.MULTIPLY);
      expect(tokens[3].type).toBe(TokenType.DIVIDE);
      expect(tokens[4].type).toBe(TokenType.MODULO);
    });

    it('should parse comparison operators', () => {
      const source = '== != < <= > >=';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.EQUAL);
      expect(tokens[1].type).toBe(TokenType.NOT_EQUAL);
      expect(tokens[2].type).toBe(TokenType.LESS_THAN);
      expect(tokens[3].type).toBe(TokenType.LESS_EQUAL);
      expect(tokens[4].type).toBe(TokenType.GREATER_THAN);
      expect(tokens[5].type).toBe(TokenType.GREATER_EQUAL);
    });

    it('should parse bitwise operators', () => {
      const source = '& | ^ ~ << >>';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.BITWISE_AND);
      expect(tokens[1].type).toBe(TokenType.BITWISE_OR);
      expect(tokens[2].type).toBe(TokenType.BITWISE_XOR);
      expect(tokens[3].type).toBe(TokenType.BITWISE_NOT);
      expect(tokens[4].type).toBe(TokenType.LEFT_SHIFT);
      expect(tokens[5].type).toBe(TokenType.RIGHT_SHIFT);
    });

    it('should parse assignment operators', () => {
      const source = '= += -= *= /= %= &= |= ^=';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.ASSIGN);
      expect(tokens[1].type).toBe(TokenType.PLUS_ASSIGN);
      expect(tokens[2].type).toBe(TokenType.MINUS_ASSIGN);
      expect(tokens[3].type).toBe(TokenType.MULTIPLY_ASSIGN);
      expect(tokens[4].type).toBe(TokenType.DIVIDE_ASSIGN);
      expect(tokens[5].type).toBe(TokenType.MODULO_ASSIGN);
      expect(tokens[6].type).toBe(TokenType.BITWISE_AND_ASSIGN);
      expect(tokens[7].type).toBe(TokenType.BITWISE_OR_ASSIGN);
      expect(tokens[8].type).toBe(TokenType.BITWISE_XOR_ASSIGN);
    });
  });

  describe('Special tokens', () => {
    it('should parse memory placement operator', () => {
      const source = '@ $D000';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.AT);
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('$D000');
    });

    it('should parse punctuation', () => {
      const source = '( ) [ ] { } , ; : .';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.LEFT_PAREN);
      expect(tokens[1].type).toBe(TokenType.RIGHT_PAREN);
      expect(tokens[2].type).toBe(TokenType.LEFT_BRACKET);
      expect(tokens[3].type).toBe(TokenType.RIGHT_BRACKET);
      expect(tokens[4].type).toBe(TokenType.LEFT_BRACE);
      expect(tokens[5].type).toBe(TokenType.RIGHT_BRACE);
      expect(tokens[6].type).toBe(TokenType.COMMA);
      expect(tokens[7].type).toBe(TokenType.SEMICOLON);
      expect(tokens[8].type).toBe(TokenType.COLON);
      expect(tokens[9].type).toBe(TokenType.DOT);
    });
  });

  describe('Comments', () => {
    it('should skip line comments by default', () => {
      const source = 'var x // This is a comment\nvar y';
      const tokens = tokenize(source);

      // Should only have var, x, newline, var, y, EOF
      expect(tokens.length).toBe(6);
      expect(tokens[0].type).toBe(TokenType.VAR);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.NEWLINE);
      expect(tokens[3].type).toBe(TokenType.VAR);
      expect(tokens[4].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[5].type).toBe(TokenType.EOF);
    });

    it('should skip block comments by default', () => {
      const source = 'var x /* This is a block comment */ var y';
      const tokens = tokenize(source);

      // Should only have var, x, var, y, EOF
      expect(tokens.length).toBe(5);
      expect(tokens[0].type).toBe(TokenType.VAR);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.VAR);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[4].type).toBe(TokenType.EOF);
    });
  });

  describe('Sample Blend65 code', () => {
    it('should tokenize a simple Blend65 module declaration', () => {
      const source = `module Game.Main
import setSpritePosition from target.sprites
export function main(): void
end function`;

      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.MODULE);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('Game');
      expect(tokens[2].type).toBe(TokenType.DOT);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('Main');
      expect(tokens[4].type).toBe(TokenType.NEWLINE);

      expect(tokens[5].type).toBe(TokenType.IMPORT);
      expect(tokens[6].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[6].value).toBe('setSpritePosition');
      expect(tokens[7].type).toBe(TokenType.FROM);
      expect(tokens[8].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[8].value).toBe('target');
      expect(tokens[9].type).toBe(TokenType.DOT);
      expect(tokens[10].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[10].value).toBe('sprites');
    });

    it('should tokenize storage declarations', () => {
      const source = `zp var counter: byte
ram var buffer: byte[256]
io var VIC_REG: byte @ $D000`;

      const tokens = tokenize(source);

      // First line: zp var counter: byte
      expect(tokens[0].type).toBe(TokenType.ZP);
      expect(tokens[1].type).toBe(TokenType.VAR);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('counter');
      expect(tokens[3].type).toBe(TokenType.COLON);
      expect(tokens[4].type).toBe(TokenType.BYTE);
      expect(tokens[5].type).toBe(TokenType.NEWLINE);

      // Second line: ram var buffer: byte[256]
      expect(tokens[6].type).toBe(TokenType.RAM);
      expect(tokens[7].type).toBe(TokenType.VAR);
      expect(tokens[8].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[8].value).toBe('buffer');
      expect(tokens[9].type).toBe(TokenType.COLON);
      expect(tokens[10].type).toBe(TokenType.BYTE);
      expect(tokens[11].type).toBe(TokenType.LEFT_BRACKET);
      expect(tokens[12].type).toBe(TokenType.NUMBER);
      expect(tokens[12].value).toBe('256');
      expect(tokens[13].type).toBe(TokenType.RIGHT_BRACKET);
      expect(tokens[14].type).toBe(TokenType.NEWLINE);

      // Third line: io var VIC_REG: byte @ $D000
      expect(tokens[15].type).toBe(TokenType.IO);
      expect(tokens[16].type).toBe(TokenType.VAR);
      expect(tokens[17].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[17].value).toBe('VIC_REG');
      expect(tokens[18].type).toBe(TokenType.COLON);
      expect(tokens[19].type).toBe(TokenType.BYTE);
      expect(tokens[20].type).toBe(TokenType.AT);
      expect(tokens[21].type).toBe(TokenType.NUMBER);
      expect(tokens[21].value).toBe('$D000');
    });
  });
});
