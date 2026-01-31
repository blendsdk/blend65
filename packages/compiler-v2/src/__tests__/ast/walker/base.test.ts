/**
 * Tests for Base AST Walker v2
 *
 * Tests cover:
 * - Default recursive traversal
 * - Parent tracking
 * - Path tracking
 * - Skip functionality
 * - Stop functionality
 *
 * NOTE: v2 does NOT include @map declarations
 */

import { describe, it, expect } from 'vitest';
import { ASTWalker } from '../../../ast/walker/base.js';
import {
  Program,
  ModuleDecl,
  FunctionDecl,
  VariableDecl,
  BinaryExpression,
  UnaryExpression,
  LiteralExpression,
  IdentifierExpression,
  CallExpression,
  ReturnStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  ExpressionStatement,
  AssignmentExpression,
  ArrayLiteralExpression,
} from '../../../ast/index.js';
import { ASTNode, ASTNodeType, SourceLocation } from '../../../ast/base.js';
import { TokenType } from '../../../lexer/types.js';

// ============================================
// TEST HELPERS
// ============================================

function loc(): SourceLocation {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
  };
}

class CollectorWalker extends ASTWalker {
  public visited: ASTNodeType[] = [];

  protected enterNode(node: ASTNode): void {
    this.visited.push(node.getNodeType());
    super.enterNode(node);
  }
}

class ParentTrackingWalker extends ASTWalker {
  public parentRelations: Array<{
    node: ASTNodeType;
    parent: ASTNodeType | null;
  }> = [];

  protected enterNode(node: ASTNode): void {
    super.enterNode(node);
    const parent = this.getParent();
    this.parentRelations.push({
      node: node.getNodeType(),
      parent: parent ? parent.getNodeType() : null,
    });
  }
}

class PathTrackingWalker extends ASTWalker {
  public paths: Array<ASTNodeType[]> = [];

  protected enterNode(node: ASTNode): void {
    super.enterNode(node);
    this.paths.push(this.getPath().map(n => n.getNodeType()));
  }
}

class FunctionSkippingWalker extends ASTWalker {
  public visited: ASTNodeType[] = [];

  protected enterNode(node: ASTNode): void {
    this.visited.push(node.getNodeType());
    super.enterNode(node);
  }

  visitFunctionDecl(node: FunctionDecl): void {
    this.enterNode(node);
    this.skip();
    this.exitNode(node);
  }
}

class EarlyStopWalker extends ASTWalker {
  public visited: ASTNodeType[] = [];

  constructor(protected readonly targetName: string) {
    super();
  }

  protected enterNode(node: ASTNode): void {
    this.visited.push(node.getNodeType());
    super.enterNode(node);
  }

  visitIdentifierExpression(node: IdentifierExpression): void {
    super.visitIdentifierExpression(node);
    if (node.getName() === this.targetName) {
      this.stop();
    }
  }
}

// ============================================
// TEST SUITES
// ============================================

describe('ASTWalker - Basic Functionality', () => {
  it('should walk a simple program', () => {
    const module = new ModuleDecl(['global'], loc());
    const program = new Program(module, [], loc());

    const walker = new CollectorWalker();
    walker.walk(program);

    expect(walker.visited).toEqual([ASTNodeType.PROGRAM, ASTNodeType.MODULE]);
  });

  it('should walk program with variable declaration', () => {
    const init = new LiteralExpression(5, loc());
    const varDecl = new VariableDecl('x', 'byte', init, loc());
    const module = new ModuleDecl(['global'], loc());
    const program = new Program(module, [varDecl], loc());

    const walker = new CollectorWalker();
    walker.walk(program);

    expect(walker.visited).toEqual([
      ASTNodeType.PROGRAM,
      ASTNodeType.MODULE,
      ASTNodeType.VARIABLE_DECL,
      ASTNodeType.LITERAL_EXPR,
    ]);
  });

  it('should walk program with function', () => {
    const returnStmt = new ReturnStatement(null, loc());
    const funcDecl = new FunctionDecl('foo', [], 'void', [returnStmt], loc());
    const module = new ModuleDecl(['global'], loc());
    const program = new Program(module, [funcDecl], loc());

    const walker = new CollectorWalker();
    walker.walk(program);

    expect(walker.visited).toEqual([
      ASTNodeType.PROGRAM,
      ASTNodeType.MODULE,
      ASTNodeType.FUNCTION_DECL,
      ASTNodeType.RETURN_STMT,
    ]);
  });
});

