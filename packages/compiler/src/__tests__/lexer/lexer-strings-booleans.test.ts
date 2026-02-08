import { describe, expect, it } from 'vitest';
import { tokenize } from '../../lexer/index.js';
import { TokenType } from '../../lexer/types.js';

/**
 * Lexer string and boolean literal tests
 *
 * v2: No changes needed - these tests don't involve @map.
 */
describe('Blend65Lexer - Strings and Booleans', () => {
  describe('String Literals', () => {
    it('should parse double-quoted strings', () => {
      const source = '"Hello, World!"';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[0].value).toBe('Hello, World!');
    });

    it('should parse single-quoted strings', () => {
      const source = "'Hello, World!'";
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[0].value).toBe('Hello, World!');
    });

    it('should handle escape sequences', () => {
      const source = '"Hello\\nWorld\\t!"';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[0].value).toBe('Hello\nWorld\t!');
    });
  });

  describe('Boolean Literals', () => {
    it('should recognize boolean literals', () => {
      const source = 'true false';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.BOOLEAN_LITERAL);
      expect(tokens[0].value).toBe('true');
      expect(tokens[1].type).toBe(TokenType.BOOLEAN_LITERAL);
      expect(tokens[1].value).toBe('false');
    });
  });
});