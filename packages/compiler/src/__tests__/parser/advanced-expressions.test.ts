/**
 * Advanced Expression Parser Tests - Phase 3
 *
 * Comprehensive test suite for advanced expression parsing features:
 * - Unary expressions (!, ~, +, -, @)
 * - Function calls with arguments
 * - Member access with dot notation
 * - Index access with bracket notation
 * - Assignment expressions with all operators
 * - Complex expression chaining
 * - Operator precedence and associativity
 * - Error handling and recovery
 */

import { describe, test, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { TokenType } from '../../lexer/types.js';
import { ExpressionParser } from '../../parser/expressions.js';
import {
  AssignmentExpression,
  BinaryExpression,
  CallExpression,
  Expression,
  IdentifierExpression,
  IndexExpression,
  LiteralExpression,
  MemberExpression,
  UnaryExpression,
} from '../../ast/index.js';

// Create a concrete test implementation of ExpressionParser
class TestAdvancedExpressionParser extends ExpressionParser {
  // Expose protected methods for testing
  public testParseExpression(minPrecedence?: number) {
    return this.parseExpression(minPrecedence);
  }

  public testIsAssignmentOperator(tokenType: TokenType) {
    return this.isAssignmentOperator(tokenType);
  }

  public testIsValidLValue(expr: Expression) {
    return this.isValidLValue(expr);
  }
}

/**
 * Helper function to parse an expression from source code using real Lexer
 */
function parseExpression(source: string): {
  expression: Expression;
  parser: TestAdvancedExpressionParser;
} {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new TestAdvancedExpressionParser(tokens);
  const expression = parser.testParseExpression();
  return { expression, parser };
}

/**
 * Helper function to parse expression and return just the AST node
 */
function parseExpr(source: string): Expression {
  return parseExpression(source).expression;
}

describe('Advanced Expression Parser - Phase 3', () => {
  // ============================================
  // UNARY EXPRESSION TESTS
  // ============================================

  describe('Unary Expressions', () => {
    test('parses logical NOT operator', () => {
      const expr = parseExpr('!flag') as UnaryExpression;
      expect(expr).toBeInstanceOf(UnaryExpression);
      expect(expr.getOperator()).toBe(TokenType.NOT);
      expect(expr.getOperand()).toBeInstanceOf(IdentifierExpression);
      expect((expr.getOperand() as IdentifierExpression).getName()).toBe('flag');
    });

    test('parses bitwise NOT operator', () => {
      const expr = parseExpr('~mask') as UnaryExpression;
      expect(expr).toBeInstanceOf(UnaryExpression);
      expect(expr.getOperator()).toBe(TokenType.BITWISE_NOT);
      expect(expr.getOperand()).toBeInstanceOf(IdentifierExpression);
    });

    test('parses unary plus operator', () => {
      const expr = parseExpr('+value') as UnaryExpression;
      expect(expr).toBeInstanceOf(UnaryExpression);
      expect(expr.getOperator()).toBe(TokenType.PLUS);
    });

    test('parses unary minus operator', () => {
      const expr = parseExpr('-x') as UnaryExpression;
      expect(expr).toBeInstanceOf(UnaryExpression);
      expect(expr.getOperator()).toBe(TokenType.MINUS);
    });

    test('parses address-of operator', () => {
      const expr = parseExpr('@counter') as UnaryExpression;
      expect(expr).toBeInstanceOf(UnaryExpression);
      expect(expr.getOperator()).toBe(TokenType.AT);
      expect(expr.getOperand()).toBeInstanceOf(IdentifierExpression);
      expect((expr.getOperand() as IdentifierExpression).getName()).toBe('counter');
    });

    test('parses nested unary operators', () => {
      const expr = parseExpr('!!flag') as UnaryExpression;
      expect(expr).toBeInstanceOf(UnaryExpression);
      expect(expr.getOperator()).toBe(TokenType.NOT);

      const inner = expr.getOperand() as UnaryExpression;
      expect(inner).toBeInstanceOf(UnaryExpression);
      expect(inner.getOperator()).toBe(TokenType.NOT);
      expect(inner.getOperand()).toBeInstanceOf(IdentifierExpression);
    });

    test('parses complex nested unary operators', () => {
      const expr = parseExpr('~-x') as UnaryExpression;
      expect(expr).toBeInstanceOf(UnaryExpression);
      expect(expr.getOperator()).toBe(TokenType.BITWISE_NOT);

      const inner = expr.getOperand() as UnaryExpression;
      expect(inner).toBeInstanceOf(UnaryExpression);
      expect(inner.getOperator()).toBe(TokenType.MINUS);
    });

    test('handles address-of operator on literals with error recovery', () => {
      // Parser uses error recovery, doesn't throw - check for diagnostic
      const { expression, parser } = parseExpression('@5');
      expect(expression).toBeInstanceOf(LiteralExpression); // Error recovery returns dummy
      expect(parser.getDiagnostics().length).toBeGreaterThan(0); // Should have error
    });

    test('handles address-of operator on expressions with error recovery', () => {
      // Parser detects error and uses recovery - the @ token is treated as error and expression continues
      const { expression, parser } = parseExpression('@(x + y)');
      expect(expression).toBeInstanceOf(BinaryExpression); // (x + y) parsed as binary expression
      expect(parser.getDiagnostics().length).toBeGreaterThan(0); // Should have error diagnostic

      // Verify the expression is still the binary (x + y)
      const binaryExpr = expression as BinaryExpression;
      expect(binaryExpr.getOperator()).toBe(TokenType.PLUS);
    });
  });

  // ============================================
  // FUNCTION CALL TESTS
  // ============================================

  describe('Function Call Expressions', () => {
    test('parses zero-argument function call', () => {
      const expr = parseExpr('clearScreen()') as CallExpression;
      expect(expr).toBeInstanceOf(CallExpression);
      expect(expr.getCallee()).toBeInstanceOf(IdentifierExpression);
      expect((expr.getCallee() as IdentifierExpression).getName()).toBe('clearScreen');
      expect(expr.getArguments()).toHaveLength(0);
    });

    test('parses single-argument function call', () => {
      const expr = parseExpr('setPixel(10)') as CallExpression;
      expect(expr).toBeInstanceOf(CallExpression);
      expect(expr.getArguments()).toHaveLength(1);
      expect(expr.getArguments()[0]).toBeInstanceOf(LiteralExpression);
      expect((expr.getArguments()[0] as LiteralExpression).getValue()).toBe(10);
    });

    test('parses multi-argument function call', () => {
      const expr = parseExpr('calculateDistance(x1, y1, x2, y2)') as CallExpression;
      expect(expr).toBeInstanceOf(CallExpression);
      expect(expr.getArguments()).toHaveLength(4);

      const args = expr.getArguments();
      expect((args[0] as IdentifierExpression).getName()).toBe('x1');
      expect((args[1] as IdentifierExpression).getName()).toBe('y1');
      expect((args[2] as IdentifierExpression).getName()).toBe('x2');
      expect((args[3] as IdentifierExpression).getName()).toBe('y2');
    });

    test('parses function call with expression arguments', () => {
      const expr = parseExpr('func(x + 1, getValue(), array[i])') as CallExpression;
      expect(expr).toBeInstanceOf(CallExpression);
      expect(expr.getArguments()).toHaveLength(3);

      const args = expr.getArguments();
      expect(args[0]).toBeInstanceOf(BinaryExpression);
      expect(args[1]).toBeInstanceOf(CallExpression);
      expect(args[2]).toBeInstanceOf(IndexExpression);
    });

    test('function calls on non-identifiers produce errors with recovery', () => {
      // SPECIFICATION COMPLIANCE: Method calls like obj.method() are not supported
      const { expression, parser } = parseExpression('getPlayer().getPosition()');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0); // Should have error
      // Parser should use error recovery and still return some expression
      expect(expression).toBeTruthy();
    });
  });

  // ============================================
  // MEMBER ACCESS TESTS
  // ============================================

  describe('Member Access Expressions - SPECIFICATION COMPLIANT', () => {
    test('parses simple @map member access', () => {
      // SPECIFICATION: Member access only allowed for @map declarations
      const expr = parseExpr('vic.borderColor') as MemberExpression;
      expect(expr).toBeInstanceOf(MemberExpression);
      expect(expr.getObject()).toBeInstanceOf(IdentifierExpression);
      expect((expr.getObject() as IdentifierExpression).getName()).toBe('vic');
      expect(expr.getProperty()).toBe('borderColor');
    });

    test('rejects chained member access with error recovery', () => {
      // SPECIFICATION: Chained member access like obj.prop.subprop is not supported
      const { expression, parser } = parseExpression('player.position.x');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0); // Should have error
      expect(expression).toBeTruthy(); // Should still return some expression via recovery
      // The exact type depends on error recovery strategy - could be MemberExpression, BinaryExpression, etc.
    });

    test('rejects member access on function calls with error recovery', () => {
      // SPECIFICATION: Method calls like func().prop are not supported
      const { expression, parser } = parseExpression('getEnemy().health');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0); // Should have error
      expect(expression).toBeTruthy(); // Should still return expression via recovery
    });

    test('rejects member access on index expressions with error recovery', () => {
      // SPECIFICATION: Member access on expressions like array[i].prop is not supported
      const { expression, parser } = parseExpression('enemies[0].health');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0); // Should have error
      expect(expression).toBeTruthy(); // Should still return expression via recovery
    });
  });

  // ============================================
  // INDEX ACCESS TESTS
  // ============================================

  describe('Index Access Expressions - SPECIFICATION COMPLIANT', () => {
    test('parses simple index access', () => {
      const expr = parseExpr('buffer[0]') as IndexExpression;
      expect(expr).toBeInstanceOf(IndexExpression);
      expect(expr.getObject()).toBeInstanceOf(IdentifierExpression);
      expect((expr.getObject() as IdentifierExpression).getName()).toBe('buffer');
      expect(expr.getIndex()).toBeInstanceOf(LiteralExpression);
      expect((expr.getIndex() as LiteralExpression).getValue()).toBe(0);
    });

    test('parses index access with expression index', () => {
      const expr = parseExpr('screenRAM[y * 40 + x]') as IndexExpression;
      expect(expr).toBeInstanceOf(IndexExpression);
      expect(expr.getIndex()).toBeInstanceOf(BinaryExpression);
    });

    test('parses chained index access - specification compliant', () => {
      // SPECIFICATION: Multi-dimensional array access is allowed
      const expr = parseExpr('matrix[row][col]') as IndexExpression;
      expect(expr).toBeInstanceOf(IndexExpression);
      expect(expr.getObject()).toBeInstanceOf(IndexExpression);
      expect((expr.getIndex() as IdentifierExpression).getName()).toBe('col');

      const first = expr.getObject() as IndexExpression;
      expect((first.getIndex() as IdentifierExpression).getName()).toBe('row');
    });

    test('rejects index access on function calls with error recovery', () => {
      // SPECIFICATION: Index access on function results like func()[index] is not supported
      const { expression, parser } = parseExpression('getData()[index]');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0); // Should have error
      expect(expression).toBeTruthy(); // Should still return expression via recovery
    });
  });

  // ============================================
  // ASSIGNMENT EXPRESSION TESTS
  // ============================================

  describe('Assignment Expressions', () => {
    test('parses simple assignment', () => {
      const expr = parseExpr('x = 10') as AssignmentExpression;
      expect(expr).toBeInstanceOf(AssignmentExpression);
      expect(expr.getOperator()).toBe(TokenType.ASSIGN);
      expect(expr.getTarget()).toBeInstanceOf(IdentifierExpression);
      expect(expr.getValue()).toBeInstanceOf(LiteralExpression);
    });

    test('parses compound assignment operators', () => {
      const tests = [
        { source: 'x += 1', op: TokenType.PLUS_ASSIGN },
        { source: 'x -= 1', op: TokenType.MINUS_ASSIGN },
        { source: 'x *= 2', op: TokenType.MULTIPLY_ASSIGN },
        { source: 'x /= 2', op: TokenType.DIVIDE_ASSIGN },
        { source: 'x %= 10', op: TokenType.MODULO_ASSIGN },
        { source: 'flags &= mask', op: TokenType.BITWISE_AND_ASSIGN },
        { source: 'flags |= mask', op: TokenType.BITWISE_OR_ASSIGN },
        { source: 'flags ^= mask', op: TokenType.BITWISE_XOR_ASSIGN },
        { source: 'value <<= 1', op: TokenType.LEFT_SHIFT_ASSIGN },
        { source: 'value >>= 1', op: TokenType.RIGHT_SHIFT_ASSIGN },
      ];

      for (const { source, op } of tests) {
        const expr = parseExpr(source) as AssignmentExpression;
        expect(expr).toBeInstanceOf(AssignmentExpression);
        expect(expr.getOperator()).toBe(op);
      }
    });

    test('parses assignment to member expression', () => {
      const expr = parseExpr('player.health = 100') as AssignmentExpression;
      expect(expr).toBeInstanceOf(AssignmentExpression);
      expect(expr.getTarget()).toBeInstanceOf(MemberExpression);
      expect((expr.getValue() as LiteralExpression).getValue()).toBe(100);
    });

    test('parses assignment to index expression', () => {
      const expr = parseExpr('buffer[i] = value') as AssignmentExpression;
      expect(expr).toBeInstanceOf(AssignmentExpression);
      expect(expr.getTarget()).toBeInstanceOf(IndexExpression);
    });

    test('parses right-associative assignment', () => {
      const expr = parseExpr('a = b = c') as AssignmentExpression;
      expect(expr).toBeInstanceOf(AssignmentExpression);
      expect((expr.getTarget() as IdentifierExpression).getName()).toBe('a');

      const rightSide = expr.getValue() as AssignmentExpression;
      expect(rightSide).toBeInstanceOf(AssignmentExpression);
      expect((rightSide.getTarget() as IdentifierExpression).getName()).toBe('b');
      expect((rightSide.getValue() as IdentifierExpression).getName()).toBe('c');
    });

    test('handles assignment to literals with error recovery', () => {
      // Parser uses error recovery, doesn't throw - check for diagnostic
      const { expression, parser } = parseExpression('5 = x');
      expect(expression).toBeInstanceOf(AssignmentExpression); // Still creates assignment
      expect(parser.getDiagnostics().length).toBeGreaterThan(0); // Should have error
    });

    test('handles assignment to function calls with error recovery', () => {
      // Parser uses error recovery, doesn't throw - check for diagnostic
      const { expression, parser } = parseExpression('func() = value');
      expect(expression).toBeInstanceOf(AssignmentExpression); // Still creates assignment
      expect(parser.getDiagnostics().length).toBeGreaterThan(0); // Should have error
    });
  });

  // ============================================
  // SPECIFICATION COMPLIANCE ERROR HANDLING
  // ============================================

  describe('Specification Compliance - Error Recovery', () => {
    test('rejects complex object-oriented chaining with error recovery', () => {
      // SPECIFICATION: Complex chaining like obj.prop.method()[index].field is not supported
      const { expression, parser } = parseExpression('game.players[0].inventory.items[slot].use()');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0); // Should have multiple errors
      expect(expression).toBeTruthy(); // Should still return some expression via recovery
    });

    test('rejects method calls on array access with error recovery', () => {
      // SPECIFICATION: Method calls on expressions like array[index].method() are not supported
      const { expression, parser } = parseExpression('array[index].property()');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0); // Should have error
      expect(expression).toBeTruthy(); // Should still return expression via recovery
    });

    test('parses unary with @map member access - specification compliant', () => {
      // SPECIFICATION: This is valid - unary operator on @map member access
      const expr = parseExpr('!vic.spriteEnable') as UnaryExpression;
      expect(expr).toBeInstanceOf(UnaryExpression);
      expect(expr.getOperator()).toBe(TokenType.NOT);
      expect(expr.getOperand()).toBeInstanceOf(MemberExpression);
    });
  });

  // ============================================
  // OPERATOR PRECEDENCE TESTS
  // ============================================

  describe('Operator Precedence', () => {
    test('unary operators have higher precedence than binary', () => {
      const expr = parseExpr('-x + y') as BinaryExpression;
      expect(expr).toBeInstanceOf(BinaryExpression);
      expect(expr.getOperator()).toBe(TokenType.PLUS);
      expect(expr.getLeft()).toBeInstanceOf(UnaryExpression);
      expect(expr.getRight()).toBeInstanceOf(IdentifierExpression);
    });

    test('postfix operators have highest precedence', () => {
      const expr = parseExpr('func() + value') as BinaryExpression;
      expect(expr).toBeInstanceOf(BinaryExpression);
      expect(expr.getOperator()).toBe(TokenType.PLUS);
      expect(expr.getLeft()).toBeInstanceOf(CallExpression);
      expect(expr.getRight()).toBeInstanceOf(IdentifierExpression);
    });

    test('assignment has lowest precedence', () => {
      const expr = parseExpr('x = y + z') as AssignmentExpression;
      expect(expr).toBeInstanceOf(AssignmentExpression);
      expect(expr.getOperator()).toBe(TokenType.ASSIGN);
      expect(expr.getValue()).toBeInstanceOf(BinaryExpression);
    });

    test('complex precedence relationships', () => {
      const expr = parseExpr('!ready || count > max && items[0].valid') as BinaryExpression;
      expect(expr).toBeInstanceOf(BinaryExpression);
      expect(expr.getOperator()).toBe(TokenType.OR);

      // Left side should be unary NOT
      expect(expr.getLeft()).toBeInstanceOf(UnaryExpression);

      // Right side should be AND with proper grouping
      expect(expr.getRight()).toBeInstanceOf(BinaryExpression);
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================

  describe('Error Handling', () => {
    test('handles missing closing parenthesis with error recovery', () => {
      // Parser uses error recovery instead of throwing
      const { expression, parser } = parseExpression('func(arg');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0);
    });

    test('handles missing closing bracket with error recovery', () => {
      // Parser uses error recovery instead of throwing
      const { expression, parser } = parseExpression('array[index');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0);
    });

    test('handles missing property name with error recovery', () => {
      // Parser uses error recovery instead of throwing
      const { expression, parser } = parseExpression('obj.');
      expect(parser.getDiagnostics().length).toBeGreaterThan(0);
    });

    test('handles invalid left-hand side in assignment with error recovery', () => {
      // Parser uses error recovery instead of throwing
      const { expression, parser } = parseExpression('(x + y) = value');
      expect(expression).toBeInstanceOf(AssignmentExpression);
      expect(parser.getDiagnostics().length).toBeGreaterThan(0);
    });

    test('provides error recovery for invalid expressions', () => {
      // Parser should recover and return a dummy expression
      const { expression } = parseExpression('@5'); // Invalid address-of
      expect(expression).toBeInstanceOf(LiteralExpression);
    });
  });

  // ============================================
  // INTEGRATION TESTS - SPECIFICATION COMPLIANT
  // ============================================

  describe('Integration with Binary Expressions - SPECIFICATION COMPLIANT', () => {
    test('specification-compliant expressions work in binary context', () => {
      // SPECIFICATION: Use @map member access and standalone function calls
      const expr = parseExpr('vic.borderColor > 0 && !gameOver') as BinaryExpression;
      expect(expr).toBeInstanceOf(BinaryExpression);
      expect(expr.getOperator()).toBe(TokenType.AND);

      expect(expr.getLeft()).toBeInstanceOf(BinaryExpression);
      expect(expr.getRight()).toBeInstanceOf(UnaryExpression);
    });

    test('assignment expressions work with specification-compliant syntax', () => {
      // SPECIFICATION: Use @map member access (not object-oriented chaining)
      const expr = parseExpr('vic.borderColor = screenWidth / 2 + offset') as AssignmentExpression;
      expect(expr).toBeInstanceOf(AssignmentExpression);
      expect(expr.getTarget()).toBeInstanceOf(MemberExpression);
      expect(expr.getValue()).toBeInstanceOf(BinaryExpression);
    });
  });
});