describe('ASTWalker - Expression Traversal', () => {
  it('should walk binary expression', () => {
    const left = new LiteralExpression(2, loc());
    const right = new LiteralExpression(3, loc());
    const binary = new BinaryExpression(left, TokenType.PLUS, right, loc());

    const walker = new CollectorWalker();
    walker.walk(binary);

    expect(walker.visited).toEqual([
      ASTNodeType.BINARY_EXPR,
      ASTNodeType.LITERAL_EXPR,
      ASTNodeType.LITERAL_EXPR,
    ]);
  });

  it('should walk nested binary expressions', () => {
    const two = new LiteralExpression(2, loc());
    const three = new LiteralExpression(3, loc());
    const four = new LiteralExpression(4, loc());
    const add = new BinaryExpression(two, TokenType.PLUS, three, loc());
    const mul = new BinaryExpression(add, TokenType.MULTIPLY, four, loc());

    const walker = new CollectorWalker();
    walker.walk(mul);

    expect(walker.visited).toEqual([
      ASTNodeType.BINARY_EXPR,
      ASTNodeType.BINARY_EXPR,
      ASTNodeType.LITERAL_EXPR,
      ASTNodeType.LITERAL_EXPR,
      ASTNodeType.LITERAL_EXPR,
    ]);
  });

  it('should walk unary expression', () => {
    const operand = new IdentifierExpression('x', loc());
    const unary = new UnaryExpression(TokenType.MINUS, operand, loc());

    const walker = new CollectorWalker();
    walker.walk(unary);

    expect(walker.visited).toEqual([ASTNodeType.UNARY_EXPR, ASTNodeType.IDENTIFIER_EXPR]);
  });

  it('should walk call expression', () => {
    const callee = new IdentifierExpression('foo', loc());
    const arg1 = new LiteralExpression(1, loc());
    const arg2 = new LiteralExpression(2, loc());
    const call = new CallExpression(callee, [arg1, arg2], loc());

    const walker = new CollectorWalker();
    walker.walk(call);

    expect(walker.visited).toEqual([
      ASTNodeType.CALL_EXPR,
      ASTNodeType.IDENTIFIER_EXPR,
      ASTNodeType.LITERAL_EXPR,
      ASTNodeType.LITERAL_EXPR,
    ]);
  });

  it('should walk assignment expression', () => {
    const target = new IdentifierExpression('x', loc());
    const value = new LiteralExpression(5, loc());
    const assign = new AssignmentExpression(target, TokenType.EQUAL, value, loc());

    const walker = new CollectorWalker();
    walker.walk(assign);

    expect(walker.visited).toEqual([
      ASTNodeType.ASSIGNMENT_EXPR,
      ASTNodeType.IDENTIFIER_EXPR,
      ASTNodeType.LITERAL_EXPR,
    ]);
  });

  it('should walk array literal expression', () => {
    const elem1 = new LiteralExpression(1, loc());
    const elem2 = new LiteralExpression(2, loc());
    const elem3 = new LiteralExpression(3, loc());
    const array = new ArrayLiteralExpression([elem1, elem2, elem3], loc());

    const walker = new CollectorWalker();
    walker.walk(array);

    expect(walker.visited).toEqual([
      ASTNodeType.ARRAY_LITERAL_EXPR,
      ASTNodeType.LITERAL_EXPR,
      ASTNodeType.LITERAL_EXPR,
      ASTNodeType.LITERAL_EXPR,
    ]);
  });
});

