/**
 * Expression Complexity Analyzer Tests
 *
 * Tests the ExpressionComplexityAnalyzer which calculates complexity
 * metrics for expressions to help IL generation decisions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExpressionComplexityAnalyzer,
  OptimizationMetadataKey,
} from '../../semantic/analysis/index.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import type { Program } from '../../ast/nodes.js';

/**
 * Helper to parse source code
 */
function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

describe('ExpressionComplexityAnalyzer', () => {
  let analyzer: ExpressionComplexityAnalyzer;

  beforeEach(() => {
    analyzer = new ExpressionComplexityAnalyzer();
  });

  describe('basic instantiation', () => {
    it('should create analyzer without errors', () => {
      expect(analyzer).toBeInstanceOf(ExpressionComplexityAnalyzer);
    });

    it('should have analyze method', () => {
      expect(typeof analyzer.analyze).toBe('function');
    });

    it('should have getComplexityMap method', () => {
      expect(typeof analyzer.getComplexityMap).toBe('function');
    });

    it('should have getDiagnostics method', () => {
      expect(typeof analyzer.getDiagnostics).toBe('function');
    });

    it('should have getComplexityInfo method', () => {
      expect(typeof analyzer.getComplexityInfo).toBe('function');
    });
  });

  describe('initial state', () => {
    it('should return empty complexity map initially', () => {
      const map = analyzer.getComplexityMap();
      expect(map.size).toBe(0);
    });

    it('should return empty diagnostics array initially', () => {
      const diagnostics = analyzer.getDiagnostics();
      expect(diagnostics.length).toBe(0);
    });
  });

  describe('analyze empty program', () => {
    it('should handle empty module', () => {
      const ast = parse(`module empty`);
      analyzer.analyze(ast);
      expect(analyzer.getDiagnostics().length).toBe(0);
    });
  });

  describe('literal expression complexity', () => {
    it('should assign score 1 to numeric literal', () => {
      const ast = parse(`
        module test
        let x: byte = 42;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      // Should have at least the literal expression
      expect(map.size).toBeGreaterThan(0);
    });

    it('should have register pressure 1 for literals', () => {
      const ast = parse(`
        module test
        let x: byte = 10;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      for (const [_expr, info] of map) {
        if (info.score === 1) {
          expect(info.registerPressure).toBe(1);
        }
      }
    });

    it('should have tree depth 1 for literals', () => {
      const ast = parse(`
        module test
        let x: byte = 99;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      for (const [_expr, info] of map) {
        if (info.score === 1) {
          expect(info.treeDepth).toBe(1);
        }
      }
    });

    it('should have 0 operations for literals', () => {
      const ast = parse(`
        module test
        let x: byte = 255;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      for (const [_expr, info] of map) {
        if (info.score === 1) {
          expect(info.operationCount).toBe(0);
        }
      }
    });

    it('should have no function call in literals', () => {
      const ast = parse(`
        module test
        let x: byte = 1;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      for (const [_expr, info] of map) {
        if (info.score === 1) {
          expect(info.containsCall).toBe(false);
        }
      }
    });

    it('should have no memory access in literals', () => {
      const ast = parse(`
        module test
        let x: byte = 0;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      for (const [_expr, info] of map) {
        if (info.score === 1) {
          expect(info.containsMemoryAccess).toBe(false);
        }
      }
    });
  });

  describe('binary expression complexity', () => {
    it('should calculate score for simple binary expression', () => {
      const ast = parse(`
        module test
        let x: byte = 1 + 2;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      // Should have expressions: literal 1, literal 2, binary 1+2
      expect(map.size).toBeGreaterThanOrEqual(3);
    });

    it('should have higher score for binary than literals', () => {
      const ast = parse(`
        module test
        let x: byte = 1 + 2;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      const scores = Array.from(map.values()).map(info => info.score);
      const maxScore = Math.max(...scores);
      // Binary should be at least 5 + 1 + 1 = 7
      expect(maxScore).toBeGreaterThanOrEqual(7);
    });

    it('should increase register pressure for nested binary', () => {
      const ast = parse(`
        module test
        let x: byte = (1 + 2) * (3 + 4);
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      const pressures = Array.from(map.values()).map(info => info.registerPressure);
      const maxPressure = Math.max(...pressures);
      // Nested binary needs at least 2 registers
      expect(maxPressure).toBeGreaterThanOrEqual(2);
    });

    it('should cap register pressure at 3', () => {
      const ast = parse(`
        module test
        let x: byte = ((1 + 2) * (3 + 4)) + ((5 + 6) * (7 + 8));
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      for (const [_expr, info] of map) {
        expect(info.registerPressure).toBeLessThanOrEqual(3);
      }
    });

    it('should increase tree depth for nested expressions', () => {
      const ast = parse(`
        module test
        let x: byte = 1 + (2 + (3 + 4));
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      const depths = Array.from(map.values()).map(info => info.treeDepth);
      const maxDepth = Math.max(...depths);
      // Should have at least depth 4: outer + next + next + literal
      expect(maxDepth).toBeGreaterThanOrEqual(4);
    });

    it('should count operations correctly', () => {
      const ast = parse(`
        module test
        let x: byte = 1 + 2 + 3;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      const operationCounts = Array.from(map.values()).map(info => info.operationCount);
      const maxOps = Math.max(...operationCounts);
      // Two + operations
      expect(maxOps).toBeGreaterThanOrEqual(2);
    });
  });

  describe('unary expression complexity', () => {
    it('should calculate score for unary expression', () => {
      const ast = parse(`
        module test
        let x: byte = -1;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      expect(map.size).toBeGreaterThan(0);
    });

    it('should have score >= 4 for unary (3 + 1 for operand)', () => {
      const ast = parse(`
        module test
        let x: byte = -1;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      const scores = Array.from(map.values()).map(info => info.score);
      // Unary (-) on literal (1) = 3 + 1 = 4
      expect(scores.some(s => s >= 4)).toBe(true);
    });

    it('should maintain same register pressure as operand', () => {
      const ast = parse(`
        module test
        let x: byte = -42;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      // Unary on literal should have pressure 1
      for (const [_expr, info] of map) {
        if (info.score >= 4 && info.operationCount === 1) {
          expect(info.registerPressure).toBe(1);
        }
      }
    });

    it('should increase tree depth by 1', () => {
      const ast = parse(`
        module test
        let x: byte = -5;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      // Unary should have depth 2 (unary + literal)
      const depths = Array.from(map.values()).map(info => info.treeDepth);
      expect(depths.some(d => d === 2)).toBe(true);
    });

    it('should propagate containsCall from operand', () => {
      const ast = parse(`
        module test
        let x: byte = -10;
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      // No calls in simple unary
      for (const [_expr, info] of map) {
        expect(info.containsCall).toBe(false);
      }
    });
  });

  describe('memory access complexity', () => {
    it('should mark index expressions as having memory access', () => {
      const ast = parse(`
        module test
        let arr: byte[10];
        let x: byte = arr[0];
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      // Should have at least one expression with memory access
      const hasMemoryAccess = Array.from(map.values()).some(info => info.containsMemoryAccess);
      expect(hasMemoryAccess).toBe(true);
    });

    it('should have score >= 8 for index expressions', () => {
      const ast = parse(`
        module test
        let arr: byte[5];
        let x: byte = arr[2];
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      const scores = Array.from(map.values()).map(info => info.score);
      const maxScore = Math.max(...scores);
      // Index = 8 + object + index
      expect(maxScore).toBeGreaterThanOrEqual(8);
    });
  });

  describe('query methods', () => {
    it('should return high complexity expressions', () => {
      const ast = parse(`
        module test
        let x: byte = ((1 + 2) * (3 + 4)) + ((5 + 6) * (7 + 8));
      `);
      analyzer.analyze(ast);
      const highComplexity = analyzer.getHighComplexityExpressions(20);
      // Should find at least one expression with score >= 20
      expect(highComplexity.length).toBeGreaterThan(0);
    });

    it('should return expressions needing spill', () => {
      const ast = parse(`
        module test
        let x: byte = ((1 + 2) * (3 + 4)) + ((5 + 6) * (7 + 8));
      `);
      analyzer.analyze(ast);
      const needSpill = analyzer.getExpressionsNeedingSpill();
      // Complex nested expressions may need spilling
      expect(typeof needSpill.length).toBe('number');
    });

    it('should return empty array when no high complexity', () => {
      const ast = parse(`
        module test
        let x: byte = 1;
      `);
      analyzer.analyze(ast);
      const highComplexity = analyzer.getHighComplexityExpressions(50);
      // Simple literal should not be high complexity
      expect(highComplexity.length).toBe(0);
    });

    it('should return expressions with memory access', () => {
      const ast = parse(`
        module test
        let arr: byte[3];
        let x: byte = arr[1];
      `);
      analyzer.analyze(ast);
      const withMemory = analyzer.getExpressionsWithMemoryAccess();
      expect(withMemory.length).toBeGreaterThan(0);
    });

    it('should return expressions with calls', () => {
      const ast = parse(`
        module test
        let x: byte = 10;
      `);
      analyzer.analyze(ast);
      const withCalls = analyzer.getExpressionsWithCalls();
      // No function calls in this simple code
      expect(withCalls.length).toBe(0);
    });
  });

  describe('complexity summary', () => {
    it('should return valid summary structure', () => {
      const ast = parse(`
        module test
        let x: byte = 1 + 2;
      `);
      analyzer.analyze(ast);
      const summary = analyzer.getComplexitySummary();
      
      expect(typeof summary.totalExpressions).toBe('number');
      expect(typeof summary.averageScore).toBe('number');
      expect(typeof summary.maxScore).toBe('number');
      expect(typeof summary.averageDepth).toBe('number');
      expect(typeof summary.maxDepth).toBe('number');
      expect(typeof summary.expressionsWithCalls).toBe('number');
      expect(typeof summary.expressionsWithMemoryAccess).toBe('number');
      expect(typeof summary.expressionsNeedingSpill).toBe('number');
    });

    it('should have correct total expressions count', () => {
      const ast = parse(`
        module test
        let x: byte = 1 + 2;
      `);
      analyzer.analyze(ast);
      const summary = analyzer.getComplexitySummary();
      // At least: literal 1, literal 2, binary 1+2
      expect(summary.totalExpressions).toBeGreaterThanOrEqual(3);
    });

    it('should calculate max score correctly', () => {
      const ast = parse(`
        module test
        let x: byte = 1 + 2;
      `);
      analyzer.analyze(ast);
      const summary = analyzer.getComplexitySummary();
      const map = analyzer.getComplexityMap();
      const expectedMax = Math.max(...Array.from(map.values()).map(i => i.score));
      expect(summary.maxScore).toBe(expectedMax);
    });

    it('should return zeros for empty program', () => {
      const ast = parse(`module empty`);
      analyzer.analyze(ast);
      const summary = analyzer.getComplexitySummary();
      expect(summary.totalExpressions).toBe(0);
      expect(summary.averageScore).toBe(0);
      expect(summary.maxScore).toBe(0);
    });
  });

  describe('OptimizationMetadataKey for complexity', () => {
    it('should have all complexity metadata keys', () => {
      expect(OptimizationMetadataKey.ExprComplexityScore).toBe('ExprComplexityScore');
      expect(OptimizationMetadataKey.ExprRegisterPressure).toBe('ExprRegisterPressure');
      expect(OptimizationMetadataKey.ExprTreeDepth).toBe('ExprTreeDepth');
      expect(OptimizationMetadataKey.ExprOperationCount).toBe('ExprOperationCount');
      expect(OptimizationMetadataKey.ExprContainsCall).toBe('ExprContainsCall');
      expect(OptimizationMetadataKey.ExprContainsMemoryAccess).toBe('ExprContainsMemoryAccess');
    });
  });

  describe('score capping', () => {
    it('should cap complexity score at 100', () => {
      // Create a very complex expression
      const ast = parse(`
        module test
        let x: byte = ((((1+2)+(3+4))+((5+6)+(7+8)))+(((9+10)+(11+12))+((13+14)+(15+16))));
      `);
      analyzer.analyze(ast);
      const map = analyzer.getComplexityMap();
      for (const [_expr, info] of map) {
        expect(info.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('reset behavior', () => {
    it('should clear state when analyzing new program', () => {
      // First analysis
      const ast1 = parse(`
        module test1
        let x: byte = 1 + 2 + 3;
      `);
      analyzer.analyze(ast1);
      const count1 = analyzer.getComplexityMap().size;
      
      // Second analysis
      const ast2 = parse(`
        module test2
        let y: byte = 1;
      `);
      analyzer.analyze(ast2);
      const count2 = analyzer.getComplexityMap().size;
      
      // Second analysis should have fewer expressions
      expect(count2).toBeLessThan(count1);
    });
  });
});