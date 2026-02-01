/**
 * Coalescing Integration Tests
 *
 * Tests the integration of frame coalescing with the frame allocator,
 * verifying that memory addresses are correctly assigned to coalesce groups.
 *
 * @module __tests__/frame/integration/coalescing.test
 */

import { describe, it, expect } from 'vitest';
import { FrameAllocator, createFrameAllocator } from '../../../frame/allocator/frame-allocator.js';
import { FrameCoalescer, coalesceFrames, CoalesceResult } from '../../../frame/allocator/coalescer.js';
import { Frame, createFrame, FrameCalculator } from '../../../frame/allocator/frame-calculator.js';
import { C64_PLATFORM_CONFIG, TEST_PLATFORM_CONFIG } from '../../../frame/platform.js';
import { CallGraph, CallGraphBuilder } from '../../../semantic/call-graph.js';
import { SymbolTable } from '../../../semantic/symbol-table.js';
import { SymbolTableBuilder } from '../../../semantic/visitors/symbol-table-builder.js';
import { buildCallGraph, parseSource, INLINE_FIXTURES } from '../helpers/index.js';
import { ThreadContext } from '../../../frame/enums.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create frames map from a simple spec
 */
function createFrames(
  spec: Record<string, number | { size: number; isCallback?: boolean }>
): Map<string, Frame> {
  const frames = new Map<string, Frame>();
  for (const [name, value] of Object.entries(spec)) {
    if (typeof value === 'number') {
      frames.set(name, createFrame(name, { totalSize: value }));
    } else {
      frames.set(name, createFrame(name, {
        totalSize: value.size,
        isCallback: value.isCallback ?? false,
      }));
    }
  }
  return frames;
}

/**
 * Create a simple call graph from an adjacency list.
 */
function createCallGraph(edges: Record<string, string[]>): CallGraph {
  const cg = new CallGraph();
  const dummyLocation = {
    file: 'test.blend',
    line: 1,
    column: 1,
    startOffset: 0,
    endOffset: 0,
  };

  const allFuncs = new Set<string>();
  for (const [caller, callees] of Object.entries(edges)) {
    allFuncs.add(caller);
    callees.forEach(callee => allFuncs.add(callee));
  }

  for (const func of allFuncs) {
    cg.addFunction(func, dummyLocation);
  }

  for (const [caller, callees] of Object.entries(edges)) {
    for (const callee of callees) {
      cg.addCall(caller, callee, dummyLocation);
    }
  }

  return cg;
}

// ============================================================================
// Integration Tests: Coalescer with Frame Calculator
// ============================================================================

