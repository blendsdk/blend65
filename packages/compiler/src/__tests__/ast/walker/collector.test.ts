/**
 * Tests for AST Collector Infrastructure
 *
 * Validates ASTCollector base class, NodeFinder, and NodeCounter
 * utilities for gathering information during AST traversal.
 */

import { describe, it, expect } from 'vitest';
import { ASTCollector, NodeFinder, NodeCounter } from '../../../ast/walker/collector.js';
import { ASTNodeType, SourceLocation } from '../../../ast/base.js';
import {
  Program,
  ModuleDecl,
  FunctionDecl,
  VariableDecl,
  BinaryExpression,
  LiteralExpression,
  IdentifierExpression,
  ReturnStatement,
  ExpressionStatement,
  IfStatement,
} from '../../../ast/nodes.js';
import { TokenType } from '../../../lexer/types.js';

/**
 * Helper: Create a dummy source location
 */
function loc(): SourceLocation {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
  };
}

/**
 * Helper: Create test program with various node types
 */
function createTestProgram(): Program {
  const module = new ModuleDecl(['test'], loc(), true);

  // Variable: let counter: byte = 0
  const counterInit = new LiteralExpression(0, loc());
  const counter = new VariableDecl('counter', 'byte', counterInit, loc());

  // Variable: let max: byte = 10
  const maxInit = new LiteralExpression(10, loc());
  const max = new VariableDecl('max', 'byte', maxInit, loc());

  // Function: fn add(a: byte, b: byte): byte
  const aIdent = new IdentifierExpression('a', loc());
  const bIdent = new IdentifierExpression('b', loc());
  const addExpr = new BinaryExpression(aIdent, TokenType.PLUS, bIdent, loc());
  const returnStmt = new ReturnStatement(addExpr, loc());
  const addFunc = new FunctionDecl('add', [], 'byte', [returnStmt], loc());

  // Function: fn test(): void
  const counterIdent = new IdentifierExpression('counter', loc());
  const one = new LiteralExpression(1, loc());
  const counterPlusOne = new BinaryExpression(counterIdent, TokenType.PLUS, one, loc());
  const exprStmt = new ExpressionStatement(counterPlusOne, loc());

  const maxIdent = new IdentifierExpression('max', loc());
  const counterIdent2 = new IdentifierExpression('counter', loc());
  const condition = new BinaryExpression(counterIdent2, TokenType.LESS_THAN, maxIdent, loc());
  const ifStmt = new IfStatement(condition, [exprStmt], null, loc());

  const testFunc = new FunctionDecl('test', [], 'void', [ifStmt], loc());

  const program = new Program(module, [counter, max, addFunc, testFunc], loc());
  return program;
}

// ============================================
// TEST: ASTCollector Base Class
// ============================================

