import { describe, expect, it } from 'vitest';
import { tokenize } from '../../lexer/index.js';
import { TokenType } from '../../lexer/types.js';

/**
 * Lexer address type and address-of operator tests
 * Split from original lexer.test.ts for better maintainability
 */
describe('Blend65Lexer - Address Type and Address-of Operator', () => {
  describe('@address type alias', () => {
    it('should tokenize @address as single ADDRESS token', () => {
      const source = '@address';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.ADDRESS);
      expect(tokens[0].value).toBe('@address');
      expect(tokens[1].type).toBe(TokenType.EOF);
    });

    it('should handle @address in function parameters', () => {
      const source = 'function copy(src: @address, dst: @address): void';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.FUNCTION);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('copy');
      expect(tokens[2].type).toBe(TokenType.LEFT_PAREN);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('src');
      expect(tokens[4].type).toBe(TokenType.COLON);
      expect(tokens[5].type).toBe(TokenType.ADDRESS);
      expect(tokens[5].value).toBe('@address');
      expect(tokens[6].type).toBe(TokenType.COMMA);
      expect(tokens[7].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[7].value).toBe('dst');
      expect(tokens[8].type).toBe(TokenType.COLON);
      expect(tokens[9].type).toBe(TokenType.ADDRESS);
      expect(tokens[9].value).toBe('@address');
      expect(tokens[10].type).toBe(TokenType.RIGHT_PAREN);
      expect(tokens[11].type).toBe(TokenType.COLON);
      expect(tokens[12].type).toBe(TokenType.VOID);
    });

    it('should handle @address in variable declarations', () => {
      const source = 'let addr: @address = 0x1000;';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.LET);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('addr');
      expect(tokens[2].type).toBe(TokenType.COLON);
      expect(tokens[3].type).toBe(TokenType.ADDRESS);
      expect(tokens[3].value).toBe('@address');
      expect(tokens[4].type).toBe(TokenType.ASSIGN);
      expect(tokens[5].type).toBe(TokenType.NUMBER);
      expect(tokens[5].value).toBe('0x1000');
      expect(tokens[6].type).toBe(TokenType.SEMICOLON);
    });
  });

  describe('Address-of operator (@variable)', () => {
    it('should tokenize @variable as AT + IDENTIFIER tokens', () => {
      const source = '@buffer';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.AT);
      expect(tokens[0].value).toBe('@');
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('buffer');
      expect(tokens[2].type).toBe(TokenType.EOF);
    });

    it('should handle various identifier names', () => {
      const source = '@myVar @sprite_data @buffer123 @_internal';
      const tokens = tokenize(source);

      // @myVar
      expect(tokens[0].type).toBe(TokenType.AT);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('myVar');

      // @sprite_data
      expect(tokens[2].type).toBe(TokenType.AT);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('sprite_data');

      // @buffer123
      expect(tokens[4].type).toBe(TokenType.AT);
      expect(tokens[5].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[5].value).toBe('buffer123');

      // @_internal
      expect(tokens[6].type).toBe(TokenType.AT);
      expect(tokens[7].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[7].value).toBe('_internal');
    });

    it('should handle address-of in arithmetic expressions', () => {
      const source = '@buffer + 1';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.AT);
      expect(tokens[0].value).toBe('@');
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('buffer');
      expect(tokens[2].type).toBe(TokenType.PLUS);
      expect(tokens[3].type).toBe(TokenType.NUMBER);
      expect(tokens[3].value).toBe('1');
    });

    it('should handle parenthesized address-of expressions', () => {
      const source = '(@array) * 2 + 5';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.LEFT_PAREN);
      expect(tokens[1].type).toBe(TokenType.AT);
      expect(tokens[1].value).toBe('@');
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('array');
      expect(tokens[3].type).toBe(TokenType.RIGHT_PAREN);
      expect(tokens[4].type).toBe(TokenType.MULTIPLY);
      expect(tokens[5].type).toBe(TokenType.NUMBER);
      expect(tokens[5].value).toBe('2');
      expect(tokens[6].type).toBe(TokenType.PLUS);
      expect(tokens[7].type).toBe(TokenType.NUMBER);
      expect(tokens[7].value).toBe('5');
    });
  });

  describe('Mixed usage patterns', () => {
    it('should handle complete address assignment', () => {
      const source = 'let addr: @address = @buffer;';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.LET);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('addr');
      expect(tokens[2].type).toBe(TokenType.COLON);
      expect(tokens[3].type).toBe(TokenType.ADDRESS);
      expect(tokens[3].value).toBe('@address');
      expect(tokens[4].type).toBe(TokenType.ASSIGN);
      expect(tokens[5].type).toBe(TokenType.AT);
      expect(tokens[5].value).toBe('@');
      expect(tokens[6].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[6].value).toBe('buffer');
      expect(tokens[7].type).toBe(TokenType.SEMICOLON);
    });

    it('should handle function calls with address-of arguments', () => {
      const source = 'copyMemory(@source, @dest, 256);';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].value).toBe('copyMemory');
      expect(tokens[1].type).toBe(TokenType.LEFT_PAREN);
      expect(tokens[2].type).toBe(TokenType.AT);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('source');
      expect(tokens[4].type).toBe(TokenType.COMMA);
      expect(tokens[5].type).toBe(TokenType.AT);
      expect(tokens[6].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[6].value).toBe('dest');
      expect(tokens[7].type).toBe(TokenType.COMMA);
      expect(tokens[8].type).toBe(TokenType.NUMBER);
      expect(tokens[8].value).toBe('256');
      expect(tokens[9].type).toBe(TokenType.RIGHT_PAREN);
      expect(tokens[10].type).toBe(TokenType.SEMICOLON);
    });

    it('should handle complex arithmetic with address-of', () => {
      const source = 'let addr: @address = @buffer + offset * 2;';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.LET);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('addr');
      expect(tokens[2].type).toBe(TokenType.COLON);
      expect(tokens[3].type).toBe(TokenType.ADDRESS);
      expect(tokens[4].type).toBe(TokenType.ASSIGN);
      expect(tokens[5].type).toBe(TokenType.AT);
      expect(tokens[6].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[6].value).toBe('buffer');
      expect(tokens[7].type).toBe(TokenType.PLUS);
      expect(tokens[8].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[8].value).toBe('offset');
      expect(tokens[9].type).toBe(TokenType.MULTIPLY);
      expect(tokens[10].type).toBe(TokenType.NUMBER);
      expect(tokens[10].value).toBe('2');
      expect(tokens[11].type).toBe(TokenType.SEMICOLON);
    });

    it('should handle address-of with storage class declarations', () => {
      const source = '@zp let buffer: byte[10]; let addr = @buffer;';
      const tokens = tokenize(source);

      // First part: @zp let buffer: byte[10];
      expect(tokens[0].type).toBe(TokenType.ZP);
      expect(tokens[1].type).toBe(TokenType.LET);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('buffer');
      expect(tokens[3].type).toBe(TokenType.COLON);
      expect(tokens[4].type).toBe(TokenType.BYTE);
      expect(tokens[5].type).toBe(TokenType.LEFT_BRACKET);
      expect(tokens[6].type).toBe(TokenType.NUMBER);
      expect(tokens[6].value).toBe('10');
      expect(tokens[7].type).toBe(TokenType.RIGHT_BRACKET);
      expect(tokens[8].type).toBe(TokenType.SEMICOLON);

      // Second part: let addr = @buffer;
      expect(tokens[9].type).toBe(TokenType.LET);
      expect(tokens[10].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[10].value).toBe('addr');
      expect(tokens[11].type).toBe(TokenType.ASSIGN);
      expect(tokens[12].type).toBe(TokenType.AT);
      expect(tokens[13].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[13].value).toBe('buffer');
      expect(tokens[14].type).toBe(TokenType.SEMICOLON);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle standalone @ symbol as AT token', () => {
      const source = '@ identifier';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.AT);
      expect(tokens[0].value).toBe('@');
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('identifier');
    });

    it('should handle @ followed by numbers (invalid identifier)', () => {
      const source = '@123';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.AT);
      expect(tokens[0].value).toBe('@');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('123');
    });

    it('should handle @ followed by keywords', () => {
      const source = '@let @function @if';
      const tokens = tokenize(source);

      // @let
      expect(tokens[0].type).toBe(TokenType.AT);
      expect(tokens[1].type).toBe(TokenType.LET);

      // @function
      expect(tokens[2].type).toBe(TokenType.AT);
      expect(tokens[3].type).toBe(TokenType.FUNCTION);

      // @if
      expect(tokens[4].type).toBe(TokenType.AT);
      expect(tokens[5].type).toBe(TokenType.IF);
    });

    it('should handle @ in strings (should remain as string content)', () => {
      const source = '"@address and @buffer are different"';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[0].value).toBe('@address and @buffer are different');
      expect(tokens[1].type).toBe(TokenType.EOF);
    });

    it('should handle multiple @ symbols in sequence', () => {
      const source = '@ @ @buffer';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.AT);
      expect(tokens[1].type).toBe(TokenType.AT);
      expect(tokens[2].type).toBe(TokenType.AT);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('buffer');
    });
  });

  describe('Integration with existing storage classes', () => {
    it('should continue to recognize all existing storage classes', () => {
      const source = '@zp @ram @data @map @address';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.ZP);
      expect(tokens[0].value).toBe('@zp');
      expect(tokens[1].type).toBe(TokenType.RAM);
      expect(tokens[1].value).toBe('@ram');
      expect(tokens[2].type).toBe(TokenType.DATA);
      expect(tokens[2].value).toBe('@data');
      expect(tokens[3].type).toBe(TokenType.MAP);
      expect(tokens[3].value).toBe('@map');
      expect(tokens[4].type).toBe(TokenType.ADDRESS);
      expect(tokens[4].value).toBe('@address');
    });

    it('should distinguish @address from similar patterns', () => {
      const source = '@address @addresses @addressing @addr';
      const tokens = tokenize(source);

      // @address (single ADDRESS token)
      expect(tokens[0].type).toBe(TokenType.ADDRESS);
      expect(tokens[0].value).toBe('@address');

      // @addresses (AT + IDENTIFIER)
      expect(tokens[1].type).toBe(TokenType.AT);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('addresses');

      // @addressing (AT + IDENTIFIER)
      expect(tokens[3].type).toBe(TokenType.AT);
      expect(tokens[4].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[4].value).toBe('addressing');

      // @addr (AT + IDENTIFIER)
      expect(tokens[5].type).toBe(TokenType.AT);
      expect(tokens[6].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[6].value).toBe('addr');
    });
  });

  describe('Real-world usage examples', () => {
    it('should tokenize memory utility function declaration', () => {
      const source = 'function copyMemory(src: @address, dst: @address, len: byte): void';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.FUNCTION);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('copyMemory');
      expect(tokens[5].type).toBe(TokenType.ADDRESS);
      expect(tokens[9].type).toBe(TokenType.ADDRESS);
      expect(tokens[11].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[11].value).toBe('len');
      expect(tokens[12].type).toBe(TokenType.COLON);
      expect(tokens[13].type).toBe(TokenType.BYTE);
    });

    it('should tokenize sprite data address example', () => {
      const source = '@data const spriteData: byte[63] = [...]; let addr = @spriteData + 21;';
      const tokens = tokenize(source);

      // @data const spriteData: byte[63] = [...];
      expect(tokens[0].type).toBe(TokenType.DATA);
      expect(tokens[1].type).toBe(TokenType.CONST);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('spriteData');

      // Find the address-of operation: @spriteData + 21
      const atIndex = tokens.findIndex(
        (token, i) =>
          token.type === TokenType.AT &&
          i + 1 < tokens.length &&
          tokens[i + 1].value === 'spriteData'
      );

      expect(atIndex).toBeGreaterThan(-1);
      expect(tokens[atIndex].type).toBe(TokenType.AT);
      expect(tokens[atIndex + 1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[atIndex + 1].value).toBe('spriteData');
      expect(tokens[atIndex + 2].type).toBe(TokenType.PLUS);
      expect(tokens[atIndex + 3].type).toBe(TokenType.NUMBER);
      expect(tokens[atIndex + 3].value).toBe('21');
    });
  });
});