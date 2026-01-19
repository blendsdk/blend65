import { describe, expect, it } from 'vitest';
import { Lexer, tokenize, TokenType } from '../../lexer/index.js';

/**
 * Additional lexer tests that focus on source metadata, configuration toggles,
 * and diagnostic messaging. These scenarios complement the existing suites by
 * locking down behavior that is easy to regress inadvertently (e.g., comment
 * retention and newline normalization across different operating systems).
 */
describe('Blend65Lexer Additional Coverage', () => {
  describe('Token metadata accuracy', () => {
    it('should track start/end positions for multi-line string literals', () => {
      // Create a literal with real newline characters to validate SourcePosition bookkeeping.
      const source = `"alpha line\nbeta line\ngamma line"`;
      const tokens = tokenize(source);
      const stringToken = tokens[0];

      expect(stringToken.type).toBe(TokenType.STRING_LITERAL);
      expect(stringToken.start.line).toBe(1);
      expect(stringToken.start.column).toBe(1);
      expect(stringToken.end.line).toBe(3);
      expect(stringToken.value).toBe('alpha line\nbeta line\ngamma line');
    });

    it('should keep block comment metadata when comments are retained', () => {
      // Run the lexer with skipComments disabled so we can assert on BLOCK_COMMENT tokens.
      const source = `/* documentation header\n   describing the symbol */\nlet ready: byte = 1`;
      const lexer = new Lexer(source, { skipComments: false });
      const tokens = lexer.tokenize();
      const blockCommentToken = tokens.find(token => token.type === TokenType.BLOCK_COMMENT);

      expect(blockCommentToken).toBeDefined();
      expect(blockCommentToken?.start.line).toBe(1);
      expect(blockCommentToken?.end.line).toBe(2);
      expect(blockCommentToken?.value.startsWith('/*')).toBe(true);
      // Newlines are now treated as trivial whitespace (no NEWLINE tokens emitted)
      expect(tokens.some(token => token.type === TokenType.NEWLINE)).toBe(false);
    });
  });

  describe('Comment retention toggle', () => {
    it('should emit line comments when skipComments is false and omit them otherwise', () => {
      const source = 'let ready // inline explanation';

      const verboseTokens = new Lexer(source, { skipComments: false }).tokenize();
      expect(verboseTokens.some(token => token.type === TokenType.LINE_COMMENT)).toBe(true);

      const defaultTokens = tokenize(source);
      expect(defaultTokens.some(token => token.type === TokenType.LINE_COMMENT)).toBe(false);
    });
  });

  describe('Newline normalization', () => {
    it('should skip CRLF sequences as trivial whitespace', () => {
      // Use Windows-style line endings to guard against platform-specific regressions.
      // Newlines are now treated as trivial whitespace (semicolons separate statements)
      const source = 'let a\r\nlet b\r\nlet c';
      const tokens = tokenize(source);
      const newlineTokens = tokens.filter(token => token.type === TokenType.NEWLINE);

      // No NEWLINE tokens should be emitted
      expect(newlineTokens).toHaveLength(0);

      // Tokens should be: let, a, let, b, let, c, EOF
      expect(tokens[0].type).toBe(TokenType.LET);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('a');
      expect(tokens[2].type).toBe(TokenType.LET);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('b');
      expect(tokens[4].type).toBe(TokenType.LET);
      expect(tokens[5].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[5].value).toBe('c');
      expect(tokens[6].type).toBe(TokenType.EOF);
    });
  });

  describe('Whitespace-free operator adjacency', () => {
    it('should tokenize tightly packed control-flow and operators', () => {
      const source = 'if(x==1)then\nnext i';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.IF);
      expect(tokens[1].type).toBe(TokenType.LEFT_PAREN);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('x');
      expect(tokens[3].type).toBe(TokenType.EQUAL);
      expect(tokens[4].type).toBe(TokenType.NUMBER);
      expect(tokens[4].value).toBe('1');
      expect(tokens[5].type).toBe(TokenType.RIGHT_PAREN);
      expect(tokens[6].type).toBe(TokenType.THEN);
    });
  });

  describe('Unicode diagnostics', () => {
    it('should surface descriptive errors for non-ASCII identifiers', () => {
      expect(() => tokenize('σcore')).toThrow("Unexpected character 'σ' at line 1, column 1");
    });
  });

  describe('Literal diagnostic messaging', () => {
    it('should report line and column for unterminated hex literals', () => {
      expect(() => tokenize('$')).toThrow("Unexpected character '$' at line 1, column 1");
    });
  });
});
