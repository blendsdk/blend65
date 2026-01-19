import { describe, expect, it } from 'vitest';
import { tokenize, TokenType } from '../../lexer/index.js';

describe('Blend65Lexer Advanced Edge Cases', () => {
  describe('Storage class interleaving', () => {
    it('should tokenize mixed storage-decorated and plain declarations', () => {
      const source = `@zp let counter: byte
let score: byte
@ram const buffer: word = 1`;

      const tokens = tokenize(source);

      const zpIndex = tokens.findIndex(token => token.type === TokenType.ZP);
      const ramIndex = tokens.findIndex(token => token.type === TokenType.RAM);
      const secondLetIndex = tokens.findIndex(
        (token, index) => token.type === TokenType.LET && index > 2
      );

      // Ensure the storage decorators survive tokenization
      expect(zpIndex).toBe(0);
      expect(ramIndex).toBeGreaterThan(zpIndex);
      // Confirm the undecorated middle declaration still emits a LET token
      expect(secondLetIndex).toBeGreaterThan(zpIndex);
    });
  });

  describe('Array literal formatting', () => {
    it('should keep bracket tokens when array initializer spans lines', () => {
      const source = `let table: byte[4] = [0,
  1,
  2,
  3]`;

      const tokens = tokenize(source);

      const leftBracketCount = tokens.filter(token => token.type === TokenType.LEFT_BRACKET).length;
      const rightBracketCount = tokens.filter(
        token => token.type === TokenType.RIGHT_BRACKET
      ).length;
      const newlineCount = tokens.filter(token => token.type === TokenType.NEWLINE).length;

      // Type dimension + initializer opening bracket == 2 LEFT_BRACKET tokens
      expect(leftBracketCount).toBe(2);
      // Both brackets should close cleanly despite embedded newlines
      expect(rightBracketCount).toBe(2);
      // Newlines are now skipped as trivial whitespace (semicolons separate statements)
      expect(newlineCount).toBe(0);

      // Verify array elements are tokenized correctly
      const numberTokens = tokens.filter(token => token.type === TokenType.NUMBER);
      expect(numberTokens).toHaveLength(5); // 4 (array size) + 0,1,2,3 (4 elements) = but array size is separate
      expect(numberTokens[0].value).toBe('4'); // Array size
      expect(numberTokens[1].value).toBe('0');
      expect(numberTokens[2].value).toBe('1');
      expect(numberTokens[3].value).toBe('2');
      expect(numberTokens[4].value).toBe('3');
    });
  });

  describe('Nested match blocks', () => {
    it('should tokenize match statements contained inside other matches', () => {
      const source = `match systemState
  case 0:
    match currentScene
      case 1:
        handleGameplay()
      default:
        resetScene()
    end match
  default:
    handleIdle()
end match`;

      const tokens = tokenize(source);

      const matchCount = tokens.filter(token => token.type === TokenType.MATCH).length;
      const defaultCount = tokens.filter(token => token.type === TokenType.DEFAULT).length;

      // Each match block contributes an opening `match` and a closing `end match`
      expect(matchCount).toBe(4);
      // Both default clauses should be detected independently
      expect(defaultCount).toBe(2);
    });
  });

  describe('Callback keyword ambiguity', () => {
    it('should distinguish callback as both decorator and type', () => {
      const source = `callback function rasterIRQ(): void
end function
let callbackFn: callback = rasterIRQ`;

      const tokens = tokenize(source);

      const callbackKeywordCount = tokens.filter(token => token.type === TokenType.CALLBACK).length;
      const functionIndex = tokens.findIndex(token => token.type === TokenType.FUNCTION);
      const letIndex = tokens.findIndex(token => token.type === TokenType.LET);

      // One callback token for the decorator, one for the type annotation
      expect(callbackKeywordCount).toBe(2);
      // Sanity-check surrounding keywords are present
      expect(functionIndex).toBeGreaterThan(-1);
      expect(letIndex).toBeGreaterThan(functionIndex);
    });
  });

  describe('Operator adjacency without whitespace', () => {
    it('should emit compound assignment operators even when packed', () => {
      const source = `value<<=1
mask>>=2
acc&=value
flags|=mask`;

      const tokens = tokenize(source);

      const leftShiftAssignIndex = tokens.findIndex(
        token => token.type === TokenType.LEFT_SHIFT_ASSIGN
      );
      const rightShiftAssignIndex = tokens.findIndex(
        token => token.type === TokenType.RIGHT_SHIFT_ASSIGN
      );
      const bitwiseAndAssignIndex = tokens.findIndex(
        token => token.type === TokenType.BITWISE_AND_ASSIGN
      );
      const bitwiseOrAssignIndex = tokens.findIndex(
        token => token.type === TokenType.BITWISE_OR_ASSIGN
      );

      // Each compound operator should be tokenized exactly once without whitespace padding
      expect(leftShiftAssignIndex).toBeGreaterThan(-1);
      expect(rightShiftAssignIndex).toBeGreaterThan(-1);
      expect(bitwiseAndAssignIndex).toBeGreaterThan(-1);
      expect(bitwiseOrAssignIndex).toBeGreaterThan(-1);
    });
  });

  describe('Unknown @ keyword handling', () => {
    it('should parse unknown @ keywords as AT + IDENTIFIER', () => {
      const tokens = tokenize('@rom let sprite: byte');

      expect(tokens[0].type).toBe(TokenType.AT);
      expect(tokens[0].value).toBe('@');
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('rom');
      expect(tokens[2].type).toBe(TokenType.LET);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('sprite');
    });

    it('should parse @ symbols embedded in statements as AT tokens', () => {
      const tokens = tokenize('let throttled = speed @rom boost');

      // Find the @ token and following identifier
      const atIndex = tokens.findIndex(token => token.type === TokenType.AT);
      expect(atIndex).toBeGreaterThan(-1);
      expect(tokens[atIndex].type).toBe(TokenType.AT);
      expect(tokens[atIndex].value).toBe('@');
      expect(tokens[atIndex + 1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[atIndex + 1].value).toBe('rom');
    });
  });
});