describe('ASTCollector', () => {
  /**
   * Test collector that collects variable names
   */
  class VariableNameCollector extends ASTCollector<string> {
    visitVariableDecl(node: VariableDecl): void {
      this.collect(node.getName());
      super.visitVariableDecl(node);
    }
  }

  it('should collect variable names', () => {
    const program = createTestProgram();
    const collector = new VariableNameCollector();
    const names = collector.run(program);

    expect(names).toEqual(['counter', 'max']);
  });

  /**
   * Test collector that collects function names
   */
  class FunctionNameCollector extends ASTCollector<string> {
    visitFunctionDecl(node: FunctionDecl): void {
      this.collect(node.getName());
      super.visitFunctionDecl(node);
    }
  }

  it('should collect function names', () => {
    const program = createTestProgram();
    const collector = new FunctionNameCollector();
    const names = collector.run(program);

    expect(names).toEqual(['add', 'test']);
  });

  /**
   * Test collector that collects all literals
   */
  class LiteralCollector extends ASTCollector<number | string | boolean> {
    visitLiteralExpression(node: LiteralExpression): void {
      this.collect(node.getValue());
      super.visitLiteralExpression(node);
    }
  }

  it('should collect all literal values', () => {
    const program = createTestProgram();
    const collector = new LiteralCollector();
    const literals = collector.run(program);

    expect(literals).toEqual([0, 10, 1]);
  });

  /**
   * Test collector that collects binary operators
   */
  class OperatorCollector extends ASTCollector<string> {
    visitBinaryExpression(node: BinaryExpression): void {
      this.collect(node.getOperator());
      super.visitBinaryExpression(node);
    }
  }

  it('should collect binary operators', () => {
    const program = createTestProgram();
    const collector = new OperatorCollector();
    const operators = collector.run(program);

    expect(operators).toContain(TokenType.PLUS);
    expect(operators).toContain(TokenType.LESS_THAN);
  });

  /**
   * Test collector with skip functionality
   */
  class ShallowVariableCollector extends ASTCollector<string> {
    visitVariableDecl(node: VariableDecl): void {
      this.collect(node.getName());
      this.skip(); // Don't traverse initializer
    }
  }

  it('should respect skip() - not traverse children', () => {
    const program = createTestProgram();
    const collector = new ShallowVariableCollector();
    const names = collector.run(program);

    // Should collect variable names
    expect(names).toEqual(['counter', 'max']);

    // But literals from initializers should NOT be collected
    // (This is implicit - we'd need a combo collector to verify)
  });

  /**
   * Test collector with stop functionality
   */
  class FirstVariableCollector extends ASTCollector<string> {
    visitVariableDecl(node: VariableDecl): void {
      this.collect(node.getName());
      this.stop(); // Stop after first variable
    }
  }

  it('should respect stop() - halt traversal early', () => {
    const program = createTestProgram();
    const collector = new FirstVariableCollector();
    const names = collector.run(program);

    // Should only collect first variable
    expect(names).toEqual(['counter']);
  });

  /**
   * Test that run() clears previous results
   */
  it('should clear results between runs', () => {
    const program = createTestProgram();
    const collector = new VariableNameCollector();

    const firstRun = collector.run(program);
    expect(firstRun).toEqual(['counter', 'max']);

    const secondRun = collector.run(program);
    expect(secondRun).toEqual(['counter', 'max']);
  });

  /**
   * Test collector on empty program
   */
  it('should return empty array for empty AST', () => {
    const module = new ModuleDecl(['test'], loc(), true);
    const program = new Program(module, [], loc());
    const collector = new VariableNameCollector();

    const names = collector.run(program);
    expect(names).toEqual([]);
  });

  /**
   * Test collector with nested structures
   */
  class IdentifierCollector extends ASTCollector<string> {
    visitIdentifierExpression(node: IdentifierExpression): void {
      this.collect(node.getName());
      super.visitIdentifierExpression(node);
    }
  }

  it('should collect from nested structures', () => {
    const program = createTestProgram();
    const collector = new IdentifierCollector();
    const identifiers = collector.run(program);

    // Should find all identifier usages
    expect(identifiers).toContain('a');
    expect(identifiers).toContain('b');
    expect(identifiers).toContain('counter');
    expect(identifiers).toContain('max');
  });
});

// ============================================
// TEST: NodeFinder
// ============================================

describe('NodeFinder', () => {
  it('should find all variables', () => {
    const program = createTestProgram();
    const variables = NodeFinder.find(
      program,
      node => node.getNodeType() === ASTNodeType.VARIABLE_DECL
    );

    expect(variables.length).toBe(2);
    expect((variables[0] as VariableDecl).getName()).toBe('counter');
    expect((variables[1] as VariableDecl).getName()).toBe('max');
  });

  it('should find all functions', () => {
    const program = createTestProgram();
    const functions = NodeFinder.find(
      program,
      node => node.getNodeType() === ASTNodeType.FUNCTION_DECL
    );

    expect(functions.length).toBe(2);
    expect((functions[0] as FunctionDecl).getName()).toBe('add');
    expect((functions[1] as FunctionDecl).getName()).toBe('test');
  });

  it('should find all binary expressions', () => {
    const program = createTestProgram();
    const binaryExprs = NodeFinder.find(
      program,
      node => node.getNodeType() === ASTNodeType.BINARY_EXPR
    );

    expect(binaryExprs.length).toBeGreaterThan(0);
  });

  it('should find all literals', () => {
    const program = createTestProgram();
    const literals = NodeFinder.find(
      program,
      node => node.getNodeType() === ASTNodeType.LITERAL_EXPR
    );

    expect(literals.length).toBe(3); // 0, 10, 1
  });

  it('should find specific identifiers', () => {
    const program = createTestProgram();
    const counterRefs = NodeFinder.find(program, node => {
      return (
        node.getNodeType() === ASTNodeType.IDENTIFIER_EXPR &&
        (node as IdentifierExpression).getName() === 'counter'
      );
    });

    expect(counterRefs.length).toBeGreaterThan(0);
  });

  it('should find nodes with complex predicates', () => {
    const program = createTestProgram();
    // Find all addition operations
    const additions = NodeFinder.find(program, node => {
      return (
        node.getNodeType() === ASTNodeType.BINARY_EXPR &&
        (node as BinaryExpression).getOperator() === TokenType.PLUS
      );
    });

    expect(additions.length).toBeGreaterThan(0);
  });

  it('should return empty array when nothing matches', () => {
    const program = createTestProgram();
    const nothing = NodeFinder.find(program, () => false);

    expect(nothing).toEqual([]);
  });

  it('should find all nodes when predicate always true', () => {
    const program = createTestProgram();
    const allNodes = NodeFinder.find(program, () => true);

    // Should find many nodes
    expect(allNodes.length).toBeGreaterThan(10);
  });

  /**
   * Test using NodeFinder instance directly (not static)
   */
  it('should work as instance', () => {
    const program = createTestProgram();
    const finder = new NodeFinder(node => node.getNodeType() === ASTNodeType.VARIABLE_DECL);

    const variables = finder.run(program);
    expect(variables.length).toBe(2);
  });

  /**
   * Test reusing finder instance
   */
  it('should allow reuse of finder instance', () => {
    const program = createTestProgram();
    const finder = new NodeFinder(node => node.getNodeType() === ASTNodeType.FUNCTION_DECL);

    const firstRun = finder.run(program);
    expect(firstRun.length).toBe(2);

    const secondRun = finder.run(program);
    expect(secondRun.length).toBe(2);
  });
});

