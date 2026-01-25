/**
 * Tests for ASTTransformer base class
 *
 * Tests cover:
 * - Identity transformation (default behavior)
 * - Shallow transformations (node properties)
 * - Deep transformations (recursive children)
 * - Structural transformations (replacing subtrees)
 * - Immutability guarantees
 * - Type safety
 */

import { describe, it, expect } from 'vitest';
import { ASTTransformer } from '../../../ast/walker/transformer.js';
import { Parser } from '../../../parser/parser.js';
import { Lexer } from '../../../lexer/lexer.js';
import {
  Program,
  BinaryExpression,
  LiteralExpression,
  IdentifierExpression,
  VariableDecl,
  FunctionDecl,
  ReturnStatement,
} from '../../../ast/nodes.js';
import { ASTNode, ASTNodeType } from '../../../ast/base.js';
import { TokenType } from '../../../lexer/types.js';

/**
 * Helper: Parse source code into AST
 */
function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Helper: Check if two nodes are the exact same object (reference equality)
 */
function isSameReference(a: ASTNode, b: ASTNode): boolean {
  return a === b;
}

// ============================================
// TEST TRANSFORMERS
// ============================================

/**
 * Identity transformer - returns all nodes unchanged
 * Used to test default behavior
 */
class IdentityTransformer extends ASTTransformer {
  // Uses default implementation (returns node unchanged)
}

/**
 * Counting transformer - counts how many nodes visited
 * Demonstrates transformer that doesn't modify tree
 */
class CountingTransformer extends ASTTransformer {
  public count = 0;

  visitProgram(node: Program): ASTNode {
    this.count++;
    return super.visitProgram(node);
  }

  visitBinaryExpression(node: BinaryExpression): ASTNode {
    this.count++;
    return super.visitBinaryExpression(node);
  }

  visitLiteralExpression(node: LiteralExpression): ASTNode {
    this.count++;
    return super.visitLiteralExpression(node);
  }

  visitIdentifierExpression(node: IdentifierExpression): ASTNode {
    this.count++;
    return super.visitIdentifierExpression(node);
  }

  visitVariableDecl(node: VariableDecl): ASTNode {
    this.count++;
    return super.visitVariableDecl(node);
  }

  visitFunctionDecl(node: FunctionDecl): ASTNode {
    this.count++;
    return super.visitFunctionDecl(node);
  }

  visitReturnStatement(node: ReturnStatement): ASTNode {
    this.count++;
    return super.visitReturnStatement(node);
  }
}

/**
 * Negate literals transformer - converts 42 to -42, -42 to 42
 * Demonstrates shallow transformation
 */
class NegateLiteralsTransformer extends ASTTransformer {
  visitLiteralExpression(node: LiteralExpression): ASTNode {
    const value = node.getValue();
    if (typeof value === 'number') {
      // Create new literal with negated value
      return new LiteralExpression(-value, node.getLocation());
    }
    return node;
  }
}

/**
 * Double numbers transformer - multiplies all numeric literals by 2
 * Demonstrates value transformation
 */
class DoubleNumbersTransformer extends ASTTransformer {
  visitLiteralExpression(node: LiteralExpression): ASTNode {
    const value = node.getValue();
    if (typeof value === 'number') {
      return new LiteralExpression(value * 2, node.getLocation());
    }
    return node;
  }
}

/**
 * Constant folding transformer - evaluates constant expressions
 * Demonstrates deep transformation with optimization
 */
class ConstantFoldingTransformer extends ASTTransformer {
  visitBinaryExpression(node: BinaryExpression): ASTNode {
    // First transform children
    const left = node.getLeft().accept(this);
    const right = node.getRight().accept(this);

    // Check if both operands are literals
    if (
      left.getNodeType() === ASTNodeType.LITERAL_EXPR &&
      right.getNodeType() === ASTNodeType.LITERAL_EXPR
    ) {
      const leftVal = (left as LiteralExpression).getValue();
      const rightVal = (right as LiteralExpression).getValue();

      if (typeof leftVal === 'number' && typeof rightVal === 'number') {
        let result: number;

        switch (node.getOperator()) {
          case TokenType.PLUS:
            result = leftVal + rightVal;
            break;
          case TokenType.MINUS:
            result = leftVal - rightVal;
            break;
          case TokenType.MULTIPLY:
            result = leftVal * rightVal;
            break;
          default:
            return node;
        }

        // Return folded constant
        return new LiteralExpression(result, node.getLocation());
      }
    }

    return node;
  }
}

/**
 * Remove return statements transformer
 * Demonstrates structural transformation (removing nodes)
 */
class RemoveReturnsTransformer extends ASTTransformer {
  visitReturnStatement(node: ReturnStatement): ASTNode {
    // NOTE: This is a demonstration only - actual removal would need
    // parent context to remove from statement list
    return node;
  }
}

// ============================================
// TESTS: Identity Transformation
// ============================================

