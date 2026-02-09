/**
 * Call Graph Analysis Tests
 *
 * Tests for the CallGraph class that builds and queries function call
 * relationships from an ILProgram. Covers:
 * - Graph construction (build)
 * - Reachability analysis (BFS from entry)
 * - Query methods (callers, callees, call counts)
 * - Recursion detection (direct and mutual)
 * - Rebuild after program modification
 * - Edge cases (empty programs, single functions, missing entry)
 *
 * @module __tests__/optimizer/analysis/call-graph
 */

import { describe, it, expect } from 'vitest';
import { CallGraph } from '../../../optimizer/analysis/call-graph.js';
import {
  createTestILFunction,
  createTestILProgram,
  createCallInstr,
  createReturnInstr,
  createLoadImmInstr,
  createStoreByteInstr,
} from '../helpers/optimizer-test-utils.js';

// ============================================================================
// Helper: Build a program with specific call structure
// ============================================================================

/**
 * Creates a simple program where main calls helper.
 * main → helper
 */
function createSimpleCallProgram() {
  const mainFunc = createTestILFunction(
    'main',
    [createLoadImmInstr(1), createCallInstr('helper'), createReturnInstr()],
    true
  );
  const helperFunc = createTestILFunction('helper', [
    createLoadImmInstr(42),
    createReturnInstr(),
  ]);
  return createTestILProgram([mainFunc, helperFunc], 'main');
}

/**
 * Creates a chain: main → a → b → c
 */
function createChainProgram() {
  const mainFunc = createTestILFunction(
    'main',
    [createCallInstr('a'), createReturnInstr()],
    true
  );
  const aFunc = createTestILFunction('a', [createCallInstr('b'), createReturnInstr()]);
  const bFunc = createTestILFunction('b', [createCallInstr('c'), createReturnInstr()]);
  const cFunc = createTestILFunction('c', [createLoadImmInstr(1), createReturnInstr()]);
  return createTestILProgram([mainFunc, aFunc, bFunc, cFunc], 'main');
}

/**
 * Creates a diamond: main → a, main → b, a → c, b → c
 */
function createDiamondProgram() {
  const mainFunc = createTestILFunction(
    'main',
    [createCallInstr('a'), createCallInstr('b'), createReturnInstr()],
    true
  );
  const aFunc = createTestILFunction('a', [createCallInstr('c'), createReturnInstr()]);
  const bFunc = createTestILFunction('b', [createCallInstr('c'), createReturnInstr()]);
  const cFunc = createTestILFunction('c', [createLoadImmInstr(1), createReturnInstr()]);
  return createTestILProgram([mainFunc, aFunc, bFunc, cFunc], 'main');
}

// ============================================================================
// Tests: CallGraph.build()
// ============================================================================

describe('CallGraph.build()', () => {
  it('should build from empty program', () => {
    const program = createTestILProgram([], 'main');
    const graph = CallGraph.build(program);

    expect(graph.getAllFunctions().size).toBe(0);
  });

  it('should build from single-function program (no calls)', () => {
    const mainFunc = createTestILFunction(
      'main',
      [createLoadImmInstr(1), createReturnInstr()],
      true
    );
    const program = createTestILProgram([mainFunc], 'main');
    const graph = CallGraph.build(program);

    expect(graph.getAllFunctions().size).toBe(1);
    expect(graph.hasFunction('main')).toBe(true);
    expect(graph.getCallees('main').size).toBe(0);
  });

  it('should build from simple caller-callee relationship', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);

    expect(graph.getAllFunctions().size).toBe(2);
    expect(graph.hasFunction('main')).toBe(true);
    expect(graph.hasFunction('helper')).toBe(true);
  });

  it('should record correct outgoing edges (callees)', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);

    const mainCallees = graph.getCallees('main');
    expect(mainCallees.has('helper')).toBe(true);
    expect(mainCallees.size).toBe(1);

    // helper calls no one
    expect(graph.getCallees('helper').size).toBe(0);
  });

  it('should record correct incoming edges (callers)', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);

    const helperCallers = graph.getCallers('helper');
    expect(helperCallers.has('main')).toBe(true);
    expect(helperCallers.size).toBe(1);

    // no one calls main (it's the entry)
    expect(graph.getCallers('main').size).toBe(0);
  });

  it('should build chain call graph correctly', () => {
    const program = createChainProgram();
    const graph = CallGraph.build(program);

    expect(graph.getCallees('main')).toEqual(new Set(['a']));
    expect(graph.getCallees('a')).toEqual(new Set(['b']));
    expect(graph.getCallees('b')).toEqual(new Set(['c']));
    expect(graph.getCallees('c')).toEqual(new Set());
  });

  it('should build diamond call graph correctly', () => {
    const program = createDiamondProgram();
    const graph = CallGraph.build(program);

    // main calls a and b
    expect(graph.getCallees('main')).toEqual(new Set(['a', 'b']));

    // Both a and b call c
    expect(graph.getCallers('c')).toEqual(new Set(['a', 'b']));
  });
});