// ============================================
// TEST: NodeCounter
// ============================================

describe('NodeCounter', () => {
  it('should count all node types', () => {
    const program = createTestProgram();
    const counts = NodeCounter.count(program);

    // Should have counts for various types
    expect(counts.get(ASTNodeType.PROGRAM)).toBe(1);
    expect(counts.get(ASTNodeType.MODULE)).toBe(1);
    expect(counts.get(ASTNodeType.VARIABLE_DECL)).toBe(2);
    expect(counts.get(ASTNodeType.FUNCTION_DECL)).toBe(2);
  });

  it('should count expressions correctly', () => {
    const program = createTestProgram();
    const counts = NodeCounter.count(program);

    const binaryExprs = counts.get(ASTNodeType.BINARY_EXPR) || 0;
    const literals = counts.get(ASTNodeType.LITERAL_EXPR) || 0;
    const identifiers = counts.get(ASTNodeType.IDENTIFIER_EXPR) || 0;

    expect(binaryExprs).toBeGreaterThan(0);
    expect(literals).toBe(3); // 0, 10, 1
    expect(identifiers).toBeGreaterThan(0);
  });

  it('should count statements correctly', () => {
    const program = createTestProgram();
    const counts = NodeCounter.count(program);

    const returnStmts = counts.get(ASTNodeType.RETURN_STMT) || 0;
    const ifStmts = counts.get(ASTNodeType.IF_STMT) || 0;
    const exprStmts = counts.get(ASTNodeType.EXPR_STMT) || 0;

    expect(returnStmts).toBeGreaterThan(0);
    expect(ifStmts).toBeGreaterThan(0);
    expect(exprStmts).toBeGreaterThan(0);
  });

  it('should return 0 for node types not in AST', () => {
    const program = createTestProgram();
    const counter = new NodeCounter();
    const counts = counter.run(program);

    // No while statements in our test program
    const whileStmts = counts.get(ASTNodeType.WHILE_STMT) || 0;
    expect(whileStmts).toBe(0);
  });

  it('should get count for specific type', () => {
    const program = createTestProgram();
    const counter = new NodeCounter();
    counter.run(program);

    const varCount = counter.getCountForType(ASTNodeType.VARIABLE_DECL);
    expect(varCount).toBe(2);
  });

  it('should calculate total count correctly', () => {
    const program = createTestProgram();
    const counter = new NodeCounter();
    counter.run(program);

    const total = counter.getTotalCount();
    expect(total).toBeGreaterThan(15); // Many nodes in test program
  });

  it('should work on empty program', () => {
    const module = new ModuleDecl(['test'], loc(), true);
    const program = new Program(module, [], loc());
    const counts = NodeCounter.count(program);

    expect(counts.get(ASTNodeType.PROGRAM)).toBe(1);
    expect(counts.get(ASTNodeType.MODULE)).toBe(1);
  });

  it('should work as instance', () => {
    const program = createTestProgram();
    const counter = new NodeCounter();
    const counts = counter.run(program);

    expect(counts.get(ASTNodeType.VARIABLE_DECL)).toBe(2);
  });

  it('should reset counts between runs', () => {
    const program = createTestProgram();
    const counter = new NodeCounter();

    const firstCounts = counter.run(program);
    expect(firstCounts.get(ASTNodeType.VARIABLE_DECL)).toBe(2);

    const secondCounts = counter.run(program);
    expect(secondCounts.get(ASTNodeType.VARIABLE_DECL)).toBe(2);
  });

  it('should return copy of counts map', () => {
    const program = createTestProgram();
    const counter = new NodeCounter();
    const counts1 = counter.run(program);
    const counts2 = counter.getCounts();

    // Should be different objects
    expect(counts1).not.toBe(counts2);
    // But with same contents
    expect(counts1.get(ASTNodeType.VARIABLE_DECL)).toBe(counts2.get(ASTNodeType.VARIABLE_DECL));
  });
});

