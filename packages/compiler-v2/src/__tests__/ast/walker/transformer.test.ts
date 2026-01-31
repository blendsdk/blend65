/**
 * Tests for AST Transformer Infrastructure v2
 *
 * Tests cover:
 * - Immutable transformations (unchanged nodes return same reference)
 * - Changed nodes return new instances
 * - Recursive transformation through the tree
 * - Various node types (expressions, statements, declarations)
 * - Edge cases (null values, empty arrays)
 *
 * NOTE: v2 does NOT include @map declarations - removed for Static Frame Allocation
 */

import { describe, it, expect } from 'vitest';
import { ASTTransformer } from '../../../ast/walker/transformer.js';
import {
  Program,
  ModuleDecl,
  FunctionDecl,
  VariableDecl,
  BinaryExpression,
  UnaryExpression,
  TernaryExpression,
  LiteralExpression,
  IdentifierExpression,
  CallExpression,
  IndexExpression,
  MemberExpression,
  AssignmentExpression,
  ArrayLiteralExpression,
  ReturnStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  ExpressionStatement,
  BlockStatement,
  BreakStatement,
  ContinueStatement,
} from '../../../ast/index.js';
import { ASTNode, SourceLocation, Expression, Statement } from '../../../ast/base.js';
import { TokenType } from '../../../lexer/types.js';

// ============================================
// TEST HELPERS
// ============================================

/**
 * Creates a minimal source location for test nodes
 */
function loc(): SourceLocation {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
  };
}

/**
 * Identity transformer - returns all nodes unchanged
 * Used to test that unchanged nodes return the same reference
 */
class IdentityTransformer extends ASTTransformer {
  // Uses all default implementations which return nodes unchanged
}

/**
 * Transformer that doubles all literal number values
 * Example: 5 becomes 10, 3 becomes 6
 */
class DoubleLiteralsTransformer extends ASTTransformer {
  visitLiteralExpression(node: LiteralExpression): ASTNode {
    const value = node.getValue();
    if (typeof value === 'number') {
      return new LiteralExpression(value * 2, node.getLocation());
    }
    return node;
  }
}

/**
 * Transformer that renames identifiers
 */
class RenameIdentifierTransformer extends ASTTransformer {
  constructor(
    protected readonly oldName: string,
    protected readonly newName: string
  ) {
    super();
  }

  visitIdentifierExpression(node: IdentifierExpression): ASTNode {
    if (node.getName() === this.oldName) {
      return new IdentifierExpression(this.newName, node.getLocation());
    }
    return node;
  }
}

/**
 * Transformer that converts unary negation to subtraction from zero
 * Example: -x becomes 0 - x
 */
class NegationToSubtractionTransformer extends ASTTransformer {
  visitUnaryExpression(node: UnaryExpression): ASTNode {
    if (node.getOperator() === TokenType.MINUS) {
      const zero = new LiteralExpression(0, node.getLocation());
      const operand = node.getOperand().accept(this) as Expression;
      return new BinaryExpression(zero, TokenType.MINUS, operand, node.getLocation());
    }
    return node;
  }
}

/**
 * Transformer that wraps return values in a call to "log"
 * Example: return x; becomes return log(x);
 */
class WrapReturnWithLogTransformer extends ASTTransformer {
  visitReturnStatement(node: ReturnStatement): ASTNode {
    const value = node.getValue();
    if (value) {
      const transformedValue = value.accept(this) as Expression;
      const logCallee = new IdentifierExpression('log', node.getLocation());
      const logCall = new CallExpression(logCallee, [transformedValue], node.getLocation());
      return new ReturnStatement(logCall, node.getLocation());
    }
    return node;
  }
}

/**
 * Transformer that counts how many nodes were visited
 */
class CountingTransformer extends ASTTransformer {
  public visitCount = 0;

  visitLiteralExpression(node: LiteralExpression): ASTNode {
    this.visitCount++;
    return node;
  }

  visitIdentifierExpression(node: IdentifierExpression): ASTNode {
    this.visitCount++;
    return node;
  }

  visitBinaryExpression(node: BinaryExpression): ASTNode {
    this.visitCount++;
    return super.visitBinaryExpression(node);
  }
}

// ============================================
// TEST SUITES
// ============================================

