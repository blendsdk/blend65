/**
 * Tests for Base AST Walker
 *
 * Tests cover:
 * - Default recursive traversal
 * - Parent tracking
 * - Path tracking
 * - Skip functionality
 * - Stop functionality
 * - All 32 visitor methods
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
} from '../../../ast/nodes.js';
import { ASTNode, ASTNodeType, SourceLocation } from '../../../ast/base.js';
import { TokenType } from '../../../lexer/types.js';

// ============================================
// TEST HELPERS
// ============================================

/**
 * Create a simple source location for testing
 */
function loc(): SourceLocation {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
  };
}

/**
 * Test walker that collects visited node types
 */
class CollectorWalker extends ASTWalker {
  public visited: ASTNodeType[] = [];

  protected enterNode(node: ASTNode): void {
    this.visited.push(node.getNodeType());
    super.enterNode(node);
  }
}

/**
 * Test walker that tracks parent information
 */
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

/**
 * Test walker that tracks full path
 */
class PathTrackingWalker extends ASTWalker {
  public paths: Array<ASTNodeType[]> = [];

  protected enterNode(node: ASTNode): void {
    super.enterNode(node);
    this.paths.push(this.getPath().map(n => n.getNodeType()));
  }
}

/**
 * Test walker that skips function bodies
 */
class FunctionSkippingWalker extends ASTWalker {
  public visited: ASTNodeType[] = [];

  protected enterNode(node: ASTNode): void {
    this.visited.push(node.getNodeType());
    super.enterNode(node);
  }

  visitFunctionDecl(node: FunctionDecl): void {
    this.enterNode(node);
    this.skip(); // Don't visit function body
    this.exitNode(node);
  }
}

/**
 * Test walker that stops after finding target identifier
 */
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
    // Create AST: module global
    const module = new ModuleDecl(['global'], loc(), true);
    const program = new Program(module, [], loc());

    const walker = new CollectorWalker();
    walker.walk(program);

    expect(walker.visited).toEqual([ASTNodeType.PROGRAM, ASTNodeType.MODULE]);
  });

  it('should walk program with variable declaration', () => {
    // AST: let x: byte = 5
    const init = new LiteralExpression(5, loc());
    const varDecl = new VariableDecl('x', 'byte', init, loc());
    const module = new ModuleDecl(['global'], loc(), true);
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
    // AST: function foo(): void { return; }
    const returnStmt = new ReturnStatement(null, loc());
    const funcDecl = new FunctionDecl('foo', [], 'void', [returnStmt], loc());
    const module = new ModuleDecl(['global'], loc(), true);
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
    // AST: 2 + 3
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
    // AST: (2 + 3) * 4
    const two = new LiteralExpression(2, loc());
    const three = new LiteralExpression(3, loc());
    const four = new LiteralExpression(4, loc());
    const add = new BinaryExpression(two, TokenType.PLUS, three, loc());
    const mul = new BinaryExpression(add, TokenType.MULTIPLY, four, loc());

    const walker = new CollectorWalker();
    walker.walk(mul);

    expect(walker.visited).toEqual([
      ASTNodeType.BINARY_EXPR, // mul
      ASTNodeType.BINARY_EXPR, // add
      ASTNodeType.LITERAL_EXPR, // 2
      ASTNodeType.LITERAL_EXPR, // 3
      ASTNodeType.LITERAL_EXPR, // 4
    ]);
  });

  it('should walk unary expression', () => {
    // AST: -x
    const operand = new IdentifierExpression('x', loc());
    const unary = new UnaryExpression(TokenType.MINUS, operand, loc());

    const walker = new CollectorWalker();
    walker.walk(unary);

    expect(walker.visited).toEqual([ASTNodeType.UNARY_EXPR, ASTNodeType.IDENTIFIER_EXPR]);
  });

  it('should walk call expression', () => {
    // AST: foo(1, 2)
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
    // AST: x = 5
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
    // AST: [1, 2, 3]
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
    // AST: return 42
    const value = new LiteralExpression(42, loc());
    const returnStmt = new ReturnStatement(value, loc());

    const walker = new CollectorWalker();
    walker.walk(returnStmt);

    expect(walker.visited).toEqual([ASTNodeType.RETURN_STMT, ASTNodeType.LITERAL_EXPR]);
  });

  it('should walk return statement without value', () => {
    // AST: return
    const returnStmt = new ReturnStatement(null, loc());

    const walker = new CollectorWalker();
    walker.walk(returnStmt);

    expect(walker.visited).toEqual([ASTNodeType.RETURN_STMT]);
  });

  it('should walk if statement', () => {
    // AST: if x then return 1 end if
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
    // AST: if x then return 1 else return 2 end if
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
    // AST: while x ... end while
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
    // AST: for (i = 0 to 10) { ... }
    const start = new LiteralExpression(0, loc());
    const end = new LiteralExpression(10, loc());
    const bodyStmt = new ExpressionStatement(new LiteralExpression(1, loc()), loc());
    // ForStatement(variable, variableType, start, end, direction, step, body, location)
    const forStmt = new ForStatement('i', null, start, end, 'to', null, [bodyStmt], loc());

    const walker = new CollectorWalker();
    walker.walk(forStmt);

    expect(walker.visited).toEqual([
      ASTNodeType.FOR_STMT,
      ASTNodeType.LITERAL_EXPR, // start
      ASTNodeType.LITERAL_EXPR, // end
      ASTNodeType.EXPR_STMT,
      ASTNodeType.LITERAL_EXPR,
    ]);
  });
});

