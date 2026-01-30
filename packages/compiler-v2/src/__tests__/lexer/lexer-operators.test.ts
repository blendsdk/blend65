import { describe, expect, it } from 'vitest';
import { tokenize } from '../../lexer/index.js';
import { TokenType } from '../../lexer/types.js';

/**
 * Lexer operator tests
 *
 * v2: No changes needed - these tests don't involve @map.
 */
describe('Blend65Lexer - Operators', () => {
  describe('Arithmetic Operators', () => {
    it('should parse arithmetic operators', () => {
      const source = '+ - * / %';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.PLUS);
      expect(tokens[1].type).toBe(TokenType.MINUS);
      expect(tokens[2].type).toBe(TokenType.MULTIPLY);
      expect(tokens[3].type).toBe(TokenType.DIVIDE);
      expect(tokens[4].type).toBe(TokenType.MODULO);
    });
  });

  describe('Comparison Operators', () => {
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
  });

  describe('Bitwise Operators', () => {
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
  });

  describe('Assignment Operators', () => {
    it('should parse assignment operators', () => {
      const source = '= += -= *= /= %= &= |= ^= <<= >>=';
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
      expect(tokens[9].type).toBe(TokenType.LEFT_SHIFT_ASSIGN);
      expect(tokens[10].type).toBe(TokenType.RIGHT_SHIFT_ASSIGN);
    });
  });

  describe('Special Tokens (Punctuation)', () => {
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
});