/**
 * Recursion Checker Tests for Blend65 Compiler v2
 *
 * Tests the recursion detection and error reporting capabilities:
 * - Direct recursion detection
 * - Indirect (mutual) recursion detection
 * - Error message generation
 * - Error reporting format
 * - SFA compliance validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CallGraph,
  CallGraphBuilder,
  RecursionChecker,
  RecursionErrorCode,
  SymbolTable,
} from '../../semantic/index.js';
import { Parser } from '../../parser/index.js';
import { Lexer } from '../../lexer/index.js';
import type { SourceLocation } from '../../ast/index.js';

/**
 * Helper to create a mock source location for testing
 */
function createLocation(line: number = 1, column: number = 0): SourceLocation {
  return {
    start: { line, column, offset: 0 },
    end: { line, column: column + 10, offset: 10 },
  };
}

/**
 * Helper to parse a Blend65 source string and return the Program AST
 */
function parse(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, source);
  return parser.parse();
}

/**
 * Helper to build call graph and run recursion check
 */
function checkRecursion(source: string) {
  const program = parse(source);
  const symbolTable = new SymbolTable();
  const builder = new CallGraphBuilder(symbolTable);
  const callGraph = builder.build(program);
  const checker = new RecursionChecker(callGraph);
  return checker.check();
}

