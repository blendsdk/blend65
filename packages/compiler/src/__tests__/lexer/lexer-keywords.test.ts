import { describe, expect, it } from 'vitest';
import { tokenize } from '../../lexer/index.js';
import { TokenType } from '../../lexer/types.js';

/**
 * Lexer keyword recognition tests - C-style syntax (curly braces)
 *
 * v2: No changes needed - these tests don't involve @map.
 */
describe('Blend65Lexer - Keywords', () => {
  describe('Module System Keywords', () => {
    it('should recognize module system keywords', () => {
      const source = 'module import export from';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.MODULE);
      expect(tokens[1].type).toBe(TokenType.IMPORT);
      expect(tokens[2].type).toBe(TokenType.EXPORT);
      expect(tokens[3].type).toBe(TokenType.FROM);
    });
  });

  describe('Function and Control Flow Keywords', () => {
    it('should recognize function keyword', () => {
      const source = 'function';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.FUNCTION);
    });

    it('should recognize C-style control flow keywords', () => {
      // C-style syntax uses braces, not end/then keywords
      const source = 'if else while for switch case';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.IF);
      expect(tokens[1].type).toBe(TokenType.ELSE);
      expect(tokens[2].type).toBe(TokenType.WHILE);
      expect(tokens[3].type).toBe(TokenType.FOR);
      expect(tokens[4].type).toBe(TokenType.SWITCH);
      expect(tokens[5].type).toBe(TokenType.CASE);
    });

    it('should recognize return and do keywords', () => {
      const source = 'return do';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.RETURN);
      expect(tokens[1].type).toBe(TokenType.DO);
    });
  });

  describe('Storage Class Keywords', () => {
    it('should recognize storage class keywords', () => {
      const source = '@zp @ram @data const';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.ZP);
      expect(tokens[1].type).toBe(TokenType.RAM);
      expect(tokens[2].type).toBe(TokenType.DATA);
      expect(tokens[3].type).toBe(TokenType.CONST);
    });
  });

  describe('Primitive Type Keywords', () => {
    it('should recognize primitive type keywords', () => {
      const source = 'byte word void';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.BYTE);
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[2].type).toBe(TokenType.VOID);
    });
  });

  describe('Logical Operators', () => {
    it('should recognize logical operators as keywords', () => {
      const source = '&& || !';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.AND);
      expect(tokens[1].type).toBe(TokenType.OR);
      expect(tokens[2].type).toBe(TokenType.NOT);
    });
  });

  describe('v0.2 Keywords', () => {
    it('should recognize v0.2 control flow keywords', () => {
      const source = 'break continue default enum';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.BREAK);
      expect(tokens[0].value).toBe('break');
      expect(tokens[1].type).toBe(TokenType.CONTINUE);
      expect(tokens[1].value).toBe('continue');
      expect(tokens[2].type).toBe(TokenType.DEFAULT);
      expect(tokens[2].value).toBe('default');
      expect(tokens[3].type).toBe(TokenType.ENUM);
      expect(tokens[3].value).toBe('enum');
      expect(tokens[4].type).toBe(TokenType.EOF);
    });

    it('should distinguish v0.2 keywords from identifiers', () => {
      const source = 'break breakable continue continuous default defaultValue enum enumeration';
      const tokens = tokenize(source);

      // Keywords should be recognized as such
      expect(tokens[0].type).toBe(TokenType.BREAK);
      expect(tokens[0].value).toBe('break');
      expect(tokens[2].type).toBe(TokenType.CONTINUE);
      expect(tokens[2].value).toBe('continue');
      expect(tokens[4].type).toBe(TokenType.DEFAULT);
      expect(tokens[4].value).toBe('default');
      expect(tokens[6].type).toBe(TokenType.ENUM);
      expect(tokens[6].value).toBe('enum');

      // Similar words should be identifiers
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('breakable');
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('continuous');
      expect(tokens[5].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[5].value).toBe('defaultValue');
      expect(tokens[7].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[7].value).toBe('enumeration');
    });

    it('should handle v0.2 keywords in string literals', () => {
      const source = '"break continue default enum" \'loop break continue\'';
      const tokens = tokenize(source);

      // Keywords inside strings should remain as string content
      expect(tokens[0].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[0].value).toBe('break continue default enum');
      expect(tokens[1].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[1].value).toBe('loop break continue');
      expect(tokens[2].type).toBe(TokenType.EOF);
    });

    it('should handle v0.2 keywords with different casing', () => {
      const source =
        'BREAK Break bReAk CONTINUE Continue cOnTiNuE DEFAULT Default dEfAuLt ENUM Enum eNuM';
      const tokens = tokenize(source);

      // All variations should be treated as identifiers (case-sensitive keywords)
      for (let i = 0; i < 12; i++) {
        expect(tokens[i].type).toBe(TokenType.IDENTIFIER);
      }
      expect(tokens[12].type).toBe(TokenType.EOF);
    });
  });
});