// ============================================
// TEST: Advanced Collection Scenarios
// ============================================

describe('Advanced Collection Scenarios', () => {
  /**
   * Collector that tracks both variables and their initializers
   */
  class VariableWithInitCollector extends ASTCollector<{ name: string; hasInit: boolean }> {
    visitVariableDecl(node: VariableDecl): void {
      this.collect({
        name: node.getName(),
        hasInit: node.getInitializer() !== null,
      });
      super.visitVariableDecl(node);
    }
  }

  it('should collect complex data structures', () => {
    const program = createTestProgram();
    const collector = new VariableWithInitCollector();
    const results = collector.run(program);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ name: 'counter', hasInit: true });
    expect(results[1]).toEqual({ name: 'max', hasInit: true });
  });

  /**
   * Collector that uses parent context
   */
  class NestedIdentifierCollector extends ASTCollector<{ name: string; inFunction: boolean }> {
    visitIdentifierExpression(node: IdentifierExpression): void {
      const parent = this.getParent();
      const inFunction =
        parent !== null &&
        (parent.getNodeType() === ASTNodeType.FUNCTION_DECL ||
          this.getPath().some(n => n.getNodeType() === ASTNodeType.FUNCTION_DECL));

      this.collect({
        name: node.getName(),
        inFunction,
      });

      super.visitIdentifierExpression(node);
    }
  }

  it('should use parent context during collection', () => {
    const program = createTestProgram();
    const collector = new NestedIdentifierCollector();
    const results = collector.run(program);

    // All identifiers should be in functions in our test
    expect(results.every(r => r.inFunction)).toBe(true);
  });

  /**
   * Multiple collectors in sequence
   */
  it('should support multiple collectors in sequence', () => {
    const program = createTestProgram();

    const varCollector = new (class extends ASTCollector<string> {
      visitVariableDecl(node: VariableDecl): void {
        this.collect(node.getName());
        super.visitVariableDecl(node);
      }
    })();

    const funcCollector = new (class extends ASTCollector<string> {
      visitFunctionDecl(node: FunctionDecl): void {
        this.collect(node.getName());
        super.visitFunctionDecl(node);
      }
    })();

    const variables = varCollector.run(program);
    const functions = funcCollector.run(program);

    expect(variables).toEqual(['counter', 'max']);
    expect(functions).toEqual(['add', 'test']);
  });

  /**
   * Collector with conditional logic
   */
  class ConditionalCollector extends ASTCollector<TokenType> {
    visitBinaryExpression(node: BinaryExpression): void {
      // Only collect arithmetic operations
      const arithmeticOps = [TokenType.PLUS, TokenType.MINUS, TokenType.MULTIPLY, TokenType.DIVIDE];
      if (arithmeticOps.includes(node.getOperator())) {
        this.collect(node.getOperator());
      }
      super.visitBinaryExpression(node);
    }
  }

  it('should support conditional collection', () => {
    const program = createTestProgram();
    const collector = new ConditionalCollector();
    const operators = collector.run(program);

    // Should only have arithmetic ops (PLUS), not comparison (LESS_THAN)
    expect(operators).toContain(TokenType.PLUS);
    expect(operators).not.toContain(TokenType.LESS_THAN);
  });
});
