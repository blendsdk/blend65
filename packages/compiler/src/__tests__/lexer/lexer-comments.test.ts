import { describe, expect, it } from 'vitest';
import { tokenize } from '../../lexer/index.js';
import { TokenType } from '../../lexer/types.js';

/**
 * Lexer comment handling tests
 * Split from original lexer.test.ts for better maintainability
 */
describe('Blend65Lexer - Comments', () => {
  describe('Line Comments', () => {
    it('should skip line comments by default', () => {
      const source = 'let x // This is a comment\nlet y';
      const tokens = tokenize(source);

      // Should only have let, x, let, y, EOF (newlines are now skipped)
      expect(tokens.length).toBe(5);
      expect(tokens[0].type).toBe(TokenType.LET);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.LET);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[4].type).toBe(TokenType.EOF);
    });
  });

  describe('Block Comments', () => {
    it('should skip block comments by default', () => {
      const source = 'let x /* This is a block comment */ let y';
      const tokens = tokenize(source);

      // Should only have let, x, let, y, EOF
      expect(tokens.length).toBe(5);
      expect(tokens[0].type).toBe(TokenType.LET);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.LET);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[4].type).toBe(TokenType.EOF);
    });
  });
});