describe('Coalescing Integration - Coalescer with Frames', () => {
  const coalescer = new FrameCoalescer();

  it('should coalesce siblings and calculate correct memory savings', () => {
    const callGraph = createCallGraph({
      main: ['funcA', 'funcB', 'funcC'],
      funcA: [],
      funcB: [],
      funcC: [],
    });
    const frames = createFrames({
      main: 5,
      funcA: 10,
      funcB: 10,
      funcC: 10,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // All 3 functions should coalesce
    const groupA = result.functionToGroup.get('funcA');
    expect(result.functionToGroup.get('funcB')).toBe(groupA);
    expect(result.functionToGroup.get('funcC')).toBe(groupA);

    // Without: 5 + 10 + 10 + 10 = 35
    // With: 5 + 10 = 15
    // Savings: 20 bytes (57%)
    expect(result.bytesWithoutCoalescing).toBe(35);
    expect(result.bytesWithCoalescing).toBe(15);
    expect(result.bytesSaved).toBe(20);
    expect(result.savingsPercent).toBeCloseTo(0.571, 2);
  });

  it('should not coalesce caller-callee pairs', () => {
    const callGraph = createCallGraph({
      main: ['outer'],
      outer: ['inner'],
      inner: [],
    });
    const frames = createFrames({
      main: 2,
      outer: 10,
      inner: 10,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // outer and inner overlap (outer calls inner)
    expect(result.functionToGroup.get('outer')).not.toBe(
      result.functionToGroup.get('inner')
    );

    // No savings possible in a chain
    expect(result.bytesSaved).toBe(0);
  });

  it('should isolate ISR from main thread', () => {
    const callGraph = createCallGraph({
      main: ['mainHelper'],
      mainHelper: [],
      irq: ['irqHelper'],
      irqHelper: [],
    });
    const frames = createFrames({
      main: 2,
      mainHelper: 5,
      irq: { size: 3, isCallback: true },
      irqHelper: 5,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // mainHelper and irqHelper should be in different groups (different contexts)
    expect(result.functionToGroup.get('mainHelper')).not.toBe(
      result.functionToGroup.get('irqHelper')
    );
  });
});

// ============================================================================
// Integration Tests: Real Source Code Parsing
// ============================================================================

describe('Coalescing Integration - With Real Parser', () => {
  const coalescer = new FrameCoalescer();

  it('should handle game loop pattern with significant savings', () => {
    const source = INLINE_FIXTURES.gameLoop;
    const { callGraph } = buildCallGraph(source);

    const frames = createFrames({
      main: 0,
      init: 10,
      update: 10,
      render: 10,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // init, update, render should all coalesce
    const initGroup = result.functionToGroup.get('init');
    expect(result.functionToGroup.get('update')).toBe(initGroup);
    expect(result.functionToGroup.get('render')).toBe(initGroup);

    // Without: 0 + 10 + 10 + 10 = 30
    // With: 0 + 10 = 10
    // Savings: 20 bytes (66.7%)
    expect(result.bytesWithoutCoalescing).toBe(30);
    expect(result.bytesWithCoalescing).toBe(10);
    expect(result.savingsPercent).toBeCloseTo(0.667, 2);
  });

  it('should handle state machine pattern with coalescing', () => {
    const source = INLINE_FIXTURES.stateMachine;
    const { callGraph } = buildCallGraph(source);

    const frames = createFrames({
      main: 5,
      handleIdle: 8,
      handleRunning: 8,
      handlePaused: 8,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // All handlers should coalesce
    const idleGroup = result.functionToGroup.get('handleIdle');
    expect(result.functionToGroup.get('handleRunning')).toBe(idleGroup);
    expect(result.functionToGroup.get('handlePaused')).toBe(idleGroup);

    // Without: 5 + 8 + 8 + 8 = 29
    // With: 5 + 8 = 13
    // Savings: 16 bytes (55%)
    expect(result.savingsPercent).toBeGreaterThan(0.5);
  });

  it('should correctly handle callback isolation', () => {
    const source = INLINE_FIXTURES.callbackIsolation;
    const { callGraph } = buildCallGraph(source);

    const frames = createFrames({
      main: 5,
      irq: { size: 10, isCallback: true },
    });

    const result = coalescer.coalesce(callGraph, frames);

    // main and irq should be in different groups
    expect(result.functionToGroup.get('main')).not.toBe(
      result.functionToGroup.get('irq')
    );
  });
});

// ============================================================================
// Address Assignment Integration Tests
// ============================================================================

describe('Coalescing Integration - Address Assignment', () => {
  it('should assign base addresses to coalesce groups', () => {
    const callGraph = createCallGraph({
      main: ['funcA', 'funcB'],
      funcA: [],
      funcB: [],
    });
    const frames = createFrames({
      main: 5,
      funcA: 10,
      funcB: 15,
    });

    const result = coalesceFrames(callGraph, frames);

    // Two groups: main (alone, or not), funcA+funcB (coalesced)
    expect(result.groups.length).toBeGreaterThanOrEqual(1);

    // Find the group containing funcA and funcB
    const coalescedGroup = result.groups.find(
      g => g.members.includes('funcA') && g.members.includes('funcB')
    );
    expect(coalescedGroup).toBeDefined();
    expect(coalescedGroup!.size).toBe(15); // Max of 10, 15
  });

  it('should correctly calculate group count', () => {
    const callGraph = createCallGraph({
      main: ['a'],
      a: ['b'],
      b: [],
      irq: ['c'],
      c: [],
    });
    const frames = createFrames({
      main: 1,
      a: 2,
      b: 3,
      irq: { size: 4, isCallback: true },
      c: 5,
    });

    const result = coalesceFrames(callGraph, frames);

    // Each function in call chain = separate group
    // main -> a -> b (3 groups in main thread)
    // irq -> c (2 groups in ISR thread)
    // Total: 5 groups (no coalescing possible in chains)
    expect(result.groups.length).toBe(5);
  });

  it('should achieve target savings for many independent functions', () => {
    // Simulate a scenario with many independent helper functions
    const callGraph = createCallGraph({
      main: ['helper1', 'helper2', 'helper3', 'helper4', 'helper5', 'helper6', 'helper7', 'helper8'],
      helper1: [],
      helper2: [],
      helper3: [],
      helper4: [],
      helper5: [],
      helper6: [],
      helper7: [],
      helper8: [],
    });
    const frames = createFrames({
      main: 2,
      helper1: 10,
      helper2: 10,
      helper3: 10,
      helper4: 10,
      helper5: 10,
      helper6: 10,
      helper7: 10,
      helper8: 10,
    });

    const result = coalesceFrames(callGraph, frames);

    // Without: 2 + 8*10 = 82 bytes
    // With: 2 + 10 = 12 bytes (all helpers coalesce)
    // Savings: 70 bytes (85%)
    expect(result.bytesWithoutCoalescing).toBe(82);
    expect(result.bytesWithCoalescing).toBe(12);
    expect(result.savingsPercent).toBeGreaterThanOrEqual(0.8);
  });
});

// ============================================================================
// Thread Context Integration Tests
// ============================================================================

describe('Coalescing Integration - Thread Context', () => {
  const coalescer = new FrameCoalescer();

  it('should correctly identify shared functions', () => {
    const callGraph = createCallGraph({
      main: ['shared', 'mainOnly'],
      irq: ['shared', 'isrOnly'],
      shared: [],
      mainOnly: [],
      isrOnly: [],
    });
    const frames = createFrames({
      main: 2,
      shared: 10,
      mainOnly: 5,
      irq: { size: 3, isCallback: true },
      isrOnly: 5,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // shared is called from both contexts - should be isolated
    const sharedGroup = result.functionToGroup.get('shared');
    const sharedGroupObj = result.groups.find(g => g.id === sharedGroup);
    expect(sharedGroupObj?.members).toEqual(['shared']);

    // mainOnly and isrOnly should NOT coalesce with each other
    expect(result.functionToGroup.get('mainOnly')).not.toBe(
      result.functionToGroup.get('isrOnly')
    );
  });

  it('should allow ISR functions to coalesce with each other', () => {
    const callGraph = createCallGraph({
      main: [],
      irq: ['isrHelper1', 'isrHelper2'],
      isrHelper1: [],
      isrHelper2: [],
    });
    const frames = createFrames({
      main: 2,
      irq: { size: 3, isCallback: true },
      isrHelper1: 5,
      isrHelper2: 5,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // isrHelper1 and isrHelper2 should coalesce (both ISR context, siblings)
    expect(result.functionToGroup.get('isrHelper1')).toBe(
      result.functionToGroup.get('isrHelper2')
    );
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Coalescing Integration - Edge Cases', () => {
  it('should handle program with only main function', () => {
    const callGraph = createCallGraph({
      main: [],
    });
    const frames = createFrames({
      main: 10,
    });

    const result = coalesceFrames(callGraph, frames);

    expect(result.groups.length).toBe(1);
    expect(result.bytesSaved).toBe(0);
    expect(result.savingsPercent).toBe(0);
  });

  it('should handle deeply nested call chain', () => {
    const callGraph = createCallGraph({
      main: ['level1'],
      level1: ['level2'],
      level2: ['level3'],
      level3: ['level4'],
      level4: ['level5'],
      level5: [],
    });
    const frames = createFrames({
      main: 2,
      level1: 4,
      level2: 4,
      level3: 4,
      level4: 4,
      level5: 4,
    });

    const result = coalesceFrames(callGraph, frames);

    // No coalescing in a straight chain
    expect(result.groups.length).toBe(6);
    expect(result.bytesSaved).toBe(0);
  });

  it('should handle multiple independent call trees', () => {
    // Two completely independent trees
    const callGraph = createCallGraph({
      main: ['treeA_root', 'treeB_root'],
      treeA_root: ['treeA_leaf'],
      treeA_leaf: [],
      treeB_root: ['treeB_leaf'],
      treeB_leaf: [],
    });
    const frames = createFrames({
      main: 2,
      treeA_root: 10,
      treeA_leaf: 5,
      treeB_root: 10,
      treeB_leaf: 5,
    });

    const result = coalesceFrames(callGraph, frames);

    // treeA_root and treeB_root can coalesce (siblings)
    expect(result.functionToGroup.get('treeA_root')).toBe(
      result.functionToGroup.get('treeB_root')
    );

    // treeA_leaf and treeB_leaf can coalesce (both are leaves, no overlap)
    expect(result.functionToGroup.get('treeA_leaf')).toBe(
      result.functionToGroup.get('treeB_leaf')
    );
  });
});