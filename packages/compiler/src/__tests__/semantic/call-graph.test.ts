/**
 * Call Graph Tests for Blend65 Compiler v2
 *
 * Tests the call graph construction and analysis capabilities:
 * - Function registration
 * - Call relationship tracking
 * - Direct recursion detection
 * - Indirect recursion detection
 * - Call depth computation
 * - Entry point and leaf function detection
 * - Unreachable function detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CallGraph,
  CallGraphBuilder,
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

describe('CallGraph', () => {
  let callGraph: CallGraph;

  beforeEach(() => {
    callGraph = new CallGraph();
  });

  describe('addFunction', () => {
    it('should add a function node to the graph', () => {
      callGraph.addFunction('main', createLocation());

      expect(callGraph.getFunction('main')).toBeDefined();
      expect(callGraph.size()).toBe(1);
    });

    it('should not duplicate functions with same name', () => {
      callGraph.addFunction('main', createLocation());
      callGraph.addFunction('main', createLocation());

      expect(callGraph.size()).toBe(1);
    });

    it('should track multiple functions', () => {
      callGraph.addFunction('main', createLocation());
      callGraph.addFunction('foo', createLocation());
      callGraph.addFunction('bar', createLocation());

      expect(callGraph.size()).toBe(3);
      expect(callGraph.getAllFunctions()).toEqual(new Set(['main', 'foo', 'bar']));
    });
  });

  describe('addCall', () => {
    it('should record a call relationship', () => {
      callGraph.addFunction('main', createLocation());
      callGraph.addFunction('foo', createLocation());
      callGraph.addCall('main', 'foo', createLocation());

      expect(callGraph.getCallees('main').has('foo')).toBe(true);
      expect(callGraph.getCallers('foo').has('main')).toBe(true);
    });

    it('should auto-create functions if not present', () => {
      callGraph.addCall('main', 'foo', createLocation());

      expect(callGraph.size()).toBe(2);
      expect(callGraph.getFunction('main')).toBeDefined();
      expect(callGraph.getFunction('foo')).toBeDefined();
    });

    it('should track multiple callees from one caller', () => {
      callGraph.addCall('main', 'foo', createLocation());
      callGraph.addCall('main', 'bar', createLocation());
      callGraph.addCall('main', 'baz', createLocation());

      const callees = callGraph.getCallees('main');
      expect(callees.size).toBe(3);
      expect(callees.has('foo')).toBe(true);
      expect(callees.has('bar')).toBe(true);
      expect(callees.has('baz')).toBe(true);
    });

    it('should track multiple callers for one callee', () => {
      callGraph.addCall('main', 'helper', createLocation());
      callGraph.addCall('foo', 'helper', createLocation());
      callGraph.addCall('bar', 'helper', createLocation());

      const callers = callGraph.getCallers('helper');
      expect(callers.size).toBe(3);
      expect(callers.has('main')).toBe(true);
      expect(callers.has('foo')).toBe(true);
      expect(callers.has('bar')).toBe(true);
    });

    it('should record call sites with locations', () => {
      const loc1 = createLocation(10, 5);
      const loc2 = createLocation(15, 10);

      callGraph.addCall('main', 'foo', loc1);
      callGraph.addCall('main', 'foo', loc2);

      const callSites = callGraph.getCallSites('main', 'foo');
      expect(callSites.length).toBe(2);
      expect(callSites[0].location).toEqual(loc1);
      expect(callSites[1].location).toEqual(loc2);
    });
  });

  describe('direct recursion detection', () => {
    it('should detect direct recursion (function calls itself)', () => {
      callGraph.addFunction('factorial', createLocation());
      callGraph.addCall('factorial', 'factorial', createLocation());

      expect(callGraph.isDirectlyRecursive('factorial')).toBe(true);
      expect(callGraph.detectDirectRecursion()).toContain('factorial');
    });

    it('should not flag non-recursive functions', () => {
      callGraph.addFunction('main', createLocation());
      callGraph.addFunction('helper', createLocation());
      callGraph.addCall('main', 'helper', createLocation());

      expect(callGraph.isDirectlyRecursive('main')).toBe(false);
      expect(callGraph.isDirectlyRecursive('helper')).toBe(false);
      expect(callGraph.detectDirectRecursion()).toHaveLength(0);
    });

    it('should detect multiple directly recursive functions', () => {
      callGraph.addCall('factorial', 'factorial', createLocation());
      callGraph.addCall('fibonacci', 'fibonacci', createLocation());
      callGraph.addCall('nonRecursive', 'helper', createLocation());

      const recursive = callGraph.detectDirectRecursion();
      expect(recursive.length).toBe(2);
      expect(recursive).toContain('factorial');
      expect(recursive).toContain('fibonacci');
    });
  });

  describe('indirect recursion detection', () => {
    it('should detect mutual recursion (A calls B, B calls A)', () => {
      callGraph.addCall('isEven', 'isOdd', createLocation());
      callGraph.addCall('isOdd', 'isEven', createLocation());

      expect(callGraph.isRecursive('isEven')).toBe(true);
      expect(callGraph.isRecursive('isOdd')).toBe(true);
    });

    it('should detect indirect recursion through chain (A → B → C → A)', () => {
      callGraph.addCall('a', 'b', createLocation());
      callGraph.addCall('b', 'c', createLocation());
      callGraph.addCall('c', 'a', createLocation());

      expect(callGraph.isRecursive('a')).toBe(true);
      expect(callGraph.isRecursive('b')).toBe(true);
      expect(callGraph.isRecursive('c')).toBe(true);
    });

    it('should find cycle path for indirect recursion', () => {
      callGraph.addCall('a', 'b', createLocation());
      callGraph.addCall('b', 'c', createLocation());
      callGraph.addCall('c', 'a', createLocation());

      const cycle = callGraph.findCycleFrom('a');
      expect(cycle).not.toBeNull();
      expect(cycle!.length).toBeGreaterThan(2);
      // Cycle should contain all three functions and return to start
      expect(cycle).toContain('a');
      expect(cycle).toContain('b');
      expect(cycle).toContain('c');
    });

    it('should not detect recursion in acyclic graphs', () => {
      callGraph.addCall('main', 'helper1', createLocation());
      callGraph.addCall('main', 'helper2', createLocation());
      callGraph.addCall('helper1', 'util', createLocation());
      callGraph.addCall('helper2', 'util', createLocation());

      expect(callGraph.isRecursive('main')).toBe(false);
      expect(callGraph.isRecursive('helper1')).toBe(false);
      expect(callGraph.isRecursive('helper2')).toBe(false);
      expect(callGraph.isRecursive('util')).toBe(false);
    });

    it('should detect all cycles', () => {
      // Two separate cycles: (a→b→a) and (x→y→z→x)
      callGraph.addCall('a', 'b', createLocation());
      callGraph.addCall('b', 'a', createLocation());

      callGraph.addCall('x', 'y', createLocation());
      callGraph.addCall('y', 'z', createLocation());
      callGraph.addCall('z', 'x', createLocation());

      const cycles = callGraph.detectAllCycles();
      expect(cycles.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('call depth computation', () => {
    it('should return 0 for leaf functions', () => {
      callGraph.addFunction('leaf', createLocation());

      expect(callGraph.getMaxCallDepth('leaf')).toBe(0);
    });

    it('should compute correct depth for linear chain', () => {
      callGraph.addCall('a', 'b', createLocation());
      callGraph.addCall('b', 'c', createLocation());
      callGraph.addCall('c', 'd', createLocation());

      expect(callGraph.getMaxCallDepth('a')).toBe(3);
      expect(callGraph.getMaxCallDepth('b')).toBe(2);
      expect(callGraph.getMaxCallDepth('c')).toBe(1);
      expect(callGraph.getMaxCallDepth('d')).toBe(0);
    });

    it('should compute correct depth for branching calls', () => {
      // main → helper1 → util
      // main → helper2
      callGraph.addCall('main', 'helper1', createLocation());
      callGraph.addCall('main', 'helper2', createLocation());
      callGraph.addCall('helper1', 'util', createLocation());

      expect(callGraph.getMaxCallDepth('main')).toBe(2);
    });

    it('should return Infinity for recursive functions', () => {
      callGraph.addCall('recursive', 'recursive', createLocation());

      expect(callGraph.getMaxCallDepth('recursive')).toBe(Infinity);
    });
  });

  describe('entry points', () => {
    it('should find entry points (functions with no callers)', () => {
      callGraph.addCall('main', 'helper', createLocation());
      callGraph.addFunction('standalone', createLocation());

      const entryPoints = callGraph.findEntryPoints();
      expect(entryPoints).toContain('main');
      expect(entryPoints).toContain('standalone');
      expect(entryPoints).not.toContain('helper');
    });

    it('should return empty for fully connected graph', () => {
      callGraph.addCall('a', 'b', createLocation());
      callGraph.addCall('b', 'a', createLocation());

      // Both call each other, so neither is a "pure" entry point
      // Actually both are entry points from external perspective
      const entryPoints = callGraph.findEntryPoints();
      expect(entryPoints).toHaveLength(0);
    });
  });

  describe('leaf functions', () => {
    it('should find leaf functions (functions that call nothing)', () => {
      callGraph.addCall('main', 'helper', createLocation());
      callGraph.addFunction('helper', createLocation());

      const leaves = callGraph.findLeafFunctions();
      expect(leaves).toContain('helper');
      expect(leaves).not.toContain('main');
    });
  });

  describe('unreachable functions', () => {
    it('should find unreachable functions from entry point', () => {
      callGraph.addCall('main', 'helper', createLocation());
      callGraph.addFunction('orphan', createLocation());
      callGraph.addCall('another', 'yetAnother', createLocation());

      const unreachable = callGraph.findUnreachableFunctions('main');
      expect(unreachable.has('orphan')).toBe(true);
      expect(unreachable.has('another')).toBe(true);
      expect(unreachable.has('yetAnother')).toBe(true);
      expect(unreachable.has('main')).toBe(false);
      expect(unreachable.has('helper')).toBe(false);
    });
  });

  describe('utility methods', () => {
    it('should report isEmpty correctly', () => {
      expect(callGraph.isEmpty()).toBe(true);

      callGraph.addFunction('test', createLocation());
      expect(callGraph.isEmpty()).toBe(false);
    });

    it('should clear all data', () => {
      callGraph.addCall('a', 'b', createLocation());
      callGraph.addCall('c', 'd', createLocation());

      callGraph.clear();

      expect(callGraph.isEmpty()).toBe(true);
      expect(callGraph.size()).toBe(0);
    });

    it('should generate toString representation', () => {
      callGraph.addCall('main', 'helper', createLocation());

      const str = callGraph.toString();
      expect(str).toContain('CallGraph');
      expect(str).toContain('main');
    });
  });
});

describe('CallGraphBuilder', () => {
  /**
   * Helper to build call graph from source code
   */
  function buildCallGraph(source: string): CallGraph {
    const program = parse(source);
    const symbolTable = new SymbolTable();

    // Register functions in symbol table (simplified for testing)
    // In real usage, SymbolTableBuilder would do this
    const builder = new CallGraphBuilder(symbolTable);
    return builder.build(program);
  }

  describe('function registration', () => {
    it('should register functions from source', () => {
      const source = `
        module Test

        function foo(): void {
        }

        function bar(): void {
        }
      `;

      const callGraph = buildCallGraph(source);

      expect(callGraph.getFunction('foo')).toBeDefined();
      expect(callGraph.getFunction('bar')).toBeDefined();
    });

    it('should track function locations', () => {
      const source = `
        module Test

        function myFunc(): void {
        }
      `;

      const callGraph = buildCallGraph(source);
      const funcNode = callGraph.getFunction('myFunc');

      expect(funcNode).toBeDefined();
      expect(funcNode!.location).toBeDefined();
      expect(funcNode!.location.start.line).toBeGreaterThan(0);
    });
  });

  describe('call relationship detection', () => {
    it('should detect direct function calls', () => {
      const source = `
        module Test

        function helper(): void {
        }

        function main(): void {
          helper();
        }
      `;

      const callGraph = buildCallGraph(source);

      expect(callGraph.getCallees('main').has('helper')).toBe(true);
      expect(callGraph.getCallers('helper').has('main')).toBe(true);
    });

    it('should detect multiple calls from same function', () => {
      const source = `
        module Test

        function foo(): void {
        }

        function bar(): void {
        }

        function main(): void {
          foo();
          bar();
          foo();
        }
      `;

      const callGraph = buildCallGraph(source);

      const callees = callGraph.getCallees('main');
      expect(callees.has('foo')).toBe(true);
      expect(callees.has('bar')).toBe(true);

      // Multiple calls to same function
      const callSites = callGraph.getCallSites('main', 'foo');
      expect(callSites.length).toBe(2);
    });

    it('should detect calls nested in expressions', () => {
      const source = `
        module Test

        function getValue(): byte {
          return 42;
        }

        function compute(x: byte): byte {
          return x;
        }

        function main(): void {
          let result: byte = compute(getValue());
        }
      `;

      const callGraph = buildCallGraph(source);

      expect(callGraph.getCallees('main').has('compute')).toBe(true);
      expect(callGraph.getCallees('main').has('getValue')).toBe(true);
    });

    it('should detect calls in control flow', () => {
      const source = `
        module Test

        function condition(): bool {
          return true;
        }

        function thenBranch(): void {
        }

        function elseBranch(): void {
        }

        function main(): void {
          if (condition()) {
            thenBranch();
          } else {
            elseBranch();
          }
        }
      `;

      const callGraph = buildCallGraph(source);

      expect(callGraph.getCallees('main').has('condition')).toBe(true);
      expect(callGraph.getCallees('main').has('thenBranch')).toBe(true);
      expect(callGraph.getCallees('main').has('elseBranch')).toBe(true);
    });

    it('should detect calls in loops', () => {
      const source = `
        module Test

        function process(): void {
        }

        function main(): void {
          let i: byte = 0;
          while (i < 10) {
            process();
            i = i + 1;
          }
        }
      `;

      const callGraph = buildCallGraph(source);

      expect(callGraph.getCallees('main').has('process')).toBe(true);
    });
  });

  describe('recursion detection from source', () => {
    it('should detect direct recursion', () => {
      const source = `
        module Test

        function factorial(n: byte): byte {
          if (n <= 1) {
            return 1;
          }
          return n * factorial(n - 1);
        }
      `;

      const callGraph = buildCallGraph(source);

      expect(callGraph.isDirectlyRecursive('factorial')).toBe(true);
    });

    it('should detect mutual recursion', () => {
      const source = `
        module Test

        function isEven(n: byte): bool {
          if (n == 0) { return true; }
          return isOdd(n - 1);
        }

        function isOdd(n: byte): bool {
          if (n == 0) { return false; }
          return isEven(n - 1);
        }
      `;

      const callGraph = buildCallGraph(source);

      expect(callGraph.isRecursive('isEven')).toBe(true);
      expect(callGraph.isRecursive('isOdd')).toBe(true);
    });

    it('should detect indirect recursion through multiple functions', () => {
      const source = `
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
      `;

      const callGraph = buildCallGraph(source);

      expect(callGraph.isRecursive('a')).toBe(true);
      expect(callGraph.isRecursive('b')).toBe(true);
      expect(callGraph.isRecursive('c')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty module', () => {
      const source = `module Empty`;
      const callGraph = buildCallGraph(source);

      expect(callGraph.isEmpty()).toBe(true);
    });

    it('should handle function with no body', () => {
      // Functions in Blend always have bodies, but let's test a simple case
      const source = `
        module Test

        function simple(): void {
        }
      `;

      const callGraph = buildCallGraph(source);

      expect(callGraph.getFunction('simple')).toBeDefined();
      expect(callGraph.getCallees('simple').size).toBe(0);
    });

    it('should handle deeply nested calls', () => {
      const source = `
        module Test

        function level1(): void {
          level2();
        }

        function level2(): void {
          level3();
        }

        function level3(): void {
          level4();
        }

        function level4(): void {
          level5();
        }

        function level5(): void {
        }
      `;

      const callGraph = buildCallGraph(source);

      expect(callGraph.getMaxCallDepth('level1')).toBe(4);
    });
  });
});