describe('RecursionChecker', () => {
  let callGraph: CallGraph;
  let checker: RecursionChecker;

  beforeEach(() => {
    callGraph = new CallGraph();
  });

  describe('direct recursion detection', () => {
    it('should detect direct recursion', () => {
      callGraph.addFunction('factorial', createLocation(1));
      callGraph.addCall('factorial', 'factorial', createLocation(5));

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].code).toBe(RecursionErrorCode.DIRECT_RECURSION);
      expect(result.errors[0].functionName).toBe('factorial');
    });

    it('should report all directly recursive functions', () => {
      callGraph.addCall('factorial', 'factorial', createLocation());
      callGraph.addCall('fibonacci', 'fibonacci', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.errors.length).toBe(2);
      expect(result.stats.directRecursionCount).toBe(2);
    });

    it('should include cycle path in direct recursion error', () => {
      callGraph.addCall('selfCall', 'selfCall', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.errors[0].cyclePath).toEqual(['selfCall', 'selfCall']);
    });

    it('should generate helpful error message for direct recursion', () => {
      callGraph.addFunction('recursive', createLocation());
      callGraph.addCall('recursive', 'recursive', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.errors[0].message).toContain('recursive');
      expect(result.errors[0].message).toContain('calls itself directly');
      expect(result.errors[0].message).toContain('Static Frame Allocation');
    });

    it('should provide detailed explanation for direct recursion', () => {
      callGraph.addCall('rec', 'rec', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.errors[0].details).toContain('SFA');
      expect(result.errors[0].details).toContain('How to fix');
    });
  });

  describe('mutual recursion detection', () => {
    it('should detect mutual recursion between two functions', () => {
      callGraph.addCall('isEven', 'isOdd', createLocation());
      callGraph.addCall('isOdd', 'isEven', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);

      // Should have mutual recursion error
      const mutualError = result.errors.find(
        e => e.code === RecursionErrorCode.MUTUAL_RECURSION
      );
      expect(mutualError).toBeDefined();
    });

    it('should report mutual recursion with correct error code', () => {
      callGraph.addCall('a', 'b', createLocation());
      callGraph.addCall('b', 'a', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      const error = result.errors.find(
        e => e.code === RecursionErrorCode.MUTUAL_RECURSION
      );
      expect(error).toBeDefined();
      expect(error!.cyclePath.length).toBeGreaterThan(2);
    });

    it('should mark all functions in mutual recursion as recursive', () => {
      callGraph.addCall('ping', 'pong', createLocation());
      callGraph.addCall('pong', 'ping', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.recursiveFunctions.has('ping')).toBe(true);
      expect(result.recursiveFunctions.has('pong')).toBe(true);
    });
  });

  describe('indirect recursion detection', () => {
    it('should detect indirect recursion through 3+ functions', () => {
      callGraph.addCall('a', 'b', createLocation());
      callGraph.addCall('b', 'c', createLocation());
      callGraph.addCall('c', 'a', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.isValid).toBe(false);
      const indirectError = result.errors.find(
        e => e.code === RecursionErrorCode.INDIRECT_RECURSION
      );
      expect(indirectError).toBeDefined();
    });

    it('should report full cycle path for indirect recursion', () => {
      callGraph.addCall('x', 'y', createLocation());
      callGraph.addCall('y', 'z', createLocation());
      callGraph.addCall('z', 'x', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      const error = result.errors.find(
        e => e.code === RecursionErrorCode.INDIRECT_RECURSION
      );
      expect(error).toBeDefined();
      expect(error!.cyclePath).toContain('x');
      expect(error!.cyclePath).toContain('y');
      expect(error!.cyclePath).toContain('z');
    });

    it('should detect complex recursive chains', () => {
      // A → B → C → D → A
      callGraph.addCall('a', 'b', createLocation());
      callGraph.addCall('b', 'c', createLocation());
      callGraph.addCall('c', 'd', createLocation());
      callGraph.addCall('d', 'a', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.isValid).toBe(false);
      expect(result.recursiveFunctions.size).toBe(4);
    });
  });

  describe('non-recursive code validation', () => {
    it('should pass for non-recursive code', () => {
      callGraph.addCall('main', 'helper1', createLocation());
      callGraph.addCall('main', 'helper2', createLocation());
      callGraph.addCall('helper1', 'util', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for empty call graph', () => {
      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.isValid).toBe(true);
    });

    it('should pass for single function with no calls', () => {
      callGraph.addFunction('standalone', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.isValid).toBe(true);
    });

    it('should pass for diamond dependency pattern', () => {
      // main → A, main → B, A → C, B → C (no cycle)
      callGraph.addCall('main', 'a', createLocation());
      callGraph.addCall('main', 'b', createLocation());
      callGraph.addCall('a', 'c', createLocation());
      callGraph.addCall('b', 'c', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.isValid).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should report correct statistics', () => {
      callGraph.addCall('direct', 'direct', createLocation());
      callGraph.addCall('a', 'b', createLocation());
      callGraph.addCall('b', 'a', createLocation());
      callGraph.addFunction('standalone', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.stats.functionsAnalyzed).toBe(4);
      expect(result.stats.directRecursionCount).toBe(1);
      expect(result.stats.indirectCycleCount).toBeGreaterThanOrEqual(1);
    });

    it('should report zero statistics for clean code', () => {
      callGraph.addCall('main', 'helper', createLocation());

      checker = new RecursionChecker(callGraph);
      const result = checker.check();

      expect(result.stats.directRecursionCount).toBe(0);
      expect(result.stats.indirectCycleCount).toBe(0);
      expect(result.stats.totalRecursiveFunctions).toBe(0);
    });
  });

  describe('utility methods', () => {
    it('hasRecursion should return true for recursive code', () => {
      callGraph.addCall('rec', 'rec', createLocation());

      checker = new RecursionChecker(callGraph);
      expect(checker.hasRecursion()).toBe(true);
    });

    it('hasRecursion should return false for non-recursive code', () => {
      callGraph.addCall('main', 'helper', createLocation());

      checker = new RecursionChecker(callGraph);
      expect(checker.hasRecursion()).toBe(false);
    });

    it('getRecursiveFunctions should return all recursive functions', () => {
      callGraph.addCall('a', 'b', createLocation());
      callGraph.addCall('b', 'a', createLocation());
      callGraph.addCall('c', 'd', createLocation()); // Not recursive

      checker = new RecursionChecker(callGraph);
      const recursive = checker.getRecursiveFunctions();

      expect(recursive.has('a')).toBe(true);
      expect(recursive.has('b')).toBe(true);
      expect(recursive.has('c')).toBe(false);
      expect(recursive.has('d')).toBe(false);
    });

    it('isRecursive should check individual functions', () => {
      callGraph.addCall('recursive', 'recursive', createLocation());
      callGraph.addFunction('normal', createLocation());

      checker = new RecursionChecker(callGraph);

      expect(checker.isRecursive('recursive')).toBe(true);
      expect(checker.isRecursive('normal')).toBe(false);
    });
  });

  describe('report formatting', () => {
    it('should format clean report for non-recursive code', () => {
      callGraph.addCall('main', 'helper', createLocation());

      checker = new RecursionChecker(callGraph);
      const report = checker.formatReport();

      expect(report).toContain('No recursion detected');
      expect(report).toContain('✓');
    });

    it('should format error report for recursive code', () => {
      callGraph.addCall('recursive', 'recursive', createLocation());

      checker = new RecursionChecker(callGraph);
      const report = checker.formatReport();

      expect(report).toContain('RECURSION ERRORS DETECTED');
      expect(report).toContain('recursive');
      expect(report).toContain('DIRECT_RECURSION');
    });

    it('should include summary in error report', () => {
      callGraph.addCall('a', 'a', createLocation());
      callGraph.addCall('b', 'c', createLocation());
      callGraph.addCall('c', 'b', createLocation());

      checker = new RecursionChecker(callGraph);
      const report = checker.formatReport();

      expect(report).toContain('Summary');
      expect(report).toContain('direct');
      expect(report).toContain('indirect');
    });
  });
});