describe('ASTWalker - Statement Traversal', () => {
  it('should walk return statement with value', () => {
    const value = new LiteralExpression(42, loc());
    const returnStmt = new ReturnStatement(value, loc());

    const walker = new CollectorWalker();
    walker.walk(returnStmt);

    expect(walker.visited).toEqual([ASTNodeType.RETURN_STMT, ASTNodeType.LITERAL_EXPR]);
  });

  it('should walk return statement without value', () => {
    const returnStmt = new ReturnStatement(null, loc());

    const walker = new CollectorWalker();
    walker.walk(returnStmt);

    expect(walker.visited).toEqual([ASTNodeType.RETURN_STMT]);
  });

  it('should walk if statement', () => {
    const condition = new IdentifierExpression('x', loc());
    const returnValue = new LiteralExpression(1, loc());
    const thenStmt = new ReturnStatement(returnValue, loc());
    const ifStmt = new IfStatement(condition, [thenStmt], null, loc());

    const walker = new CollectorWalker();
    walker.walk(ifStmt);

    expect(walker.visited).toEqual([
      ASTNodeType.IF_STMT,
      ASTNodeType.IDENTIFIER_EXPR,
      ASTNodeType.RETURN_STMT,
      ASTNodeType.LITERAL_EXPR,
    ]);
  });

  it('should walk if statement with else', () => {
    const condition = new IdentifierExpression('x', loc());
    const thenValue = new LiteralExpression(1, loc());
    const elseValue = new LiteralExpression(2, loc());
    const thenStmt = new ReturnStatement(thenValue, loc());
    const elseStmt = new ReturnStatement(elseValue, loc());
    const ifStmt = new IfStatement(condition, [thenStmt], [elseStmt], loc());

    const walker = new CollectorWalker();
    walker.walk(ifStmt);

    expect(walker.visited).toEqual([
      ASTNodeType.IF_STMT,
      ASTNodeType.IDENTIFIER_EXPR,
      ASTNodeType.RETURN_STMT,
      ASTNodeType.LITERAL_EXPR,
      ASTNodeType.RETURN_STMT,
      ASTNodeType.LITERAL_EXPR,
    ]);
  });

  it('should walk while statement', () => {
    const condition = new IdentifierExpression('x', loc());
    const bodyStmt = new ExpressionStatement(new LiteralExpression(1, loc()), loc());
    const whileStmt = new WhileStatement(condition, [bodyStmt], loc());

    const walker = new CollectorWalker();
    walker.walk(whileStmt);

    expect(walker.visited).toEqual([
      ASTNodeType.WHILE_STMT,
      ASTNodeType.IDENTIFIER_EXPR,
      ASTNodeType.EXPR_STMT,
      ASTNodeType.LITERAL_EXPR,
    ]);
  });

  it('should walk for statement', () => {
    const start = new LiteralExpression(0, loc());
    const end = new LiteralExpression(10, loc());
    const bodyStmt = new ExpressionStatement(new LiteralExpression(1, loc()), loc());
    const forStmt = new ForStatement('i', null, start, end, 'to', null, [bodyStmt], loc());

    const walker = new CollectorWalker();
    walker.walk(forStmt);

    expect(walker.visited).toEqual([
      ASTNodeType.FOR_STMT,
      ASTNodeType.LITERAL_EXPR,
      ASTNodeType.LITERAL_EXPR,
      ASTNodeType.EXPR_STMT,
      ASTNodeType.LITERAL_EXPR,
    ]);
  });
});

describe('ASTWalker - Parent Tracking', () => {
  it('should track parent relationships', () => {
    const returnValue = new LiteralExpression(5, loc());
    const returnStmt = new ReturnStatement(returnValue, loc());
    const funcDecl = new FunctionDecl('foo', [], 'void', [returnStmt], loc());
    const module = new ModuleDecl(['global'], loc());
    const program = new Program(module, [funcDecl], loc());

    const walker = new ParentTrackingWalker();
    walker.walk(program);

    expect(walker.parentRelations).toEqual([
      { node: ASTNodeType.PROGRAM, parent: null },
      { node: ASTNodeType.MODULE, parent: ASTNodeType.PROGRAM },
      { node: ASTNodeType.FUNCTION_DECL, parent: ASTNodeType.PROGRAM },
      { node: ASTNodeType.RETURN_STMT, parent: ASTNodeType.FUNCTION_DECL },
      { node: ASTNodeType.LITERAL_EXPR, parent: ASTNodeType.RETURN_STMT },
    ]);
  });

  it('should track parent for nested expressions', () => {
    const left = new LiteralExpression(2, loc());
    const right = new LiteralExpression(3, loc());
    const binary = new BinaryExpression(left, TokenType.PLUS, right, loc());

    const walker = new ParentTrackingWalker();
    walker.walk(binary);

    expect(walker.parentRelations).toEqual([
      { node: ASTNodeType.BINARY_EXPR, parent: null },
      { node: ASTNodeType.LITERAL_EXPR, parent: ASTNodeType.BINARY_EXPR },
      { node: ASTNodeType.LITERAL_EXPR, parent: ASTNodeType.BINARY_EXPR },
    ]);
  });
});