// ============================================================================
// Tests: Call Counting
// ============================================================================

describe('CallGraph call counting', () => {
  it('should count single call site', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);

    expect(graph.getCallCount('helper')).toBe(1);
  });

  it('should count multiple call sites from same caller', () => {
    // main calls helper twice
    const mainFunc = createTestILFunction(
      'main',
      [createCallInstr('helper'), createCallInstr('helper'), createReturnInstr()],
      true
    );
    const helperFunc = createTestILFunction('helper', [createReturnInstr()]);
    const program = createTestILProgram([mainFunc, helperFunc], 'main');
    const graph = CallGraph.build(program);

    // 2 call sites, not 1 unique caller
    expect(graph.getCallCount('helper')).toBe(2);
  });

  it('should count call sites from multiple callers', () => {
    const program = createDiamondProgram();
    const graph = CallGraph.build(program);

    // c is called once from a and once from b → 2 call sites
    expect(graph.getCallCount('c')).toBe(2);
  });

  it('should return 0 for uncalled functions', () => {
    const mainFunc = createTestILFunction(
      'main',
      [createLoadImmInstr(1), createReturnInstr()],
      true
    );
    const unusedFunc = createTestILFunction('unused', [createReturnInstr()]);
    const program = createTestILProgram([mainFunc, unusedFunc], 'main');
    const graph = CallGraph.build(program);

    expect(graph.getCallCount('unused')).toBe(0);
    expect(graph.getCallCount('main')).toBe(0);
  });

  it('should return 0 for unknown function names', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);

    expect(graph.getCallCount('nonexistent')).toBe(0);
  });
});

// ============================================================================
// Tests: Reachability Analysis
// ============================================================================

describe('CallGraph reachability', () => {
  it('should mark entry point as reachable', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);

    expect(graph.isReachable('main')).toBe(true);
  });

  it('should mark directly called functions as reachable', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);

    expect(graph.isReachable('helper')).toBe(true);
  });

  it('should mark transitively called functions as reachable', () => {
    const program = createChainProgram();
    const graph = CallGraph.build(program);

    // main → a → b → c — all reachable
    expect(graph.isReachable('main')).toBe(true);
    expect(graph.isReachable('a')).toBe(true);
    expect(graph.isReachable('b')).toBe(true);
    expect(graph.isReachable('c')).toBe(true);
  });

  it('should mark uncalled functions as unreachable', () => {
    const mainFunc = createTestILFunction(
      'main',
      [createCallInstr('a'), createReturnInstr()],
      true
    );
    const aFunc = createTestILFunction('a', [createReturnInstr()]);
    const deadFunc = createTestILFunction('dead', [createReturnInstr()]);
    const program = createTestILProgram([mainFunc, aFunc, deadFunc], 'main');
    const graph = CallGraph.build(program);

    expect(graph.isReachable('main')).toBe(true);
    expect(graph.isReachable('a')).toBe(true);
    expect(graph.isReachable('dead')).toBe(false);
  });

  it('should return correct reachable set for diamond graph', () => {
    const program = createDiamondProgram();
    const graph = CallGraph.build(program);

    const reachable = graph.getReachableFunctions();
    expect(reachable).toEqual(new Set(['main', 'a', 'b', 'c']));
  });

  it('should handle empty program (no reachable functions)', () => {
    const program = createTestILProgram([], 'main');
    const graph = CallGraph.build(program);

    expect(graph.getReachableFunctions().size).toBe(0);
    expect(graph.isReachable('main')).toBe(false);
  });

  it('should cache reachability results', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);

    // First call computes and caches
    const first = graph.getReachableFunctions();
    // Second call returns cached set (same reference)
    const second = graph.getReachableFunctions();
    expect(first).toBe(second);
  });
});