describe('ASTTransformer - Identity Transformation', () => {
  it('should return same reference for unchanged literal', () => {
    const literal = new LiteralExpression(42, loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(literal);

    expect(result).toBe(literal);
  });

  it('should return same reference for unchanged identifier', () => {
    const identifier = new IdentifierExpression('foo', loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(identifier);

    expect(result).toBe(identifier);
  });

  it('should return same reference for unchanged binary expression', () => {
    const left = new LiteralExpression(2, loc());
    const right = new LiteralExpression(3, loc());
    const binary = new BinaryExpression(left, TokenType.PLUS, right, loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(binary);

    expect(result).toBe(binary);
  });

  it('should return same reference for unchanged ternary expression', () => {
    const condition = new IdentifierExpression('flag', loc());
    const thenBranch = new LiteralExpression(1, loc());
    const elseBranch = new LiteralExpression(2, loc());
    const ternary = new TernaryExpression(condition, thenBranch, elseBranch, loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(ternary);

    expect(result).toBe(ternary);
  });

  it('should return same reference for unchanged program', () => {
    const module = new ModuleDecl(['global'], loc());
    const program = new Program(module, [], loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(program);

    expect(result).toBe(program);
  });

  it('should return same reference for unchanged variable declaration', () => {
    const init = new LiteralExpression(10, loc());
    const varDecl = new VariableDecl('x', 'byte', init, loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(varDecl);

    expect(result).toBe(varDecl);
  });

  it('should return same reference for unchanged function declaration', () => {
    const returnStmt = new ReturnStatement(null, loc());
    const funcDecl = new FunctionDecl('foo', [], 'void', [returnStmt], loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(funcDecl);

    expect(result).toBe(funcDecl);
  });

  it('should return same reference for unchanged return statement', () => {
    const value = new LiteralExpression(5, loc());
    const returnStmt = new ReturnStatement(value, loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(returnStmt);

    expect(result).toBe(returnStmt);
  });
});

describe('ASTTransformer - Literal Transformation', () => {
  it('should double a simple literal value', () => {
    const literal = new LiteralExpression(5, loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(literal) as LiteralExpression;

    expect(result).not.toBe(literal);
    expect(result.getValue()).toBe(10);
  });

  it('should double literals in binary expression', () => {
    const left = new LiteralExpression(2, loc());
    const right = new LiteralExpression(3, loc());
    const binary = new BinaryExpression(left, TokenType.PLUS, right, loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(binary) as BinaryExpression;

    expect(result).not.toBe(binary);
    expect((result.getLeft() as LiteralExpression).getValue()).toBe(4);
    expect((result.getRight() as LiteralExpression).getValue()).toBe(6);
  });

  it('should double nested literals in ternary expression', () => {
    const condition = new IdentifierExpression('flag', loc());
    const thenBranch = new LiteralExpression(10, loc());
    const elseBranch = new LiteralExpression(20, loc());
    const ternary = new TernaryExpression(condition, thenBranch, elseBranch, loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(ternary) as TernaryExpression;

    expect(result).not.toBe(ternary);
    expect((result.getThenBranch() as LiteralExpression).getValue()).toBe(20);
    expect((result.getElseBranch() as LiteralExpression).getValue()).toBe(40);
    // Condition identifier should be unchanged
    expect(result.getCondition()).toBe(condition);
  });

  it('should preserve non-numeric literals', () => {
    const stringLiteral = new LiteralExpression('hello', loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(stringLiteral);

    expect(result).toBe(stringLiteral);
  });

  it('should double literal in variable declaration initializer', () => {
    const init = new LiteralExpression(5, loc());
    const varDecl = new VariableDecl('x', 'byte', init, loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(varDecl) as VariableDecl;

    expect(result).not.toBe(varDecl);
    expect(result.getName()).toBe('x');
    expect((result.getInitializer() as LiteralExpression).getValue()).toBe(10);
  });

  it('should double literal in return statement', () => {
    const value = new LiteralExpression(7, loc());
    const returnStmt = new ReturnStatement(value, loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(returnStmt) as ReturnStatement;

    expect(result).not.toBe(returnStmt);
    expect((result.getValue() as LiteralExpression).getValue()).toBe(14);
  });

  it('should double literals in function body', () => {
    const returnValue = new LiteralExpression(5, loc());
    const returnStmt = new ReturnStatement(returnValue, loc());
    const funcDecl = new FunctionDecl('foo', [], 'byte', [returnStmt], loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(funcDecl) as FunctionDecl;

    expect(result).not.toBe(funcDecl);
    const transformedReturn = result.getBody()![0] as ReturnStatement;
    expect((transformedReturn.getValue() as LiteralExpression).getValue()).toBe(10);
  });

  it('should double literals in program declarations', () => {
    const init = new LiteralExpression(3, loc());
    const varDecl = new VariableDecl('x', 'byte', init, loc());
    const module = new ModuleDecl(['global'], loc());
    const program = new Program(module, [varDecl], loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(program) as Program;

    expect(result).not.toBe(program);
    const transformedDecl = result.getDeclarations()[0] as VariableDecl;
    expect((transformedDecl.getInitializer() as LiteralExpression).getValue()).toBe(6);
  });
});

describe('ASTTransformer - Identifier Renaming', () => {
  it('should rename matching identifier', () => {
    const identifier = new IdentifierExpression('oldName', loc());
    const transformer = new RenameIdentifierTransformer('oldName', 'newName');

    const result = transformer.transform(identifier) as IdentifierExpression;

    expect(result).not.toBe(identifier);
    expect(result.getName()).toBe('newName');
  });

  it('should not rename non-matching identifier', () => {
    const identifier = new IdentifierExpression('otherName', loc());
    const transformer = new RenameIdentifierTransformer('oldName', 'newName');

    const result = transformer.transform(identifier);

    expect(result).toBe(identifier);
  });

  it('should rename identifier in binary expression', () => {
    const left = new IdentifierExpression('x', loc());
    const right = new LiteralExpression(1, loc());
    const binary = new BinaryExpression(left, TokenType.PLUS, right, loc());
    const transformer = new RenameIdentifierTransformer('x', 'y');

    const result = transformer.transform(binary) as BinaryExpression;

    expect(result).not.toBe(binary);
    expect((result.getLeft() as IdentifierExpression).getName()).toBe('y');
    expect(result.getRight()).toBe(right);
  });

  it('should rename multiple occurrences of same identifier', () => {
    const left = new IdentifierExpression('x', loc());
    const right = new IdentifierExpression('x', loc());
    const binary = new BinaryExpression(left, TokenType.MULTIPLY, right, loc());
    const transformer = new RenameIdentifierTransformer('x', 'y');

    const result = transformer.transform(binary) as BinaryExpression;

    expect((result.getLeft() as IdentifierExpression).getName()).toBe('y');
    expect((result.getRight() as IdentifierExpression).getName()).toBe('y');
  });
});

describe('ASTTransformer - Complex Transformations', () => {
  it('should convert unary negation to subtraction from zero', () => {
    const operand = new IdentifierExpression('x', loc());
    const unary = new UnaryExpression(TokenType.MINUS, operand, loc());
    const transformer = new NegationToSubtractionTransformer();

    const result = transformer.transform(unary) as BinaryExpression;

    expect(result).toBeInstanceOf(BinaryExpression);
    expect((result.getLeft() as LiteralExpression).getValue()).toBe(0);
    expect(result.getOperator()).toBe(TokenType.MINUS);
    expect((result.getRight() as IdentifierExpression).getName()).toBe('x');
  });

  it('should wrap return value with log call', () => {
    const value = new IdentifierExpression('result', loc());
    const returnStmt = new ReturnStatement(value, loc());
    const transformer = new WrapReturnWithLogTransformer();

    const result = transformer.transform(returnStmt) as ReturnStatement;

    expect(result).not.toBe(returnStmt);
    const logCall = result.getValue() as CallExpression;
    expect(logCall).toBeInstanceOf(CallExpression);
    expect((logCall.getCallee() as IdentifierExpression).getName()).toBe('log');
    expect(logCall.getArguments()).toHaveLength(1);
    expect((logCall.getArguments()[0] as IdentifierExpression).getName()).toBe('result');
  });

  it('should not wrap return statement without value', () => {
    const returnStmt = new ReturnStatement(null, loc());
    const transformer = new WrapReturnWithLogTransformer();

    const result = transformer.transform(returnStmt);

    expect(result).toBe(returnStmt);
  });
});

describe('ASTTransformer - Structural Sharing', () => {
  it('should preserve unchanged subtrees', () => {
    const unchangedLeft = new IdentifierExpression('unchanged', loc());
    const changedRight = new LiteralExpression(5, loc());
    const binary = new BinaryExpression(unchangedLeft, TokenType.PLUS, changedRight, loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(binary) as BinaryExpression;

    expect(result).not.toBe(binary);
    expect(result.getLeft()).toBe(unchangedLeft); // Same reference
    expect(result.getRight()).not.toBe(changedRight); // Different reference
  });

  it('should preserve unchanged module in program', () => {
    const module = new ModuleDecl(['global'], loc());
    const init = new LiteralExpression(5, loc());
    const varDecl = new VariableDecl('x', 'byte', init, loc());
    const program = new Program(module, [varDecl], loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(program) as Program;

    expect(result).not.toBe(program);
    expect(result.getModule()).toBe(module); // Module unchanged
    expect(result.getDeclarations()[0]).not.toBe(varDecl); // Declaration changed
  });

  it('should preserve unchanged function metadata', () => {
    const returnValue = new LiteralExpression(5, loc());
    const returnStmt = new ReturnStatement(returnValue, loc());
    const funcDecl = new FunctionDecl('foo', [], 'byte', [returnStmt], loc(), true, false, false);
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(funcDecl) as FunctionDecl;

    expect(result).not.toBe(funcDecl);
    expect(result.getName()).toBe('foo');
    expect(result.getReturnType()).toBe('byte');
    expect(result.isExportedFunction()).toBe(true);
  });
});

describe('ASTTransformer - Edge Cases', () => {
  it('should handle variable declaration without initializer', () => {
    const varDecl = new VariableDecl('x', 'byte', null, loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(varDecl);

    expect(result).toBe(varDecl);
  });

  it('should handle function with null body', () => {
    const funcDecl = new FunctionDecl('foo', [], 'void', null, loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(funcDecl);

    expect(result).toBe(funcDecl);
  });

  it('should handle function with empty body', () => {
    const funcDecl = new FunctionDecl('foo', [], 'void', [], loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(funcDecl);

    expect(result).toBe(funcDecl);
  });

  it('should handle program with no declarations', () => {
    const module = new ModuleDecl(['global'], loc());
    const program = new Program(module, [], loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(program);

    expect(result).toBe(program);
  });

  it('should handle deeply nested transformations', () => {
    // Build: ((1 + 2) + (3 + 4))
    const one = new LiteralExpression(1, loc());
    const two = new LiteralExpression(2, loc());
    const three = new LiteralExpression(3, loc());
    const four = new LiteralExpression(4, loc());
    const left = new BinaryExpression(one, TokenType.PLUS, two, loc());
    const right = new BinaryExpression(three, TokenType.PLUS, four, loc());
    const root = new BinaryExpression(left, TokenType.PLUS, right, loc());
    const transformer = new DoubleLiteralsTransformer();

    const result = transformer.transform(root) as BinaryExpression;

    expect(result).not.toBe(root);
    const resultLeft = result.getLeft() as BinaryExpression;
    const resultRight = result.getRight() as BinaryExpression;
    expect((resultLeft.getLeft() as LiteralExpression).getValue()).toBe(2);
    expect((resultLeft.getRight() as LiteralExpression).getValue()).toBe(4);
    expect((resultRight.getLeft() as LiteralExpression).getValue()).toBe(6);
    expect((resultRight.getRight() as LiteralExpression).getValue()).toBe(8);
  });
});

describe('ASTTransformer - Node Types Not Fully Implemented', () => {
  /**
   * These tests verify default behavior for nodes where the base
   * transformer returns the node unchanged. Subclasses can override.
   */

  it('should return unary expression unchanged by default', () => {
    const operand = new LiteralExpression(5, loc());
    const unary = new UnaryExpression(TokenType.MINUS, operand, loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(unary);

    expect(result).toBe(unary);
  });

  it('should return call expression unchanged by default', () => {
    const callee = new IdentifierExpression('foo', loc());
    const arg = new LiteralExpression(1, loc());
    const call = new CallExpression(callee, [arg], loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(call);

    expect(result).toBe(call);
  });

  it('should return if statement unchanged by default', () => {
    const condition = new IdentifierExpression('flag', loc());
    const thenStmt = new ReturnStatement(null, loc());
    const ifStmt = new IfStatement(condition, [thenStmt], null, loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(ifStmt);

    expect(result).toBe(ifStmt);
  });

  it('should return while statement unchanged by default', () => {
    const condition = new IdentifierExpression('running', loc());
    const bodyStmt = new BreakStatement(loc());
    const whileStmt = new WhileStatement(condition, [bodyStmt], loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(whileStmt);

    expect(result).toBe(whileStmt);
  });

  it('should return for statement unchanged by default', () => {
    const start = new LiteralExpression(0, loc());
    const end = new LiteralExpression(10, loc());
    const bodyStmt = new ContinueStatement(loc());
    const forStmt = new ForStatement('i', null, start, end, 'to', null, [bodyStmt], loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(forStmt);

    expect(result).toBe(forStmt);
  });

  it('should return index expression unchanged by default', () => {
    const object = new IdentifierExpression('arr', loc());
    const index = new LiteralExpression(0, loc());
    const indexExpr = new IndexExpression(object, index, loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(indexExpr);

    expect(result).toBe(indexExpr);
  });

  it('should return member expression unchanged by default', () => {
    const object = new IdentifierExpression('obj', loc());
    const memberExpr = new MemberExpression(object, 'field', loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(memberExpr);

    expect(result).toBe(memberExpr);
  });

  it('should return assignment expression unchanged by default', () => {
    const target = new IdentifierExpression('x', loc());
    const value = new LiteralExpression(5, loc());
    const assign = new AssignmentExpression(target, TokenType.EQUAL, value, loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(assign);

    expect(result).toBe(assign);
  });

  it('should return array literal expression unchanged by default', () => {
    const elem1 = new LiteralExpression(1, loc());
    const elem2 = new LiteralExpression(2, loc());
    const array = new ArrayLiteralExpression([elem1, elem2], loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(array);

    expect(result).toBe(array);
  });

  it('should return expression statement unchanged by default', () => {
    const expr = new LiteralExpression(42, loc());
    const exprStmt = new ExpressionStatement(expr, loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(exprStmt);

    expect(result).toBe(exprStmt);
  });

  it('should return block statement unchanged by default', () => {
    const stmt = new ReturnStatement(null, loc());
    const block = new BlockStatement([stmt], loc());
    const transformer = new IdentityTransformer();

    const result = transformer.transform(block);

    expect(result).toBe(block);
  });
});

describe('ASTTransformer - Counting and Verification', () => {
  it('should visit all nodes during transformation', () => {
    const left = new LiteralExpression(1, loc());
    const right = new LiteralExpression(2, loc());
    const binary = new BinaryExpression(left, TokenType.PLUS, right, loc());
    const transformer = new CountingTransformer();

    transformer.transform(binary);

    expect(transformer.visitCount).toBe(3); // binary + 2 literals
  });

  it('should handle multiple transformations with same transformer', () => {
    const expr1 = new LiteralExpression(5, loc());
    const expr2 = new LiteralExpression(10, loc());
    const transformer = new DoubleLiteralsTransformer();

    const result1 = transformer.transform(expr1) as LiteralExpression;
    const result2 = transformer.transform(expr2) as LiteralExpression;

    expect(result1.getValue()).toBe(10);
    expect(result2.getValue()).toBe(20);
  });
});

describe('ASTTransformer - Combined Transformations', () => {
  it('should chain transformers for multiple passes', () => {
    // Start with: x + 5
    const x = new IdentifierExpression('x', loc());
    const five = new LiteralExpression(5, loc());
    const binary = new BinaryExpression(x, TokenType.PLUS, five, loc());

    // Pass 1: Rename x to y
    const renamer = new RenameIdentifierTransformer('x', 'y');
    const afterRename = renamer.transform(binary) as BinaryExpression;

    // Pass 2: Double literals
    const doubler = new DoubleLiteralsTransformer();
    const afterDouble = doubler.transform(afterRename) as BinaryExpression;

    // Result should be: y + 10
    expect((afterDouble.getLeft() as IdentifierExpression).getName()).toBe('y');
    expect((afterDouble.getRight() as LiteralExpression).getValue()).toBe(10);
  });

  it('should transform complex program with multiple declarations', () => {
    // Build program:
    // module global;
    // let x: byte = 5;
    // fn foo(): byte { return 10; }
    const module = new ModuleDecl(['global'], loc());
    const varInit = new LiteralExpression(5, loc());
    const varDecl = new VariableDecl('x', 'byte', varInit, loc());
    const returnValue = new LiteralExpression(10, loc());
    const returnStmt = new ReturnStatement(returnValue, loc());
    const funcDecl = new FunctionDecl('foo', [], 'byte', [returnStmt], loc());
    const program = new Program(module, [varDecl, funcDecl], loc());

    const transformer = new DoubleLiteralsTransformer();
    const result = transformer.transform(program) as Program;

    // Both declarations should be transformed
    const transformedVar = result.getDeclarations()[0] as VariableDecl;
    const transformedFunc = result.getDeclarations()[1] as FunctionDecl;

    expect((transformedVar.getInitializer() as LiteralExpression).getValue()).toBe(10);

    const transformedReturn = transformedFunc.getBody()![0] as ReturnStatement;
    expect((transformedReturn.getValue() as LiteralExpression).getValue()).toBe(20);
  });
});