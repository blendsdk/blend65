/**
 * ExpressionParser Tests
 *
 * Tests expression parsing capabilities including:
 * - Primary expressions (literals, identifiers, parenthesized)
 * - Binary expressions with proper precedence
 * - Number format parsing (decimal, hex, binary)
 * - Pratt parser infrastructure
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Token, TokenType } from '../../lexer/types.js';
import { ExpressionParser } from '../../parser/expressions.js';
import {
  BinaryExpression,
  IdentifierExpression,
  LiteralExpression,
  DiagnosticCode,
} from '../../ast/index.js';

// Create a concrete test implementation of ExpressionParser
class TestExpressionParser extends ExpressionParser {
  // Expose protected methods for testing
  public testParsePrimaryExpression() {
    return this.parsePrimaryExpression();
  }

  public testParseNumberValue(value: string) {
    return this.parseNumberValue(value);
  }

  public testParseExpression(minPrecedence?: number) {
    return this.parseExpression(minPrecedence);
  }

  public testGetCurrentPrecedence() {
    return this.getCurrentPrecedence();
  }

  public testIsBinaryOp() {
    return this.isBinaryOp();
  }

  public testIsRightAssoc(tokenType: TokenType) {
    return this.isRightAssoc(tokenType);
  }
}

// Helper to create test tokens
function createToken(type: TokenType, value: string, line = 1, column = 1): Token {
  return {
    type,
    value,
    start: { line, column, offset: column },
    end: { line, column: column + value.length, offset: column + value.length },
  };
}

describe('ExpressionParser', () => {
  let parser: TestExpressionParser;

  describe('Number Value Parsing', () => {
    beforeEach(() => {
      parser = new TestExpressionParser([createToken(TokenType.EOF, '')]);
    });

    it('parses decimal numbers', () => {
      expect(parser.testParseNumberValue('42')).toBe(42);
      expect(parser.testParseNumberValue('255')).toBe(255);
      expect(parser.testParseNumberValue('0')).toBe(0);
    });

    it('parses hex numbers with $ prefix', () => {
      expect(parser.testParseNumberValue('$D020')).toBe(0xd020);
      expect(parser.testParseNumberValue('$FF')).toBe(255);
      expect(parser.testParseNumberValue('$00')).toBe(0);
    });

    it('parses hex numbers with 0x prefix', () => {
      expect(parser.testParseNumberValue('0xD020')).toBe(0xd020);
      expect(parser.testParseNumberValue('0xFF')).toBe(255);
      expect(parser.testParseNumberValue('0x00')).toBe(0);
    });

    it('parses binary numbers with 0b prefix', () => {
      expect(parser.testParseNumberValue('0b1010')).toBe(10);
      expect(parser.testParseNumberValue('0b11111111')).toBe(255);
      expect(parser.testParseNumberValue('0b00000000')).toBe(0);
    });
  });

  describe('Primary Expression Parsing', () => {
    it('parses number literals', () => {
      const tokens = [createToken(TokenType.NUMBER, '42'), createToken(TokenType.EOF, '')];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParsePrimaryExpression();
      expect(expr).toBeInstanceOf(LiteralExpression);
      expect((expr as LiteralExpression).getValue()).toBe(42);
    });

    it('parses hex number literals', () => {
      const tokens = [createToken(TokenType.NUMBER, '$D020'), createToken(TokenType.EOF, '')];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParsePrimaryExpression();
      expect(expr).toBeInstanceOf(LiteralExpression);
      expect((expr as LiteralExpression).getValue()).toBe(0xd020);
    });

    it('parses string literals', () => {
      const tokens = [
        createToken(TokenType.STRING_LITERAL, 'hello'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParsePrimaryExpression();
      expect(expr).toBeInstanceOf(LiteralExpression);
      expect((expr as LiteralExpression).getValue()).toBe('hello');
    });

    it('parses boolean literals', () => {
      const trueTokens = [
        createToken(TokenType.BOOLEAN_LITERAL, 'true'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestExpressionParser(trueTokens);

      const trueExpr = parser.testParsePrimaryExpression();
      expect(trueExpr).toBeInstanceOf(LiteralExpression);
      expect((trueExpr as LiteralExpression).getValue()).toBe(true);

      const falseTokens = [
        createToken(TokenType.BOOLEAN_LITERAL, 'false'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestExpressionParser(falseTokens);

      const falseExpr = parser.testParsePrimaryExpression();
      expect(falseExpr).toBeInstanceOf(LiteralExpression);
      expect((falseExpr as LiteralExpression).getValue()).toBe(false);
    });

    it('parses identifier expressions', () => {
      const tokens = [createToken(TokenType.IDENTIFIER, 'myVar'), createToken(TokenType.EOF, '')];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParsePrimaryExpression();
      expect(expr).toBeInstanceOf(IdentifierExpression);
      expect((expr as IdentifierExpression).getName()).toBe('myVar');
    });

    it('parses parenthesized expressions', () => {
      const tokens = [
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.NUMBER, '42'),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParsePrimaryExpression();
      expect(expr).toBeInstanceOf(LiteralExpression);
      expect((expr as LiteralExpression).getValue()).toBe(42);
    });

    it('handles missing closing parenthesis', () => {
      const tokens = [
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.NUMBER, '42'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestExpressionParser(tokens);

      parser.testParsePrimaryExpression();
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPECTED_TOKEN);
    });

    it('reports error for unexpected tokens', () => {
      const tokens = [createToken(TokenType.SEMICOLON, ';'), createToken(TokenType.EOF, '')];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParsePrimaryExpression();
      expect(expr).toBeInstanceOf(LiteralExpression);
      expect((expr as LiteralExpression).getValue()).toBe(0); // Dummy value

      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.UNEXPECTED_TOKEN);
    });
  });

  describe('Binary Expression Parsing', () => {
    it('parses simple binary expressions', () => {
      const tokens = [
        createToken(TokenType.NUMBER, '2'),
        createToken(TokenType.PLUS, '+'),
        createToken(TokenType.NUMBER, '3'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParseExpression();
      expect(expr).toBeInstanceOf(BinaryExpression);

      const binExpr = expr as BinaryExpression;
      expect(binExpr.getOperator()).toBe(TokenType.PLUS);
      expect((binExpr.getLeft() as LiteralExpression).getValue()).toBe(2);
      expect((binExpr.getRight() as LiteralExpression).getValue()).toBe(3);
    });

    it('handles operator precedence correctly', () => {
      // 2 + 3 * 4 should be parsed as 2 + (3 * 4)
      const tokens = [
        createToken(TokenType.NUMBER, '2'),
        createToken(TokenType.PLUS, '+'),
        createToken(TokenType.NUMBER, '3'),
        createToken(TokenType.MULTIPLY, '*'),
        createToken(TokenType.NUMBER, '4'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParseExpression();
      expect(expr).toBeInstanceOf(BinaryExpression);

      const addExpr = expr as BinaryExpression;
      expect(addExpr.getOperator()).toBe(TokenType.PLUS);
      expect((addExpr.getLeft() as LiteralExpression).getValue()).toBe(2);

      const rightSide = addExpr.getRight() as BinaryExpression;
      expect(rightSide).toBeInstanceOf(BinaryExpression);
      expect(rightSide.getOperator()).toBe(TokenType.MULTIPLY);
      expect((rightSide.getLeft() as LiteralExpression).getValue()).toBe(3);
      expect((rightSide.getRight() as LiteralExpression).getValue()).toBe(4);
    });

    it('handles left associativity', () => {
      // 10 - 5 - 2 should be parsed as (10 - 5) - 2
      const tokens = [
        createToken(TokenType.NUMBER, '10'),
        createToken(TokenType.MINUS, '-'),
        createToken(TokenType.NUMBER, '5'),
        createToken(TokenType.MINUS, '-'),
        createToken(TokenType.NUMBER, '2'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParseExpression();
      expect(expr).toBeInstanceOf(BinaryExpression);

      const rightSubExpr = expr as BinaryExpression;
      expect(rightSubExpr.getOperator()).toBe(TokenType.MINUS);
      expect((rightSubExpr.getRight() as LiteralExpression).getValue()).toBe(2);

      const leftSubExpr = rightSubExpr.getLeft() as BinaryExpression;
      expect(leftSubExpr).toBeInstanceOf(BinaryExpression);
      expect(leftSubExpr.getOperator()).toBe(TokenType.MINUS);
      expect((leftSubExpr.getLeft() as LiteralExpression).getValue()).toBe(10);
      expect((leftSubExpr.getRight() as LiteralExpression).getValue()).toBe(5);
    });

    it('handles complex precedence with multiple operators', () => {
      // a + b * c - d should be parsed as (a + (b * c)) - d
      const tokens = [
        createToken(TokenType.IDENTIFIER, 'a'),
        createToken(TokenType.PLUS, '+'),
        createToken(TokenType.IDENTIFIER, 'b'),
        createToken(TokenType.MULTIPLY, '*'),
        createToken(TokenType.IDENTIFIER, 'c'),
        createToken(TokenType.MINUS, '-'),
        createToken(TokenType.IDENTIFIER, 'd'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParseExpression();
      expect(expr).toBeInstanceOf(BinaryExpression);

      const topExpr = expr as BinaryExpression;
      expect(topExpr.getOperator()).toBe(TokenType.MINUS);
      expect((topExpr.getRight() as IdentifierExpression).getName()).toBe('d');

      // Left side should be (a + (b * c))
      const addExpr = topExpr.getLeft() as BinaryExpression;
      expect(addExpr.getOperator()).toBe(TokenType.PLUS);
      expect((addExpr.getLeft() as IdentifierExpression).getName()).toBe('a');

      // Right side of addition should be (b * c)
      const mulExpr = addExpr.getRight() as BinaryExpression;
      expect(mulExpr.getOperator()).toBe(TokenType.MULTIPLY);
      expect((mulExpr.getLeft() as IdentifierExpression).getName()).toBe('b');
      expect((mulExpr.getRight() as IdentifierExpression).getName()).toBe('c');
    });
  });

  describe('Precedence and Associativity Utilities', () => {
    beforeEach(() => {
      parser = new TestExpressionParser([
        createToken(TokenType.PLUS, '+'),
        createToken(TokenType.EOF, ''),
      ]);
    });

    it('getCurrentPrecedence returns correct precedence', () => {
      const precedence = parser.testGetCurrentPrecedence();
      expect(precedence).toBeGreaterThan(0); // PLUS should have precedence
    });

    it('isBinaryOp detects binary operators', () => {
      expect(parser.testIsBinaryOp()).toBe(true);
    });

    it('isBinaryOp returns false for non-operators', () => {
      const nonOpParser = new TestExpressionParser([
        createToken(TokenType.IDENTIFIER, 'x'),
        createToken(TokenType.EOF, ''),
      ]);
      expect(nonOpParser.testIsBinaryOp()).toBe(false);
    });

    it('isRightAssoc detects right-associative operators', () => {
      // Assignment operators are typically right-associative
      expect(parser.testIsRightAssoc(TokenType.ASSIGN)).toBe(true);
      // Arithmetic operators are typically left-associative
      expect(parser.testIsRightAssoc(TokenType.PLUS)).toBe(false);
    });
  });

  describe('Complex Expression Parsing', () => {
    it('parses nested parenthesized expressions', () => {
      // ((2 + 3) * 4)
      const tokens = [
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.NUMBER, '2'),
        createToken(TokenType.PLUS, '+'),
        createToken(TokenType.NUMBER, '3'),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.MULTIPLY, '*'),
        createToken(TokenType.NUMBER, '4'),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParseExpression();
      expect(expr).toBeInstanceOf(BinaryExpression);

      const mulExpr = expr as BinaryExpression;
      expect(mulExpr.getOperator()).toBe(TokenType.MULTIPLY);
      expect((mulExpr.getRight() as LiteralExpression).getValue()).toBe(4);

      const addExpr = mulExpr.getLeft() as BinaryExpression;
      expect(addExpr.getOperator()).toBe(TokenType.PLUS);
      expect((addExpr.getLeft() as LiteralExpression).getValue()).toBe(2);
      expect((addExpr.getRight() as LiteralExpression).getValue()).toBe(3);
    });

    it('handles expressions with identifiers and literals', () => {
      // counter + 1
      const tokens = [
        createToken(TokenType.IDENTIFIER, 'counter'),
        createToken(TokenType.PLUS, '+'),
        createToken(TokenType.NUMBER, '1'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParseExpression();
      expect(expr).toBeInstanceOf(BinaryExpression);

      const binExpr = expr as BinaryExpression;
      expect(binExpr.getOperator()).toBe(TokenType.PLUS);
      expect((binExpr.getLeft() as IdentifierExpression).getName()).toBe('counter');
      expect((binExpr.getRight() as LiteralExpression).getValue()).toBe(1);
    });

    it('handles boolean expressions', () => {
      // true && false
      const tokens = [
        createToken(TokenType.BOOLEAN_LITERAL, 'true'),
        createToken(TokenType.AND, '&&'),
        createToken(TokenType.BOOLEAN_LITERAL, 'false'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParseExpression();
      expect(expr).toBeInstanceOf(BinaryExpression);

      const binExpr = expr as BinaryExpression;
      expect(binExpr.getOperator()).toBe(TokenType.AND);
      expect((binExpr.getLeft() as LiteralExpression).getValue()).toBe(true);
      expect((binExpr.getRight() as LiteralExpression).getValue()).toBe(false);
    });

    it('handles comparison expressions', () => {
      // x == 5
      const tokens = [
        createToken(TokenType.IDENTIFIER, 'x'),
        createToken(TokenType.EQUAL, '=='),
        createToken(TokenType.NUMBER, '5'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParseExpression();
      expect(expr).toBeInstanceOf(BinaryExpression);

      const binExpr = expr as BinaryExpression;
      expect(binExpr.getOperator()).toBe(TokenType.EQUAL);
      expect((binExpr.getLeft() as IdentifierExpression).getName()).toBe('x');
      expect((binExpr.getRight() as LiteralExpression).getValue()).toBe(5);
    });
  });

  describe('Error Handling in Expressions', () => {
    it('handles malformed parenthesized expressions', () => {
      const tokens = [
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.NUMBER, '42'),
        createToken(TokenType.EOF, ''), // Missing closing paren
      ];
      parser = new TestExpressionParser(tokens);

      parser.testParsePrimaryExpression();
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPECTED_TOKEN);
    });

    it('handles empty expressions gracefully', () => {
      const tokens = [createToken(TokenType.SEMICOLON, ';'), createToken(TokenType.EOF, '')];
      parser = new TestExpressionParser(tokens);

      const expr = parser.testParsePrimaryExpression();
      expect(expr).toBeInstanceOf(LiteralExpression);

      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.UNEXPECTED_TOKEN);
    });
  });
});