// ============================================================================
// Tests: Recursion Detection
// ============================================================================

describe('CallGraph recursion detection', () => {
  it('should detect direct self-recursion', () => {
    // factorial calls itself
    const mainFunc = createTestILFunction(
      'main',
      [createCallInstr('factorial'), createReturnInstr()],
      true
    );
    const factorialFunc = createTestILFunction('factorial', [
      createLoadImmInstr(1),
      createCallInstr('factorial'),
      createReturnInstr(),
    ]);
    const program = createTestILProgram([mainFunc, factorialFunc], 'main');
    const graph = CallGraph.build(program);

    expect(graph.isRecursive('factorial')).toBe(true);
    expect(graph.isRecursive('main')).toBe(false);
  });

  it('should not flag non-recursive functions', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);

    expect(graph.isRecursive('main')).toBe(false);
    expect(graph.isRecursive('helper')).toBe(false);
  });

  it('should detect mutual recursion (A calls B, B calls A)', () => {
    const mainFunc = createTestILFunction(
      'main',
      [createCallInstr('isEven'), createReturnInstr()],
      true
    );
    const isEvenFunc = createTestILFunction('isEven', [
      createCallInstr('isOdd'),
      createReturnInstr(),
    ]);
    const isOddFunc = createTestILFunction('isOdd', [
      createCallInstr('isEven'),
      createReturnInstr(),
    ]);
    const program = createTestILProgram([mainFunc, isEvenFunc, isOddFunc], 'main');
    const graph = CallGraph.build(program);

    expect(graph.isMutuallyRecursive('isEven', 'isOdd')).toBe(true);
    expect(graph.isMutuallyRecursive('isOdd', 'isEven')).toBe(true);
  });

  it('should not flag non-mutual functions as mutually recursive', () => {
    const program = createChainProgram();
    const graph = CallGraph.build(program);

    // a → b → c is a chain, not mutual recursion
    expect(graph.isMutuallyRecursive('a', 'c')).toBe(false);
    expect(graph.isMutuallyRecursive('main', 'c')).toBe(false);
  });

  it('should handle self-recursive function in call count', () => {
    const recFunc = createTestILFunction('rec', [
      createCallInstr('rec'),
      createCallInstr('rec'),
      createReturnInstr(),
    ]);
    const mainFunc = createTestILFunction(
      'main',
      [createCallInstr('rec'), createReturnInstr()],
      true
    );
    const program = createTestILProgram([mainFunc, recFunc], 'main');
    const graph = CallGraph.build(program);

    // rec is called once from main + twice from itself = 3
    expect(graph.getCallCount('rec')).toBe(3);
    expect(graph.isRecursive('rec')).toBe(true);
  });
});

// ============================================================================
// Tests: Rebuild
// ============================================================================