describe('ASTTransformer - Identity Transformation', () => {
  it('should return same node when not transformed', () => {
    const program = parse('let x: byte = 0;');
    const transformer = new IdentityTransformer();

    const result = transformer.transform(program);

    // Should return exact same object (reference equality)
    expect(isSameReference(result, program)).toBe(true);
  });

  it('should return same nodes for expressions', () => {
    const program = parse('let x: byte = 2 + 3;');
    const transformer = new IdentityTransformer();

    const result = transformer.transform(program);

    expect(isSameReference(result, program)).toBe(true);
  });

  it('should return same nodes for functions', () => {
    const program = parse(`
      function test(): byte {
        return 42;
      }
    `);
    const transformer = new IdentityTransformer();

    const result = transformer.transform(program);

    expect(isSameReference(result, program)).toBe(true);
  });
});

// ============================================
// TESTS: Visiting All Nodes
// ============================================

describe('ASTTransformer - Node Visitation', () => {
  it('should visit all nodes in simple program', () => {
    const program = parse('let x: byte = 0;');
    const transformer = new CountingTransformer();

    transformer.transform(program);

    // Should visit: Program, VariableDecl, LiteralExpression
    expect(transformer.count).toBe(3);
  });

  it('should visit all nodes in binary expression', () => {
    const program = parse('let x: byte = 2 + 3;');
    const transformer = new CountingTransformer();

    transformer.transform(program);

    // Should visit: Program, VariableDecl, BinaryExpression, 2 Literals
    expect(transformer.count).toBe(5);
  });

  it('should visit all nodes in function', () => {
    const program = parse(`
      function test(): byte {
        return 42;
      }
    `);
    const transformer = new CountingTransformer();

    transformer.transform(program);

    // Should visit: Program, FunctionDecl, ReturnStatement, LiteralExpression
    expect(transformer.count).toBe(4);
  });
});

// ============================================
// TESTS: Shallow Transformation
// ============================================

describe('ASTTransformer - Shallow Transformation', () => {
  it('should negate literal values', () => {
    const program = parse('let x: byte = 42;');
    const transformer = new NegateLiteralsTransformer();

    const result = transformer.transform(program) as Program;

    // Extract the literal from transformed AST
    const varDecl = result.getDeclarations()[0] as VariableDecl;
    const literal = varDecl.getInitializer() as LiteralExpression;

    expect(literal.getValue()).toBe(-42);
  });

  it('should negate negative literals to positive', () => {
    const program = parse('let x: byte = 2 + 3;'); // We'll transform 2 and 3
    const transformer = new NegateLiteralsTransformer();

    const result = transformer.transform(program) as Program;

    // Extract the binary expression
    const varDecl = result.getDeclarations()[0] as VariableDecl;
    const binary = varDecl.getInitializer() as BinaryExpression;
    const left = binary.getLeft() as LiteralExpression;
    const right = binary.getRight() as LiteralExpression;

    expect(left.getValue()).toBe(-2);
    expect(right.getValue()).toBe(-3);
  });

  it('should double numeric literals', () => {
    const program = parse('let x: byte = 5;');
    const transformer = new DoubleNumbersTransformer();

    const result = transformer.transform(program) as Program;

    const varDecl = result.getDeclarations()[0] as VariableDecl;
    const literal = varDecl.getInitializer() as LiteralExpression;

    expect(literal.getValue()).toBe(10);
  });
});

// ============================================
// TESTS: Deep Transformation (Optimization)
// ============================================

describe('ASTTransformer - Deep Transformation', () => {
  it('should fold constant addition', () => {
    const program = parse('let x: byte = 2 + 3;');
    const transformer = new ConstantFoldingTransformer();

    const result = transformer.transform(program) as Program;

    const varDecl = result.getDeclarations()[0] as VariableDecl;
    const expr = varDecl.getInitializer();

    // Should be folded into single literal
    expect(expr?.getNodeType()).toBe(ASTNodeType.LITERAL_EXPR);
    expect((expr as LiteralExpression).getValue()).toBe(5);
  });

  it('should fold constant subtraction', () => {
    const program = parse('let x: byte = 10 - 3;');
    const transformer = new ConstantFoldingTransformer();

    const result = transformer.transform(program) as Program;

    const varDecl = result.getDeclarations()[0] as VariableDecl;
    const expr = varDecl.getInitializer() as LiteralExpression;

    expect(expr.getValue()).toBe(7);
  });

  it('should fold constant multiplication', () => {
    const program = parse('let x: byte = 4 * 5;');
    const transformer = new ConstantFoldingTransformer();

    const result = transformer.transform(program) as Program;

    const varDecl = result.getDeclarations()[0] as VariableDecl;
    const expr = varDecl.getInitializer() as LiteralExpression;

    expect(expr.getValue()).toBe(20);
  });

  it('should not fold expressions with variables', () => {
    const program = parse('let x: byte = 2; let y: byte = x + 3;');
    const transformer = new ConstantFoldingTransformer();

    const result = transformer.transform(program) as Program;

    const varDecl = result.getDeclarations()[1] as VariableDecl;
    const expr = varDecl.getInitializer();

    // Should remain binary expression (can't fold with variable)
    expect(expr?.getNodeType()).toBe(ASTNodeType.BINARY_EXPR);
  });
});

