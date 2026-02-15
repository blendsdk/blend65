import { describe, expect, it } from 'vitest';
import { tokenize } from '../../lexer/index.js';
import { TokenType } from '../../lexer/types.js';

/**
 * Lexer tests for alignment-related tokens.
 *
 * Tests the recognition of:
 * - Alignment sugar keywords: @sprite, @charset, @screen, @bitmap, @page
 * - The `align` keyword (used inside @data(align: N) syntax)
 * - Interaction with existing storage class tokens
 */
describe('Blend65Lexer - Alignment Tokens', () => {
  describe('Alignment Sugar Keywords', () => {
    it('should recognize @sprite as SPRITE token', () => {
      const tokens = tokenize('@sprite');
      expect(tokens[0].type).toBe(TokenType.SPRITE);
      expect(tokens[0].value).toBe('@sprite');
    });

    it('should recognize @charset as CHARSET token', () => {
      const tokens = tokenize('@charset');
      expect(tokens[0].type).toBe(TokenType.CHARSET);
      expect(tokens[0].value).toBe('@charset');
    });

    it('should recognize @screen as SCREEN token', () => {
      const tokens = tokenize('@screen');
      expect(tokens[0].type).toBe(TokenType.SCREEN);
      expect(tokens[0].value).toBe('@screen');
    });

    it('should recognize @bitmap as BITMAP token', () => {
      const tokens = tokenize('@bitmap');
      expect(tokens[0].type).toBe(TokenType.BITMAP);
      expect(tokens[0].value).toBe('@bitmap');
    });

    it('should recognize @page as PAGE token', () => {
      const tokens = tokenize('@page');
      expect(tokens[0].type).toBe(TokenType.PAGE);
      expect(tokens[0].value).toBe('@page');
    });

    it('should recognize all alignment sugar keywords in sequence', () => {
      const source = '@sprite @charset @screen @bitmap @page';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.SPRITE);
      expect(tokens[0].value).toBe('@sprite');
      expect(tokens[1].type).toBe(TokenType.CHARSET);
      expect(tokens[1].value).toBe('@charset');
      expect(tokens[2].type).toBe(TokenType.SCREEN);
      expect(tokens[2].value).toBe('@screen');
      expect(tokens[3].type).toBe(TokenType.BITMAP);
      expect(tokens[3].value).toBe('@bitmap');
      expect(tokens[4].type).toBe(TokenType.PAGE);
      expect(tokens[4].value).toBe('@page');
      expect(tokens[5].type).toBe(TokenType.EOF);
    });
  });

  describe('Align Keyword', () => {
    it('should recognize align as ALIGN token', () => {
      const tokens = tokenize('align');
      expect(tokens[0].type).toBe(TokenType.ALIGN);
      expect(tokens[0].value).toBe('align');
    });

    it('should distinguish align from identifiers starting with align', () => {
      const tokens = tokenize('align alignment aligned');
      expect(tokens[0].type).toBe(TokenType.ALIGN);
      expect(tokens[0].value).toBe('align');
      // "alignment" and "aligned" are identifiers, not the align keyword
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('alignment');
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('aligned');
    });
  });

  describe('Sugar Keywords with Variable Declaration Context', () => {
    it('should tokenize @sprite const s: byte[] correctly', () => {
      const source = '@sprite const s: byte[];';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.SPRITE);
      expect(tokens[0].value).toBe('@sprite');
      expect(tokens[1].type).toBe(TokenType.CONST);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('s');
      expect(tokens[3].type).toBe(TokenType.COLON);
      expect(tokens[4].type).toBe(TokenType.BYTE);
      expect(tokens[5].type).toBe(TokenType.LEFT_BRACKET);
      expect(tokens[6].type).toBe(TokenType.RIGHT_BRACKET);
      expect(tokens[7].type).toBe(TokenType.SEMICOLON);
    });

    it('should tokenize @page let table: byte[256] correctly', () => {
      const source = '@page let table: byte[256];';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.PAGE);
      expect(tokens[0].value).toBe('@page');
      expect(tokens[1].type).toBe(TokenType.LET);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('table');
    });
  });

  describe('@data(align: N) Token Sequence', () => {
    it('should tokenize @data(align: 64) as separate tokens', () => {
      const source = '@data(align: 64)';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.DATA);
      expect(tokens[0].value).toBe('@data');
      expect(tokens[1].type).toBe(TokenType.LEFT_PAREN);
      expect(tokens[2].type).toBe(TokenType.ALIGN);
      expect(tokens[2].value).toBe('align');
      expect(tokens[3].type).toBe(TokenType.COLON);
      expect(tokens[4].type).toBe(TokenType.NUMBER);
      expect(tokens[4].value).toBe('64');
      expect(tokens[5].type).toBe(TokenType.RIGHT_PAREN);
      expect(tokens[6].type).toBe(TokenType.EOF);
    });

    it('should tokenize @ram(align: 256) as separate tokens', () => {
      const source = '@ram(align: 256)';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.RAM);
      expect(tokens[0].value).toBe('@ram');
      expect(tokens[1].type).toBe(TokenType.LEFT_PAREN);
      expect(tokens[2].type).toBe(TokenType.ALIGN);
      expect(tokens[3].type).toBe(TokenType.COLON);
      expect(tokens[4].type).toBe(TokenType.NUMBER);
      expect(tokens[4].value).toBe('256');
      expect(tokens[5].type).toBe(TokenType.RIGHT_PAREN);
    });

    it('should tokenize @data(align: 8192) in full declaration context', () => {
      const source = '@data(align: 8192) const bitmapData: byte[] = [0, 1, 2];';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.DATA);
      expect(tokens[1].type).toBe(TokenType.LEFT_PAREN);
      expect(tokens[2].type).toBe(TokenType.ALIGN);
      expect(tokens[3].type).toBe(TokenType.COLON);
      expect(tokens[4].type).toBe(TokenType.NUMBER);
      expect(tokens[4].value).toBe('8192');
      expect(tokens[5].type).toBe(TokenType.RIGHT_PAREN);
      expect(tokens[6].type).toBe(TokenType.CONST);
      expect(tokens[7].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[7].value).toBe('bitmapData');
    });
  });

  describe('Existing Storage Classes Still Work', () => {
    it('should still recognize @zp, @ram, @data correctly', () => {
      const source = '@zp @ram @data';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.ZP);
      expect(tokens[0].value).toBe('@zp');
      expect(tokens[1].type).toBe(TokenType.RAM);
      expect(tokens[1].value).toBe('@ram');
      expect(tokens[2].type).toBe(TokenType.DATA);
      expect(tokens[2].value).toBe('@data');
    });

    it('should still handle unknown @ keywords as AT token', () => {
      const tokens = tokenize('@unknown');
      expect(tokens[0].type).toBe(TokenType.AT);
      expect(tokens[0].value).toBe('@');
      // "unknown" is parsed as a separate identifier
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('unknown');
    });
  });

  describe('Edge Cases', () => {
    it('should handle sugar keywords with mixed casing as unknown @ + identifier', () => {
      // @Sprite (capital S) should NOT be recognized — keywords are case-sensitive
      const tokens = tokenize('@Sprite');
      expect(tokens[0].type).toBe(TokenType.AT);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('Sprite');
    });

    it('should handle @sprite followed by ( as separate tokens', () => {
      // @sprite( — the ( should be a separate LEFT_PAREN token
      const tokens = tokenize('@sprite(');
      expect(tokens[0].type).toBe(TokenType.SPRITE);
      expect(tokens[0].value).toBe('@sprite');
      expect(tokens[1].type).toBe(TokenType.LEFT_PAREN);
    });

    it('should handle align inside string literal as string content', () => {
      const tokens = tokenize('"align"');
      expect(tokens[0].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[0].value).toBe('align');
    });

    it('should track correct position for sugar keywords', () => {
      const source = '@sprite';
      const tokens = tokenize(source);
      // @sprite starts at column 1 and spans 7 characters
      expect(tokens[0].start.line).toBe(1);
      expect(tokens[0].start.column).toBe(1);
    });

    it('should handle sugar keywords on different lines', () => {
      const source = '@sprite\n@charset';
      const tokens = tokenize(source);
      expect(tokens[0].type).toBe(TokenType.SPRITE);
      expect(tokens[0].start.line).toBe(1);
      expect(tokens[1].type).toBe(TokenType.CHARSET);
      expect(tokens[1].start.line).toBe(2);
    });
  });
});