describe('ASTWalker - Path Tracking', () => {
  it('should track full path from root', () => {
    const returnValue = new LiteralExpression(5, loc());
    const returnStmt = new ReturnStatement(returnValue, loc());
    const funcDecl = new FunctionDecl('foo', [], 'void', [returnStmt], loc());
    const module = new ModuleDecl(['global'], loc());
    const program = new Program(module, [funcDecl], loc());

    const walker = new PathTrackingWalker();
    walker.walk(program);

    const literalPath = walker.paths[walker.paths.length - 1];
    expect(literalPath).toEqual([
      ASTNodeType.PROGRAM,
      ASTNodeType.FUNCTION_DECL,
      ASTNodeType.RETURN_STMT,
      ASTNodeType.LITERAL_EXPR,
    ]);
  });
});

describe('ASTWalker - Skip Functionality', () => {
  it('should skip function body when requested', () => {
    const returnValue = new LiteralExpression(5, loc());
    const returnStmt = new ReturnStatement(returnValue, loc());
    const funcDecl = new FunctionDecl('foo', [], 'void', [returnStmt], loc());
    const module = new ModuleDecl(['global'], loc());
    const program = new Program(module, [funcDecl], loc());

    const walker = new FunctionSkippingWalker();
    walker.walk(program);

    expect(walker.visited).toEqual([
      ASTNodeType.PROGRAM,
      ASTNodeType.MODULE,
      ASTNodeType.FUNCTION_DECL,
    ]);
  });
});

describe('ASTWalker - Stop Functionality', () => {
  it('should stop traversal when requested', () => {
    const varDecl = new VariableDecl('x', 'byte', new LiteralExpression(5, loc()), loc());
    const targetId = new IdentifierExpression('target', loc());
    const returnStmt = new ReturnStatement(targetId, loc());
    const funcDecl = new FunctionDecl('foo', [], 'void', [varDecl, returnStmt], loc());
    const module = new ModuleDecl(['global'], loc());
    const program = new Program(module, [funcDecl], loc());

    const walker = new EarlyStopWalker('target');
    walker.walk(program);

    expect(walker.visited).toContain(ASTNodeType.IDENTIFIER_EXPR);
    const targetIndex = walker.visited.indexOf(ASTNodeType.IDENTIFIER_EXPR);
    expect(targetIndex).toBeGreaterThan(-1);
    expect(walker.visited.length).toBe(targetIndex + 1);
  });

  it('should stop immediately without visiting siblings', () => {
    const elem1 = new LiteralExpression(1, loc());
    const elem2 = new IdentifierExpression('target', loc());
    const elem3 = new LiteralExpression(3, loc());
    const array = new ArrayLiteralExpression([elem1, elem2, elem3], loc());

    const walker = new EarlyStopWalker('target');
    walker.walk(array);

    expect(walker.visited).toEqual([
      ASTNodeType.ARRAY_LITERAL_EXPR,
      ASTNodeType.LITERAL_EXPR,
      ASTNodeType.IDENTIFIER_EXPR,
    ]);
  });
});

describe('ASTWalker - Edge Cases', () => {
  it('should handle empty array literal', () => {
    const array = new ArrayLiteralExpression([], loc());

    const walker = new CollectorWalker();
    walker.walk(array);

    expect(walker.visited).toEqual([ASTNodeType.ARRAY_LITERAL_EXPR]);
  });

  it('should handle function with empty body', () => {
    const funcDecl = new FunctionDecl('foo', [], 'void', [], loc());

    const walker = new CollectorWalker();
    walker.walk(funcDecl);

    expect(walker.visited).toEqual([ASTNodeType.FUNCTION_DECL]);
  });

  it('should handle variable without initializer', () => {
    const varDecl = new VariableDecl('x', 'byte', null, loc());

    const walker = new CollectorWalker();
    walker.walk(varDecl);

    expect(walker.visited).toEqual([ASTNodeType.VARIABLE_DECL]);
  });

  it('should allow multiple walk() calls on same walker', () => {
    const expr1 = new LiteralExpression(1, loc());
    const expr2 = new LiteralExpression(2, loc());

    const walker = new CollectorWalker();

    walker.walk(expr1);
    expect(walker.visited).toEqual([ASTNodeType.LITERAL_EXPR]);

    walker.visited = [];
    walker.walk(expr2);
    expect(walker.visited).toEqual([ASTNodeType.LITERAL_EXPR]);
  });
});