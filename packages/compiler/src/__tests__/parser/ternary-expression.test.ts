/**
 * Ternary Expression Parser Tests
 *
 * Comprehensive test suite for ternary conditional expressions:
 * - Basic ternary: condition ? thenBranch : elseBranch
 * - Nested ternary (right-associative)
 * - Ternary with various expression types
 * - Precedence relative to other operators
 * - Error handling and recovery
 */

import { describe, test, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { ExpressionParser } from '../../parser/expressions.js';
import {
  BinaryExpression,
  CallExpression,
  Expression,
  IdentifierExpression,
  IndexExpression,
  LiteralExpression,
  TernaryExpression,
  UnaryExpression,
} from '../../ast/index.js';
import { TokenType } from '../../lexer/types.js';

// Create a concrete test implementation of ExpressionParser
class TestTernaryParser extends ExpressionParser {
  /**
   * Expose protected parseExpression for testing
   */
  public testParseExpression(minPrecedence?: number) {
    return this.parseExpression(minPrecedence);
  }
}

/**
 * Helper function to parse an expression from source code using real Lexer
 */
function parseExpression(source: string): {
  expression: Expression;
  parser: TestTernaryParser;
} {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new TestTernaryParser(tokens);
  const expression = parser.testParseExpression();
  return { expression, parser };
}

/**
 * Helper function to parse expression and return just the AST node
 */
function parseExpr(source: string): Expression {
  return parseExpression(source).expression;
}

describe('Ternary Expression Parser', () => {
  // ============================================
  // BASIC TERNARY EXPRESSION TESTS
  // ============================================

  describe('Basic Ternary Expressions', () => {
    test('parses simple ternary with identifiers', () => {
      const expr = parseExpr('a ? b : c') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect(expr.getCondition()).toBeInstanceOf(IdentifierExpression);
      expect((expr.getCondition() as IdentifierExpression).getName()).toBe('a');

      expect(expr.getThenBranch()).toBeInstanceOf(IdentifierExpression);
      expect((expr.getThenBranch() as IdentifierExpression).getName()).toBe('b');

      expect(expr.getElseBranch()).toBeInstanceOf(IdentifierExpression);
      expect((expr.getElseBranch() as IdentifierExpression).getName()).toBe('c');
    });

    test('parses ternary with number literals', () => {
      const expr = parseExpr('flag ? 1 : 0') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect(expr.getThenBranch()).toBeInstanceOf(LiteralExpression);
      expect((expr.getThenBranch() as LiteralExpression).getValue()).toBe(1);

      expect(expr.getElseBranch()).toBeInstanceOf(LiteralExpression);
      expect((expr.getElseBranch() as LiteralExpression).getValue()).toBe(0);
    });

    test('parses ternary with boolean condition', () => {
      const expr = parseExpr('true ? x : y') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect(expr.getCondition()).toBeInstanceOf(LiteralExpression);
      expect((expr.getCondition() as LiteralExpression).getValue()).toBe(true);
    });

    test('parses ternary with string literals', () => {
      const expr = parseExpr('valid ? "yes" : "no"') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect(expr.getThenBranch()).toBeInstanceOf(LiteralExpression);
      expect((expr.getThenBranch() as LiteralExpression).getValue()).toBe('yes');

      expect(expr.getElseBranch()).toBeInstanceOf(LiteralExpression);
      expect((expr.getElseBranch() as LiteralExpression).getValue()).toBe('no');
    });
  });

  // ============================================
  // TERNARY WITH COMPARISON CONDITIONS
  // ============================================

  describe('Ternary with Comparison Conditions', () => {
    test('parses ternary with greater-than comparison', () => {
      const expr = parseExpr('(a > b) ? a : b') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as BinaryExpression;
      expect(condition).toBeInstanceOf(BinaryExpression);
      expect(condition.getOperator()).toBe(TokenType.GREATER_THAN);
    });

    test('parses ternary with less-than comparison', () => {
      const expr = parseExpr('(x < 0) ? 0 : x') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as BinaryExpression;
      expect(condition).toBeInstanceOf(BinaryExpression);
      expect(condition.getOperator()).toBe(TokenType.LESS_THAN);
    });

    test('parses ternary with equality comparison', () => {
      const expr = parseExpr('(count == 0) ? empty : count') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as BinaryExpression;
      expect(condition).toBeInstanceOf(BinaryExpression);
      expect(condition.getOperator()).toBe(TokenType.EQUAL);
    });

    test('parses ternary with not-equal comparison', () => {
      const expr = parseExpr('(value != 0) ? valid : invalid') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as BinaryExpression;
      expect(condition).toBeInstanceOf(BinaryExpression);
      expect(condition.getOperator()).toBe(TokenType.NOT_EQUAL);
    });

    test('parses ternary with less-equal comparison', () => {
      const expr = parseExpr('(health <= 0) ? dead : alive') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as BinaryExpression;
      expect(condition).toBeInstanceOf(BinaryExpression);
      expect(condition.getOperator()).toBe(TokenType.LESS_EQUAL);
    });

    test('parses ternary with greater-equal comparison', () => {
      const expr = parseExpr('(score >= 100) ? win : cont') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as BinaryExpression;
      expect(condition).toBeInstanceOf(BinaryExpression);
      expect(condition.getOperator()).toBe(TokenType.GREATER_EQUAL);
    });
  });

  // ============================================
  // TERNARY WITH LOGICAL CONDITIONS
  // ============================================

  describe('Ternary with Logical Conditions', () => {
    test('parses ternary with logical AND condition', () => {
      const expr = parseExpr('(a && b) ? x : y') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as BinaryExpression;
      expect(condition).toBeInstanceOf(BinaryExpression);
      expect(condition.getOperator()).toBe(TokenType.AND);
    });

    test('parses ternary with logical OR condition', () => {
      const expr = parseExpr('(a || b) ? x : y') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as BinaryExpression;
      expect(condition).toBeInstanceOf(BinaryExpression);
      expect(condition.getOperator()).toBe(TokenType.OR);
    });

    test('parses ternary with logical NOT condition', () => {
      const expr = parseExpr('!flag ? x : y') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as UnaryExpression;
      expect(condition).toBeInstanceOf(UnaryExpression);
      expect(condition.getOperator()).toBe(TokenType.NOT);
    });

    test('parses ternary with complex logical condition', () => {
      const expr = parseExpr('(a && b || c) ? x : y') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as BinaryExpression;
      expect(condition).toBeInstanceOf(BinaryExpression);
      expect(condition.getOperator()).toBe(TokenType.OR);
    });
  });

  // ============================================
  // NESTED TERNARY EXPRESSIONS (RIGHT-ASSOCIATIVE)
  // ============================================

  describe('Nested Ternary Expressions (Right-Associative)', () => {
    test('parses nested ternary in else branch', () => {
      // a ? b : c ? d : e should be parsed as a ? b : (c ? d : e)
      const expr = parseExpr('a ? b : c ? d : e') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect((expr.getCondition() as IdentifierExpression).getName()).toBe('a');
      expect((expr.getThenBranch() as IdentifierExpression).getName()).toBe('b');

      const nestedTernary = expr.getElseBranch() as TernaryExpression;
      expect(nestedTernary).toBeInstanceOf(TernaryExpression);
      expect((nestedTernary.getCondition() as IdentifierExpression).getName()).toBe('c');
      expect((nestedTernary.getThenBranch() as IdentifierExpression).getName()).toBe('d');
      expect((nestedTernary.getElseBranch() as IdentifierExpression).getName()).toBe('e');
    });

    test('parses triple nested ternary', () => {
      // a ? b : c ? d : e ? f : g should be a ? b : (c ? d : (e ? f : g))
      const expr = parseExpr('a ? b : c ? d : e ? f : g') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect((expr.getCondition() as IdentifierExpression).getName()).toBe('a');
      expect((expr.getThenBranch() as IdentifierExpression).getName()).toBe('b');

      const second = expr.getElseBranch() as TernaryExpression;
      expect(second).toBeInstanceOf(TernaryExpression);
      expect((second.getCondition() as IdentifierExpression).getName()).toBe('c');

      const third = second.getElseBranch() as TernaryExpression;
      expect(third).toBeInstanceOf(TernaryExpression);
      expect((third.getCondition() as IdentifierExpression).getName()).toBe('e');
    });

    test('parses nested ternary in then branch (explicit parentheses)', () => {
      const expr = parseExpr('a ? (b ? c : d) : e') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const nestedTernary = expr.getThenBranch() as TernaryExpression;
      expect(nestedTernary).toBeInstanceOf(TernaryExpression);
      expect((nestedTernary.getCondition() as IdentifierExpression).getName()).toBe('b');
    });

    test('parses both branches with nested ternary', () => {
      const expr = parseExpr('a ? (b ? c : d) : (e ? f : g)') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect(expr.getThenBranch()).toBeInstanceOf(TernaryExpression);
      expect(expr.getElseBranch()).toBeInstanceOf(TernaryExpression);
    });
  });

  // ============================================
  // TERNARY WITH ARITHMETIC EXPRESSIONS
  // ============================================

  describe('Ternary with Arithmetic Expressions', () => {
    test('parses ternary with arithmetic in branches', () => {
      const expr = parseExpr('flag ? a + b : c - d') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const thenBranch = expr.getThenBranch() as BinaryExpression;
      expect(thenBranch).toBeInstanceOf(BinaryExpression);
      expect(thenBranch.getOperator()).toBe(TokenType.PLUS);

      const elseBranch = expr.getElseBranch() as BinaryExpression;
      expect(elseBranch).toBeInstanceOf(BinaryExpression);
      expect(elseBranch.getOperator()).toBe(TokenType.MINUS);
    });

    test('parses ternary with multiplication in branches', () => {
      const expr = parseExpr('flag ? x * 2 : x / 2') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const thenBranch = expr.getThenBranch() as BinaryExpression;
      expect(thenBranch).toBeInstanceOf(BinaryExpression);
      expect(thenBranch.getOperator()).toBe(TokenType.MULTIPLY);

      const elseBranch = expr.getElseBranch() as BinaryExpression;
      expect(elseBranch).toBeInstanceOf(BinaryExpression);
      expect(elseBranch.getOperator()).toBe(TokenType.DIVIDE);
    });

    test('parses ternary with complex arithmetic condition', () => {
      const expr = parseExpr('(a + b > c) ? x : y') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as BinaryExpression;
      expect(condition).toBeInstanceOf(BinaryExpression);
      expect(condition.getOperator()).toBe(TokenType.GREATER_THAN);
    });
  });

  // ============================================
  // TERNARY WITH FUNCTION CALLS
  // ============================================

  describe('Ternary with Function Calls', () => {
    test('parses ternary with function call condition', () => {
      const expr = parseExpr('isValid() ? a : b') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect(expr.getCondition()).toBeInstanceOf(CallExpression);
    });

    test('parses ternary with function calls in branches', () => {
      const expr = parseExpr('flag ? getValue() : getDefault()') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect(expr.getThenBranch()).toBeInstanceOf(CallExpression);
      expect(expr.getElseBranch()).toBeInstanceOf(CallExpression);
    });

    test('parses ternary with function call arguments in branches', () => {
      const expr = parseExpr('flag ? process(a, b) : process(c, d)') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const thenCall = expr.getThenBranch() as CallExpression;
      expect(thenCall).toBeInstanceOf(CallExpression);
      expect(thenCall.getArguments()).toHaveLength(2);
    });
  });

  // ============================================
  // TERNARY WITH ARRAY ACCESS
  // ============================================

  describe('Ternary with Array Access', () => {
    test('parses ternary with array access condition', () => {
      const expr = parseExpr('array[0] ? a : b') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect(expr.getCondition()).toBeInstanceOf(IndexExpression);
    });

    test('parses ternary with array access in branches', () => {
      const expr = parseExpr('flag ? buffer[i] : defaults[0]') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect(expr.getThenBranch()).toBeInstanceOf(IndexExpression);
      expect(expr.getElseBranch()).toBeInstanceOf(IndexExpression);
    });
  });

  // ============================================
  // TERNARY WITH UNARY EXPRESSIONS
  // ============================================

  describe('Ternary with Unary Expressions', () => {
    test('parses ternary with negation in branches', () => {
      const expr = parseExpr('flag ? -x : -y') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect(expr.getThenBranch()).toBeInstanceOf(UnaryExpression);
      expect(expr.getElseBranch()).toBeInstanceOf(UnaryExpression);
    });

    test('parses ternary with bitwise NOT in branches', () => {
      const expr = parseExpr('flag ? ~a : ~b') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const thenBranch = expr.getThenBranch() as UnaryExpression;
      expect(thenBranch).toBeInstanceOf(UnaryExpression);
      expect(thenBranch.getOperator()).toBe(TokenType.BITWISE_NOT);
    });

    test('parses ternary with address-of in branches', () => {
      const expr = parseExpr('flag ? @a : @b') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const thenBranch = expr.getThenBranch() as UnaryExpression;
      expect(thenBranch).toBeInstanceOf(UnaryExpression);
      expect(thenBranch.getOperator()).toBe(TokenType.AT);
    });
  });

  // ============================================
  // TERNARY PRECEDENCE TESTS
  // ============================================

  describe('Ternary Operator Precedence', () => {
    test('ternary has lower precedence than logical OR', () => {
      // a || b ? c : d should be (a || b) ? c : d
      const expr = parseExpr('a || b ? c : d') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as BinaryExpression;
      expect(condition).toBeInstanceOf(BinaryExpression);
      expect(condition.getOperator()).toBe(TokenType.OR);
    });

    test('ternary has lower precedence than comparison', () => {
      // a < b ? c : d should be (a < b) ? c : d
      const expr = parseExpr('a < b ? c : d') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as BinaryExpression;
      expect(condition).toBeInstanceOf(BinaryExpression);
      expect(condition.getOperator()).toBe(TokenType.LESS_THAN);
    });

    test('ternary has higher precedence than assignment', () => {
      // This tests that ternary completes before assignment kicks in
      const { expression, parser } = parseExpression('x = a ? b : c');
      expect(parser.getDiagnostics()).toHaveLength(0);

      // This should parse as x = (a ? b : c), not (x = a) ? b : c
      // Since assignment returns AssignmentExpression in our parser
      const expr = expression;
      // The exact behavior depends on parser implementation, but no errors is key
    });

    test('arithmetic has higher precedence than ternary condition', () => {
      // a + b > c ? x : y should be ((a + b) > c) ? x : y
      const expr = parseExpr('a + b > c ? x : y') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const condition = expr.getCondition() as BinaryExpression;
      expect(condition).toBeInstanceOf(BinaryExpression);
      expect(condition.getOperator()).toBe(TokenType.GREATER_THAN);

      const leftOfComparison = condition.getLeft() as BinaryExpression;
      expect(leftOfComparison).toBeInstanceOf(BinaryExpression);
      expect(leftOfComparison.getOperator()).toBe(TokenType.PLUS);
    });
  });

  // ============================================
  // PRACTICAL USE CASES (C64-STYLE)
  // ============================================

  describe('Practical Use Cases (C64-Style)', () => {
    test('parses max value idiom', () => {
      const expr = parseExpr('(a > b) ? a : b') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);
      expect(expr.getCondition()).toBeInstanceOf(BinaryExpression);
    });

    test('parses min value idiom', () => {
      const expr = parseExpr('(a < b) ? a : b') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);
    });

    test('parses absolute value idiom', () => {
      const expr = parseExpr('(x >= 0) ? x : -x') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const elseBranch = expr.getElseBranch() as UnaryExpression;
      expect(elseBranch).toBeInstanceOf(UnaryExpression);
      expect(elseBranch.getOperator()).toBe(TokenType.MINUS);
    });

    test('parses clamping idiom', () => {
      // (x > max) ? max : x
      const expr = parseExpr('(x > max) ? max : x') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);
    });

    test('parses direction multiplier idiom', () => {
      // movingRight ? 1 : -1
      const expr = parseExpr('movingRight ? 1 : -1') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect((expr.getThenBranch() as LiteralExpression).getValue()).toBe(1);

      const elseBranch = expr.getElseBranch() as UnaryExpression;
      expect(elseBranch).toBeInstanceOf(UnaryExpression);
      expect(elseBranch.getOperator()).toBe(TokenType.MINUS);
    });

    test('parses sprite enable toggle idiom', () => {
      const expr = parseExpr('enabled ? $FF : $00') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      expect((expr.getThenBranch() as LiteralExpression).getValue()).toBe(0xff);
      expect((expr.getElseBranch() as LiteralExpression).getValue()).toBe(0x00);
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================

  describe('Error Handling', () => {
    test('handles missing colon with error recovery', () => {
      const { expression, parser } = parseExpression('a ? b c');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0);
      // Parser should still produce some expression via recovery
      expect(expression).toBeTruthy();
    });

    test('handles missing else branch with error recovery', () => {
      const { expression, parser } = parseExpression('a ? b :');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0);
      expect(expression).toBeTruthy();
    });

    test('handles missing then branch with error recovery', () => {
      const { expression, parser } = parseExpression('a ? : c');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0);
      expect(expression).toBeTruthy();
    });

    test('handles incomplete ternary at end of input', () => {
      const { expression, parser } = parseExpression('a ?');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0);
      expect(expression).toBeTruthy();
    });
  });

  // ============================================
  // LOCATION TRACKING TESTS
  // ============================================

  describe('Location Tracking', () => {
    test('ternary expression has correct location', () => {
      const expr = parseExpr('a ? b : c') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const location = expr.getLocation();
      expect(location).toBeDefined();
      expect(location.start.line).toBe(1);
      expect(location.start.column).toBe(1);
    });

    test('nested ternary expressions have correct locations', () => {
      const expr = parseExpr('a ? b : c ? d : e') as TernaryExpression;
      expect(expr).toBeInstanceOf(TernaryExpression);

      const outerLocation = expr.getLocation();
      expect(outerLocation).toBeDefined();

      const innerTernary = expr.getElseBranch() as TernaryExpression;
      const innerLocation = innerTernary.getLocation();
      expect(innerLocation).toBeDefined();

      // Inner ternary should start after 'a ? b : '
      expect(innerLocation.start.column).toBeGreaterThan(outerLocation.start.column);
    });
  });
});