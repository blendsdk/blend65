import { describe, expect, it } from 'vitest';
import { tokenize } from '../../lexer/index.js';
import { TokenType } from '../../lexer/types.js';

/**
 * Lexer number literal tests
 *
 * v2: No changes needed - these tests don't involve @map.
 */
describe('Blend65Lexer - Numbers', () => {
  describe('Decimal Numbers', () => {
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
  });

  describe('Hexadecimal Numbers', () => {
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
  });

  describe('Binary Numbers', () => {
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
});