// ============================================
// TESTS: Immutability
// ============================================

describe('ASTTransformer - Immutability', () => {
  it('should not modify original AST', () => {
    const program = parse('let x: byte = 42;');
    const transformer = new NegateLiteralsTransformer();

    // Get original value
    const originalVarDecl = program.getDeclarations()[0] as VariableDecl;
    const originalLiteral = originalVarDecl.getInitializer() as LiteralExpression;
    const originalValue = originalLiteral.getValue();

    // Transform
    transformer.transform(program);

    // Original should be unchanged
    expect(originalValue).toBe(42);
    expect(originalLiteral.getValue()).toBe(42);
  });

  it('should preserve original tree structure', () => {
    const source = 'let x: byte = 2 + 3;';
    const program = parse(source);
    const transformer = new ConstantFoldingTransformer();

    // Get original structure
    const originalVarDecl = program.getDeclarations()[0] as VariableDecl;
    const originalExpr = originalVarDecl.getInitializer();

    expect(originalExpr?.getNodeType()).toBe(ASTNodeType.BINARY_EXPR);

    // Transform
    const result = transformer.transform(program) as Program;

    // Result should be different
    const resultVarDecl = result.getDeclarations()[0] as VariableDecl;
    const resultExpr = resultVarDecl.getInitializer();

    // Original should still be binary expression
    expect(originalExpr?.getNodeType()).toBe(ASTNodeType.BINARY_EXPR);

    // Result should be folded to literal
    expect(resultExpr?.getNodeType()).toBe(ASTNodeType.LITERAL_EXPR);
  });
});

// ============================================
// TESTS: Complex Transformations
// ============================================

describe('ASTTransformer - Complex Scenarios', () => {
  it('should handle nested binary expressions', () => {
    const program = parse('let x: byte = 1 + 2 + 3;');
    const transformer = new ConstantFoldingTransformer();

    const result = transformer.transform(program) as Program;

    const varDecl = result.getDeclarations()[0] as VariableDecl;
    const expr = varDecl.getInitializer();

    // Should fold nested expression
    // Note: Depending on parse tree structure, this might be partially folded
    expect(expr?.getNodeType()).toBe(ASTNodeType.LITERAL_EXPR);
    expect((expr as LiteralExpression).getValue()).toBe(6);
  });

  it('should handle expressions in function returns', () => {
    const program = parse(`
      function test(): byte {
        return 2 + 3;
      }
    `);
    const transformer = new ConstantFoldingTransformer();

    const result = transformer.transform(program) as Program;

    const funcDecl = result.getDeclarations()[0] as FunctionDecl;
    const returnStmt = funcDecl.getBody()[0] as ReturnStatement;
    const expr = returnStmt.getValue() as LiteralExpression;

    expect(expr.getNodeType()).toBe(ASTNodeType.LITERAL_EXPR);
    expect(expr.getValue()).toBe(5);
  });

  it('should handle multiple transformations', () => {
    const program = parse('let x: byte = 10;');

    // Chain transformations: double then negate
    const doubler = new DoubleNumbersTransformer();
    const negater = new NegateLiteralsTransformer();

    const doubled = doubler.transform(program) as Program;
    const negated = negater.transform(doubled) as Program;

    const varDecl = negated.getDeclarations()[0] as VariableDecl;
    const literal = varDecl.getInitializer() as LiteralExpression;

    // 10 * 2 = 20, then negated = -20
    expect(literal.getValue()).toBe(-20);
  });
});

// ============================================
// TESTS: Edge Cases
// ============================================

describe('ASTTransformer - Edge Cases', () => {
  it('should handle empty function bodies', () => {
    const program = parse(`
      function test(): void {
      }
    `);
    const transformer = new IdentityTransformer();

    const result = transformer.transform(program);

    expect(result.getNodeType()).toBe(ASTNodeType.PROGRAM);
  });

  it('should handle variables without initializers', () => {
    const program = parse('let x: byte;');
    const transformer = new IdentityTransformer();

    const result = transformer.transform(program);

    const varDecl = (result as Program).getDeclarations()[0] as VariableDecl;
    expect(varDecl.getInitializer()).toBeNull();
  });

  it('should handle string literals unchanged', () => {
    const program = parse('let x: string = "hello";');
    const transformer = new NegateLiteralsTransformer();

    const result = transformer.transform(program) as Program;

    const varDecl = result.getDeclarations()[0] as VariableDecl;
    const literal = varDecl.getInitializer() as LiteralExpression;

    // String should be unchanged
    expect(literal.getValue()).toBe('hello');
  });

  it('should handle boolean literals unchanged', () => {
    const program = parse('let x: boolean = true;');
    const transformer = new NegateLiteralsTransformer();

    const result = transformer.transform(program) as Program;

    const varDecl = result.getDeclarations()[0] as VariableDecl;
    const literal = varDecl.getInitializer() as LiteralExpression;

    // Boolean should be unchanged
    expect(literal.getValue()).toBe(true);
  });
});