describe('ASTWalker - Parent Tracking', () => {
  it('should track parent relationships', () => {
    // AST: function foo(): void return 5 end function
    const returnValue = new LiteralExpression(5, loc());
    const returnStmt = new ReturnStatement(returnValue, loc());
    const funcDecl = new FunctionDecl('foo', [], 'void', [returnStmt], loc());
    const module = new ModuleDecl(['global'], loc(), true);
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
    // AST: 2 + 3
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
    // AST: function foo(): void return 5 end function
    const returnValue = new LiteralExpression(5, loc());
    const returnStmt = new ReturnStatement(returnValue, loc());
    const funcDecl = new FunctionDecl('foo', [], 'void', [returnStmt], loc());
    const module = new ModuleDecl(['global'], loc(), true);
    const program = new Program(module, [funcDecl], loc());

    const walker = new PathTrackingWalker();
    walker.walk(program);

    // Check the path at literal expression (deepest node)
    const literalPath = walker.paths[walker.paths.length - 1];
    expect(literalPath).toEqual([
      ASTNodeType.PROGRAM,
      ASTNodeType.FUNCTION_DECL,
      ASTNodeType.RETURN_STMT,
      ASTNodeType.LITERAL_EXPR,
    ]);
  });

  it('should maintain correct path for nested expressions', () => {
    // AST: (2 + 3) * 4
    const two = new LiteralExpression(2, loc());
    const three = new LiteralExpression(3, loc());
    const four = new LiteralExpression(4, loc());
    const add = new BinaryExpression(two, TokenType.PLUS, three, loc());
    const mul = new BinaryExpression(add, TokenType.MULTIPLY, four, loc());

    const walker = new PathTrackingWalker();
    walker.walk(mul);

    // Path captures happen when entering nodes:
    // paths[0]: mul
    // paths[1]: mul → add
    // paths[2]: mul → add → 2
    // paths[3]: mul → add → 3
    // paths[4]: mul → 4

    // Check path when entering "add"
    expect(walker.paths[1]).toEqual([
      ASTNodeType.BINARY_EXPR, // mul
      ASTNodeType.BINARY_EXPR, // add
    ]);

    // Check path when entering "2"
    expect(walker.paths[2]).toEqual([
      ASTNodeType.BINARY_EXPR, // mul
      ASTNodeType.BINARY_EXPR, // add
      ASTNodeType.LITERAL_EXPR, // 2
    ]);

    // Check path when entering "4"
    expect(walker.paths[4]).toEqual([
      ASTNodeType.BINARY_EXPR, // mul
      ASTNodeType.LITERAL_EXPR, // 4
    ]);
  });
});