describe('RecursionChecker with parsed source', () => {
  describe('direct recursion in source code', () => {
    it('should detect direct recursion in factorial function', () => {
      const result = checkRecursion(`
        module Test

        function factorial(n: byte): byte {
          if (n <= 1) {
            return 1;
          }
          return n * factorial(n - 1);
        }
      `);

      expect(result.isValid).toBe(false);
      expect(result.recursiveFunctions.has('factorial')).toBe(true);
    });

    it('should detect direct recursion in fibonacci function', () => {
      const result = checkRecursion(`
        module Test

        function fibonacci(n: byte): byte {
          if (n <= 1) { return n; }
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
      `);

      expect(result.isValid).toBe(false);
      expect(result.recursiveFunctions.has('fibonacci')).toBe(true);
    });
  });

  describe('mutual recursion in source code', () => {
    it('should detect even/odd mutual recursion', () => {
      const result = checkRecursion(`
        module Test

        function isEven(n: byte): bool {
          if (n == 0) { return true; }
          return isOdd(n - 1);
        }

        function isOdd(n: byte): bool {
          if (n == 0) { return false; }
          return isEven(n - 1);
        }
      `);

      expect(result.isValid).toBe(false);
      expect(result.recursiveFunctions.has('isEven')).toBe(true);
      expect(result.recursiveFunctions.has('isOdd')).toBe(true);
    });
  });

  describe('indirect recursion in source code', () => {
    it('should detect chain recursion A → B → C → A', () => {
      const result = checkRecursion(`
        module Test

        function a(): void {
          b();
        }

        function b(): void {
          c();
        }

        function c(): void {
          a();
        }
      `);

      expect(result.isValid).toBe(false);
      expect(result.recursiveFunctions.size).toBe(3);
    });
  });

  describe('non-recursive source code', () => {
    it('should pass for simple non-recursive program', () => {
      const result = checkRecursion(`
        module Test

        function add(a: byte, b: byte): byte {
          return a + b;
        }

        function main(): void {
          let x: byte = add(1, 2);
        }
      `);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for complex non-recursive call graph', () => {
      const result = checkRecursion(`
        module Test

        function util(): byte { return 1; }

        function helper1(): byte { return util(); }

        function helper2(): byte { return util(); }

        function main(): void {
          let a: byte = helper1();
          let b: byte = helper2();
        }
      `);

      expect(result.isValid).toBe(true);
    });

    it('should pass for conditional calls without recursion', () => {
      const result = checkRecursion(`
        module Test

        function process1(): void {}
        function process2(): void {}

        function main(): void {
          if (true) {
            process1();
          } else {
            process2();
          }
        }
      `);

      expect(result.isValid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty module', () => {
      const result = checkRecursion(`module Empty`);

      expect(result.isValid).toBe(true);
    });

    it('should handle module with only variable declarations', () => {
      const result = checkRecursion(`
        module Test

        let x: byte = 10;
        let y: byte = 20;
      `);

      expect(result.isValid).toBe(true);
    });

    it('should handle deeply nested function calls', () => {
      const result = checkRecursion(`
        module Test

        function l5(): byte { return 1; }
        function l4(): byte { return l5(); }
        function l3(): byte { return l4(); }
        function l2(): byte { return l3(); }
        function l1(): byte { return l2(); }
        function main(): void { let x: byte = l1(); }
      `);

      expect(result.isValid).toBe(true);
    });
  });
});

describe('RecursionChecker error messages quality', () => {
  it('should provide actionable fix suggestions', () => {
    const callGraph = new CallGraph();
    callGraph.addCall('recurse', 'recurse', createLocation());

    const checker = new RecursionChecker(callGraph);
    const result = checker.check();

    expect(result.errors[0].details).toContain('iterative');
    expect(result.errors[0].details).toContain('stack');
    expect(result.errors[0].details).toContain('Refactor');
  });

  it('should explain why recursion is not allowed', () => {
    const callGraph = new CallGraph();
    callGraph.addCall('recurse', 'recurse', createLocation());

    const checker = new RecursionChecker(callGraph);
    const result = checker.check();

    expect(result.errors[0].details).toContain('Static Frame Allocation');
    expect(result.errors[0].details).toContain('compile time');
  });

  it('should include both function location and call location', () => {
    const callGraph = new CallGraph();
    const funcLoc = createLocation(1, 0);
    const callLoc = createLocation(5, 4);

    callGraph.addFunction('recurse', funcLoc);
    callGraph.addCall('recurse', 'recurse', callLoc);

    const checker = new RecursionChecker(callGraph);
    const result = checker.check();

    expect(result.errors[0].functionLocation).toBeDefined();
    expect(result.errors[0].callLocation).toBeDefined();
  });
});