describe('CallGraph.rebuild()', () => {
  it('should rebuild after function removal', () => {
    const program = createDiamondProgram();
    const graph = CallGraph.build(program);

    // All 4 functions initially reachable
    expect(graph.getReachableFunctions().size).toBe(4);

    // Simulate removing function 'b' — just keep main, a, c
    const mainFunc = createTestILFunction(
      'main',
      [createCallInstr('a'), createReturnInstr()],
      true
    );
    const aFunc = createTestILFunction('a', [createCallInstr('c'), createReturnInstr()]);
    const cFunc = createTestILFunction('c', [createLoadImmInstr(1), createReturnInstr()]);
    const modifiedProgram = createTestILProgram([mainFunc, aFunc, cFunc], 'main');

    graph.rebuild(modifiedProgram);

    expect(graph.getAllFunctions().size).toBe(3);
    expect(graph.hasFunction('b')).toBe(false);
    expect(graph.isReachable('main')).toBe(true);
    expect(graph.isReachable('a')).toBe(true);
    expect(graph.isReachable('c')).toBe(true);
    // c now only called from a (not from b)
    expect(graph.getCallCount('c')).toBe(1);
  });

  it('should invalidate reachability cache on rebuild', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);

    // Force cache population
    const before = graph.getReachableFunctions();
    expect(before.has('helper')).toBe(true);

    // Rebuild with no calls to helper
    const mainOnly = createTestILFunction(
      'main',
      [createLoadImmInstr(1), createReturnInstr()],
      true
    );
    const helperFunc = createTestILFunction('helper', [createReturnInstr()]);
    const modifiedProgram = createTestILProgram([mainOnly, helperFunc], 'main');
    graph.rebuild(modifiedProgram);

    // Cache should be invalidated; helper is now unreachable
    const after = graph.getReachableFunctions();
    expect(after.has('helper')).toBe(false);
    expect(after.has('main')).toBe(true);
  });

  it('should rebuild with added function', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);
    expect(graph.getAllFunctions().size).toBe(2);

    // Rebuild with new function
    const mainFunc = createTestILFunction(
      'main',
      [createCallInstr('helper'), createCallInstr('newFunc'), createReturnInstr()],
      true
    );
    const helperFunc = createTestILFunction('helper', [createReturnInstr()]);
    const newFunc = createTestILFunction('newFunc', [createReturnInstr()]);
    const modifiedProgram = createTestILProgram([mainFunc, helperFunc, newFunc], 'main');
    graph.rebuild(modifiedProgram);

    expect(graph.getAllFunctions().size).toBe(3);
    expect(graph.hasFunction('newFunc')).toBe(true);
    expect(graph.isReachable('newFunc')).toBe(true);
    expect(graph.getCallCount('newFunc')).toBe(1);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('CallGraph edge cases', () => {
  it('should handle function calling undefined function (external/intrinsic)', () => {
    // main calls 'externalFunc' which is not in the program
    const mainFunc = createTestILFunction(
      'main',
      [createCallInstr('externalFunc'), createReturnInstr()],
      true
    );
    const program = createTestILProgram([mainFunc], 'main');
    const graph = CallGraph.build(program);

    // main's callees should include externalFunc
    expect(graph.getCallees('main').has('externalFunc')).toBe(true);

    // externalFunc should have callers entry
    expect(graph.getCallers('externalFunc').has('main')).toBe(true);

    // externalFunc is not a known function (no callees map entry)
    expect(graph.hasFunction('externalFunc')).toBe(false);

    // externalFunc is "reachable" through the main call,
    // but since it's not in the graph as a node, it shows up only in edges
    expect(graph.getCallCount('externalFunc')).toBe(1);
  });

  it('should return empty sets for unknown function queries', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);

    expect(graph.getCallees('nonexistent').size).toBe(0);
    expect(graph.getCallers('nonexistent').size).toBe(0);
    expect(graph.getCallCount('nonexistent')).toBe(0);
  });

  it('should handle program with multiple disconnected components', () => {
    // main → a, isolated → b (isolated is not reachable from main)
    const mainFunc = createTestILFunction(
      'main',
      [createCallInstr('a'), createReturnInstr()],
      true
    );
    const aFunc = createTestILFunction('a', [createReturnInstr()]);
    const isolatedFunc = createTestILFunction('isolated', [
      createCallInstr('b'),
      createReturnInstr(),
    ]);
    const bFunc = createTestILFunction('b', [createReturnInstr()]);
    const program = createTestILProgram(
      [mainFunc, aFunc, isolatedFunc, bFunc],
      'main'
    );
    const graph = CallGraph.build(program);

    // main and a are reachable
    expect(graph.isReachable('main')).toBe(true);
    expect(graph.isReachable('a')).toBe(true);

    // isolated and b are NOT reachable from main
    expect(graph.isReachable('isolated')).toBe(false);
    expect(graph.isReachable('b')).toBe(false);

    // But the edges still exist
    expect(graph.getCallees('isolated').has('b')).toBe(true);
    expect(graph.getCallers('b').has('isolated')).toBe(true);
  });

  it('should report correct entry point', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);
    expect(graph.getEntryPoint()).toBe('main');
  });

  it('should handle invalidateCache() and recompute', () => {
    const program = createSimpleCallProgram();
    const graph = CallGraph.build(program);

    // Compute and cache
    const first = graph.getReachableFunctions();
    expect(first.size).toBe(2);

    // Invalidate
    graph.invalidateCache();

    // Should recompute (different object reference, same content)
    const second = graph.getReachableFunctions();
    expect(second.size).toBe(2);
    expect(first).not.toBe(second); // Different reference after invalidation
  });
});