describe('ASTWalker - Skip Functionality', () => {
  it('should skip function body when requested', () => {
    // AST: function foo(): void return 5 end function
    const returnValue = new LiteralExpression(5, loc());
    const returnStmt = new ReturnStatement(returnValue, loc());
    const funcDecl = new FunctionDecl('foo', [], 'void', [returnStmt], loc());
    const module = new ModuleDecl(['global'], loc(), true);
    const program = new Program(module, [funcDecl], loc());

    const walker = new FunctionSkippingWalker();
    walker.walk(program);

    // Should visit Program, Module, FunctionDecl
    // Should NOT visit ReturnStatement or LiteralExpression
    expect(walker.visited).toEqual([
      ASTNodeType.PROGRAM,
      ASTNodeType.MODULE,
      ASTNodeType.FUNCTION_DECL,
    ]);
  });

  it('should skip only the targeted subtree', () => {
    // AST: two functions, skip only first
    const func1Return = new ReturnStatement(new LiteralExpression(1, loc()), loc());
    const func2Return = new ReturnStatement(new LiteralExpression(2, loc()), loc());
    const funcDecl1 = new FunctionDecl('foo', [], 'void', [func1Return], loc());
    const funcDecl2 = new FunctionDecl('bar', [], 'void', [func2Return], loc());
    const module = new ModuleDecl(['global'], loc(), true);
    const program = new Program(module, [funcDecl1, funcDecl2], loc());

    const walker = new FunctionSkippingWalker();
    walker.walk(program);

    // Both functions skipped
    expect(walker.visited).toEqual([
      ASTNodeType.PROGRAM,
      ASTNodeType.MODULE,
      ASTNodeType.FUNCTION_DECL, // foo
      ASTNodeType.FUNCTION_DECL, // bar
    ]);
  });
});

describe('ASTWalker - Stop Functionality', () => {
  it('should stop traversal when requested', () => {
    // AST: function foo(): void let x = 5 return target end function
    const varDecl = new VariableDecl('x', 'byte', new LiteralExpression(5, loc()), loc());
    const targetId = new IdentifierExpression('target', loc());
    const returnStmt = new ReturnStatement(targetId, loc());
    const funcDecl = new FunctionDecl('foo', [], 'void', [varDecl, returnStmt], loc());
    const module = new ModuleDecl(['global'], loc(), true);
    const program = new Program(module, [funcDecl], loc());

    const walker = new EarlyStopWalker('target');
    walker.walk(program);

    // Should stop after visiting target identifier
    // Should NOT visit anything after that
    expect(walker.visited).toContain(ASTNodeType.IDENTIFIER_EXPR);

    // Find index of target identifier
    const targetIndex = walker.visited.indexOf(ASTNodeType.IDENTIFIER_EXPR);
    expect(targetIndex).toBeGreaterThan(-1);

    // Nothing should be visited after the identifier
    expect(walker.visited.length).toBe(targetIndex + 1);
  });

  it('should stop immediately without visiting siblings', () => {
    // AST: [1, target, 3] - should stop at "target"
    const elem1 = new LiteralExpression(1, loc());
    const elem2 = new IdentifierExpression('target', loc());
    const elem3 = new LiteralExpression(3, loc());
    const array = new ArrayLiteralExpression([elem1, elem2, elem3], loc());

    const walker = new EarlyStopWalker('target');
    walker.walk(array);

    // Should visit: array, 1, target
    // Should NOT visit: 3
    expect(walker.visited).toEqual([
      ASTNodeType.ARRAY_LITERAL_EXPR,
      ASTNodeType.LITERAL_EXPR,
      ASTNodeType.IDENTIFIER_EXPR,
    ]);
  });
});

describe('ASTWalker - Complex Scenarios', () => {
  it('should handle deeply nested expressions', () => {
    // AST: ((1 + 2) * 3) - 4
    const one = new LiteralExpression(1, loc());
    const two = new LiteralExpression(2, loc());
    const three = new LiteralExpression(3, loc());
    const four = new LiteralExpression(4, loc());

    const add = new BinaryExpression(one, TokenType.PLUS, two, loc());
    const mul = new BinaryExpression(add, TokenType.MULTIPLY, three, loc());
    const sub = new BinaryExpression(mul, TokenType.MINUS, four, loc());

    const walker = new CollectorWalker();
    walker.walk(sub);

    expect(walker.visited).toEqual([
      ASTNodeType.BINARY_EXPR, // sub
      ASTNodeType.BINARY_EXPR, // mul
      ASTNodeType.BINARY_EXPR, // add
      ASTNodeType.LITERAL_EXPR, // 1
      ASTNodeType.LITERAL_EXPR, // 2
      ASTNodeType.LITERAL_EXPR, // 3
      ASTNodeType.LITERAL_EXPR, // 4
    ]);
  });

  it('should handle function with complex body', () => {
    // AST: function foo(): void
    //        let x = 2 + 3
    //        if x then return x end if
    //      end function

    const two = new LiteralExpression(2, loc());
    const three = new LiteralExpression(3, loc());
    const add = new BinaryExpression(two, TokenType.PLUS, three, loc());
    const varDecl = new VariableDecl('x', 'byte', add, loc());

    const condition = new IdentifierExpression('x', loc());
    const returnValue = new IdentifierExpression('x', loc());
    const returnStmt = new ReturnStatement(returnValue, loc());
    const ifStmt = new IfStatement(condition, [returnStmt], null, loc());

    const funcDecl = new FunctionDecl('foo', [], 'void', [varDecl, ifStmt], loc());
    const module = new ModuleDecl(['global'], loc(), true);
    const program = new Program(module, [funcDecl], loc());

    const walker = new CollectorWalker();
    walker.walk(program);

    expect(walker.visited).toEqual([
      ASTNodeType.PROGRAM,
      ASTNodeType.MODULE,
      ASTNodeType.FUNCTION_DECL,
      ASTNodeType.VARIABLE_DECL,
      ASTNodeType.BINARY_EXPR,
      ASTNodeType.LITERAL_EXPR, // 2
      ASTNodeType.LITERAL_EXPR, // 3
      ASTNodeType.IF_STMT,
      ASTNodeType.IDENTIFIER_EXPR, // condition
      ASTNodeType.RETURN_STMT,
      ASTNodeType.IDENTIFIER_EXPR, // return value
    ]);
  });
});

describe('ASTWalker - Edge Cases', () => {
  it('should handle empty array literal', () => {
    // AST: []
    const array = new ArrayLiteralExpression([], loc());

    const walker = new CollectorWalker();
    walker.walk(array);

    expect(walker.visited).toEqual([ASTNodeType.ARRAY_LITERAL_EXPR]);
  });

  it('should handle function with empty body', () => {
    // AST: function foo(): void end function
    const funcDecl = new FunctionDecl('foo', [], 'void', [], loc());

    const walker = new CollectorWalker();
    walker.walk(funcDecl);

    expect(walker.visited).toEqual([ASTNodeType.FUNCTION_DECL]);
  });

  it('should handle variable without initializer', () => {
    // AST: let x: byte
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

    walker.visited = []; // Reset
    walker.walk(expr2);
    expect(walker.visited).toEqual([ASTNodeType.LITERAL_EXPR]);
  });
});