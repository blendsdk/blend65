/**
 * Tests for Frame Coalescer
 *
 * Tests the coalescing algorithm that allows non-overlapping functions
 * to share memory, achieving significant memory savings.
 *
 * @module __tests__/frame/coalescer.test
 */

import { describe, it, expect } from 'vitest';
import { FrameCoalescer, CoalesceGroup, CoalesceResult, coalesceFrames } from '../../frame/allocator/coalescer.js';
import { Frame, createFrame } from '../../frame/allocator/frame-calculator.js';
import { CallGraph } from '../../semantic/call-graph.js';
import { ThreadContext } from '../../frame/enums.js';
import { buildCallGraph, INLINE_FIXTURES } from './helpers/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a simple frame for testing
 */
function createTestFrame(
  name: string,
  totalSize: number,
  isCallback = false
): Frame {
  return createFrame(name, {
    totalSize,
    isCallback,
    isExported: false,
  });
}

/**
 * Create a simple call graph from an adjacency list.
 * Format: { 'caller': ['callee1', 'callee2'] }
 */
function createCallGraph(edges: Record<string, string[]>): CallGraph {
  const cg = new CallGraph();

  // Add all functions first
  const allFuncs = new Set<string>();
  for (const [caller, callees] of Object.entries(edges)) {
    allFuncs.add(caller);
    callees.forEach(callee => allFuncs.add(callee));
  }

  // Create a dummy source location
  const dummyLocation = {
    file: 'test.blend',
    line: 1,
    column: 1,
    startOffset: 0,
    endOffset: 0,
  };

  for (const func of allFuncs) {
    cg.addFunction(func, dummyLocation);
  }

  // Add edges
  for (const [caller, callees] of Object.entries(edges)) {
    for (const callee of callees) {
      cg.addCall(caller, callee, dummyLocation);
    }
  }

  return cg;
}

/**
 * Create frames map from a simple spec
 * Format: { 'funcName': size } or { 'funcName': { size, isCallback } }
 */
function createFrames(
  spec: Record<string, number | { size: number; isCallback?: boolean }>
): Map<string, Frame> {
  const frames = new Map<string, Frame>();
  for (const [name, value] of Object.entries(spec)) {
    if (typeof value === 'number') {
      frames.set(name, createTestFrame(name, value));
    } else {
      frames.set(name, createTestFrame(name, value.size, value.isCallback ?? false));
    }
  }
  return frames;
}

// ============================================================================
// Overlap Detection Tests
// ============================================================================

describe('FrameCoalescer - Overlap Detection', () => {
  const coalescer = new FrameCoalescer();

  describe('overlaps()', () => {
    it('should detect direct caller-callee overlap', () => {
      // main -> funcA
      const callGraph = createCallGraph({
        main: ['funcA'],
        funcA: [],
      });

      expect(coalescer.overlaps('main', 'funcA', callGraph)).toBe(true);
      expect(coalescer.overlaps('funcA', 'main', callGraph)).toBe(true);
    });

    it('should detect indirect caller-callee overlap', () => {
      // main -> funcA -> funcB
      const callGraph = createCallGraph({
        main: ['funcA'],
        funcA: ['funcB'],
        funcB: [],
      });

      expect(coalescer.overlaps('main', 'funcB', callGraph)).toBe(true);
      expect(coalescer.overlaps('funcB', 'main', callGraph)).toBe(true);
    });

    it('should detect same function overlaps with itself', () => {
      const callGraph = createCallGraph({
        main: [],
      });

      expect(coalescer.overlaps('main', 'main', callGraph)).toBe(true);
    });

    it('should detect non-overlap for sibling functions', () => {
      // main calls funcA and funcB sequentially (no call relationship between them)
      const callGraph = createCallGraph({
        main: ['funcA', 'funcB'],
        funcA: [],
        funcB: [],
      });

      // funcA and funcB don't call each other
      expect(coalescer.overlaps('funcA', 'funcB', callGraph)).toBe(false);
    });

    it('should detect non-overlap for independent function trees', () => {
      // Two independent call trees
      const callGraph = createCallGraph({
        main: ['treeA'],
        treeA: ['leafA'],
        callback: ['treeB'],
        treeB: ['leafB'],
        leafA: [],
        leafB: [],
      });

      // Functions in different trees don't overlap
      expect(coalescer.overlaps('treeA', 'treeB', callGraph)).toBe(false);
      expect(coalescer.overlaps('leafA', 'leafB', callGraph)).toBe(false);
    });

    it('should detect overlap through deep call chain', () => {
      // main -> a -> b -> c -> d
      const callGraph = createCallGraph({
        main: ['a'],
        a: ['b'],
        b: ['c'],
        c: ['d'],
        d: [],
      });

      expect(coalescer.overlaps('main', 'd', callGraph)).toBe(true);
      expect(coalescer.overlaps('a', 'd', callGraph)).toBe(true);
    });

    it('should handle diamond call pattern correctly', () => {
      // main -> funcA -> [funcB, funcC]
      // funcB and funcC are siblings (both called by funcA)
      const callGraph = createCallGraph({
        main: ['funcA'],
        funcA: ['funcB', 'funcC'],
        funcB: [],
        funcC: [],
      });

      // funcB and funcC don't call each other, so no overlap
      expect(coalescer.overlaps('funcB', 'funcC', callGraph)).toBe(false);

      // But funcA calls both, so overlaps with both
      expect(coalescer.overlaps('funcA', 'funcB', callGraph)).toBe(true);
      expect(coalescer.overlaps('funcA', 'funcC', callGraph)).toBe(true);
    });
  });
});

// ============================================================================
// Thread Context Detection Tests
// ============================================================================

describe('FrameCoalescer - Thread Context Detection', () => {
  const coalescer = new FrameCoalescer();

  describe('determineThreadContext()', () => {
    it('should detect MainOnly for functions called from main', () => {
      const callGraph = createCallGraph({
        main: ['helper'],
        helper: [],
      });
      const frames = createFrames({ main: 1, helper: 1 });

      expect(coalescer.determineThreadContext('helper', callGraph, frames)).toBe(
        ThreadContext.MainOnly
      );
    });

    it('should detect IsrOnly for callback functions', () => {
      const callGraph = createCallGraph({
        main: [],
        irq: [],
      });
      const frames = createFrames({
        main: 1,
        irq: { size: 1, isCallback: true },
      });

      expect(coalescer.determineThreadContext('irq', callGraph, frames)).toBe(
        ThreadContext.IsrOnly
      );
    });

    it('should detect IsrOnly for functions called only from callbacks', () => {
      const callGraph = createCallGraph({
        main: [],
        irq: ['isrHelper'],
        isrHelper: [],
      });
      const frames = createFrames({
        main: 1,
        irq: { size: 1, isCallback: true },
        isrHelper: 1,
      });

      expect(coalescer.determineThreadContext('isrHelper', callGraph, frames)).toBe(
        ThreadContext.IsrOnly
      );
    });

    it('should detect Both for functions called from main and callback', () => {
      const callGraph = createCallGraph({
        main: ['sharedHelper'],
        irq: ['sharedHelper'],
        sharedHelper: [],
      });
      const frames = createFrames({
        main: 1,
        irq: { size: 1, isCallback: true },
        sharedHelper: 1,
      });

      expect(coalescer.determineThreadContext('sharedHelper', callGraph, frames)).toBe(
        ThreadContext.Both
      );
    });

    it('should detect main function as MainOnly', () => {
      const callGraph = createCallGraph({
        main: [],
      });
      const frames = createFrames({ main: 1 });

      expect(coalescer.determineThreadContext('main', callGraph, frames)).toBe(
        ThreadContext.MainOnly
      );
    });

    it('should handle indirect reachability for thread context', () => {
      const callGraph = createCallGraph({
        main: ['a'],
        a: ['b'],
        b: ['shared'],
        irq: ['c'],
        c: ['shared'],
        shared: [],
      });
      const frames = createFrames({
        main: 1,
        a: 1,
        b: 1,
        irq: { size: 1, isCallback: true },
        c: 1,
        shared: 1,
      });

      // shared is reachable from both main (via a->b) and irq (via c)
      expect(coalescer.determineThreadContext('shared', callGraph, frames)).toBe(
        ThreadContext.Both
      );
    });
  });
});

// ============================================================================
// Group Building Tests
// ============================================================================

describe('FrameCoalescer - Group Building', () => {
  const coalescer = new FrameCoalescer();

  describe('coalesce() - basic grouping', () => {
    it('should put non-overlapping siblings in same group', () => {
      // main calls funcA and funcB (no relationship between A and B)
      const callGraph = createCallGraph({
        main: ['funcA', 'funcB'],
        funcA: [],
        funcB: [],
      });
      const frames = createFrames({
        main: 1,
        funcA: 2,
        funcB: 3,
      });

      const result = coalescer.coalesce(callGraph, frames);

      // funcA and funcB should be in the same group
      const groupA = result.functionToGroup.get('funcA');
      const groupB = result.functionToGroup.get('funcB');
      expect(groupA).toBe(groupB);
    });

    it('should put overlapping functions in different groups', () => {
      // main -> funcA -> funcB (A calls B)
      const callGraph = createCallGraph({
        main: ['funcA'],
        funcA: ['funcB'],
        funcB: [],
      });
      const frames = createFrames({
        main: 1,
        funcA: 2,
        funcB: 3,
      });

      const result = coalescer.coalesce(callGraph, frames);

      // funcA and funcB overlap (A calls B), so different groups
      const groupA = result.functionToGroup.get('funcA');
      const groupB = result.functionToGroup.get('funcB');
      expect(groupA).not.toBe(groupB);
    });

    it('should put functions in different thread contexts in different groups', () => {
      const callGraph = createCallGraph({
        main: [],
        irq: [],
      });
      const frames = createFrames({
        main: 1,
        irq: { size: 1, isCallback: true },
      });

      const result = coalescer.coalesce(callGraph, frames);

      // main and irq are in different thread contexts
      const groupMain = result.functionToGroup.get('main');
      const groupIrq = result.functionToGroup.get('irq');
      expect(groupMain).not.toBe(groupIrq);
    });

    it('should handle empty frames map', () => {
      const callGraph = createCallGraph({});
      const frames = new Map<string, Frame>();

      const result = coalescer.coalesce(callGraph, frames);

      expect(result.groups).toHaveLength(0);
      expect(result.bytesSaved).toBe(0);
    });

    it('should handle single function', () => {
      const callGraph = createCallGraph({
        main: [],
      });
      const frames = createFrames({ main: 5 });

      const result = coalescer.coalesce(callGraph, frames);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].members).toContain('main');
      expect(result.groups[0].size).toBe(5);
    });
  });

  describe('coalesce() - group size calculation', () => {
    it('should set group size to max of member sizes', () => {
      const callGraph = createCallGraph({
        main: ['funcA', 'funcB', 'funcC'],
        funcA: [],
        funcB: [],
        funcC: [],
      });
      const frames = createFrames({
        main: 1,
        funcA: 5,
        funcB: 10,
        funcC: 3,
      });

      const result = coalescer.coalesce(callGraph, frames);

      // funcA, funcB, funcC should coalesce (all siblings)
      const groupA = result.functionToGroup.get('funcA');
      const group = result.groups.find(g => g.id === groupA);
      expect(group?.size).toBe(10); // Max of 5, 10, 3
    });
  });

  describe('coalesce() - complex scenarios', () => {
    it('should handle diamond call pattern', () => {
      // main -> A -> [B, C]
      // B and C are siblings, can coalesce
      const callGraph = createCallGraph({
        main: ['A'],
        A: ['B', 'C'],
        B: [],
        C: [],
      });
      const frames = createFrames({
        main: 1,
        A: 2,
        B: 3,
        C: 4,
      });

      const result = coalescer.coalesce(callGraph, frames);

      // B and C should be in same group
      const groupB = result.functionToGroup.get('B');
      const groupC = result.functionToGroup.get('C');
      expect(groupB).toBe(groupC);

      // A should NOT be in same group as B or C (A calls both)
      const groupA = result.functionToGroup.get('A');
      expect(groupA).not.toBe(groupB);
    });

    it('should handle many independent functions', () => {
      // main calls many independent functions
      const callGraph = createCallGraph({
        main: ['f1', 'f2', 'f3', 'f4', 'f5'],
        f1: [],
        f2: [],
        f3: [],
        f4: [],
        f5: [],
      });
      const frames = createFrames({
        main: 1,
        f1: 2,
        f2: 3,
        f3: 4,
        f4: 5,
        f5: 6,
      });

      const result = coalescer.coalesce(callGraph, frames);

      // All f1-f5 should be in same group (all siblings, no overlaps)
      const group1 = result.functionToGroup.get('f1');
      expect(result.functionToGroup.get('f2')).toBe(group1);
      expect(result.functionToGroup.get('f3')).toBe(group1);
      expect(result.functionToGroup.get('f4')).toBe(group1);
      expect(result.functionToGroup.get('f5')).toBe(group1);
    });

    it('should handle chain call pattern (no coalescing possible)', () => {
      // main -> A -> B -> C (chain)
      // Every function calls the next, so no coalescing
      const callGraph = createCallGraph({
        main: ['A'],
        A: ['B'],
        B: ['C'],
        C: [],
      });
      const frames = createFrames({
        main: 1,
        A: 2,
        B: 3,
        C: 4,
      });

      const result = coalescer.coalesce(callGraph, frames);

      // Each function should be in its own group
      const groupMain = result.functionToGroup.get('main');
      const groupA = result.functionToGroup.get('A');
      const groupB = result.functionToGroup.get('B');
      const groupC = result.functionToGroup.get('C');

      expect(groupMain).not.toBe(groupA);
      expect(groupA).not.toBe(groupB);
      expect(groupB).not.toBe(groupC);
    });

    it('should handle mixed ISR and main contexts correctly', () => {
      const callGraph = createCallGraph({
        main: ['mainHelper'],
        mainHelper: [],
        irq: ['irqHelper'],
        irqHelper: [],
      });
      const frames = createFrames({
        main: 1,
        mainHelper: 2,
        irq: { size: 3, isCallback: true },
        irqHelper: 4,
      });

      const result = coalescer.coalesce(callGraph, frames);

      // main and mainHelper should NOT coalesce (main calls mainHelper)
      const groupMain = result.functionToGroup.get('main');
      const groupMainHelper = result.functionToGroup.get('mainHelper');
      expect(groupMain).not.toBe(groupMainHelper);

      // irq and irqHelper should NOT coalesce (irq calls irqHelper)
      const groupIrq = result.functionToGroup.get('irq');
      const groupIrqHelper = result.functionToGroup.get('irqHelper');
      expect(groupIrq).not.toBe(groupIrqHelper);

      // mainHelper and irqHelper should NOT coalesce (different contexts)
      expect(groupMainHelper).not.toBe(groupIrqHelper);
    });

    it('should isolate functions with Both thread context', () => {
      const callGraph = createCallGraph({
        main: ['shared', 'mainOnly'],
        irq: ['shared'],
        shared: [],
        mainOnly: [],
      });
      const frames = createFrames({
        main: 1,
        mainOnly: 2,
        irq: { size: 3, isCallback: true },
        shared: 4,
      });

      const result = coalescer.coalesce(callGraph, frames);

      // shared has Both context, cannot coalesce with anyone
      const groupShared = result.functionToGroup.get('shared');
      const sharedGroup = result.groups.find(g => g.id === groupShared);
      expect(sharedGroup?.members).toEqual(['shared']);
    });
  });
});

// ============================================================================
// Memory Savings Calculation Tests
// ============================================================================

describe('FrameCoalescer - Memory Savings', () => {
  const coalescer = new FrameCoalescer();

  it('should calculate 0% savings when no coalescing is possible', () => {
    // Chain: each function calls the next
    const callGraph = createCallGraph({
      main: ['A'],
      A: ['B'],
      B: [],
    });
    const frames = createFrames({
      main: 10,
      A: 10,
      B: 10,
    });

    const result = coalescer.coalesce(callGraph, frames);

    expect(result.bytesWithoutCoalescing).toBe(30);
    expect(result.bytesWithCoalescing).toBe(30); // No savings
    expect(result.bytesSaved).toBe(0);
    expect(result.savingsPercent).toBeCloseTo(0, 2);
  });

  it('should calculate significant savings with many siblings', () => {
    // main calls 4 functions with equal sizes
    const callGraph = createCallGraph({
      main: ['f1', 'f2', 'f3', 'f4'],
      f1: [],
      f2: [],
      f3: [],
      f4: [],
    });
    const frames = createFrames({
      main: 5,
      f1: 10,
      f2: 10,
      f3: 10,
      f4: 10,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // Without coalescing: 5 + 10 + 10 + 10 + 10 = 45 bytes
    expect(result.bytesWithoutCoalescing).toBe(45);

    // With coalescing: main(5) + max(f1,f2,f3,f4)(10) = 15 bytes
    expect(result.bytesWithCoalescing).toBe(15);

    // Savings: 45 - 15 = 30 bytes (66.7%)
    expect(result.bytesSaved).toBe(30);
    expect(result.savingsPercent).toBeCloseTo(0.667, 2);
  });

  it('should calculate savings with varied frame sizes', () => {
    const callGraph = createCallGraph({
      main: ['small', 'medium', 'large'],
      small: [],
      medium: [],
      large: [],
    });
    const frames = createFrames({
      main: 5,
      small: 2,
      medium: 10,
      large: 20,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // Without: 5 + 2 + 10 + 20 = 37
    expect(result.bytesWithoutCoalescing).toBe(37);

    // With: main(5) + max(small,medium,large)(20) = 25
    expect(result.bytesWithCoalescing).toBe(25);

    // Savings: 37 - 25 = 12 (32.4%)
    expect(result.bytesSaved).toBe(12);
    expect(result.savingsPercent).toBeCloseTo(0.324, 2);
  });
});

// ============================================================================
// Integration with Real Source Code Tests
// ============================================================================

describe('FrameCoalescer - Integration with Real Parser', () => {
  const coalescer = new FrameCoalescer();

  it('should handle nonOverlapping fixture correctly', () => {
    const source = INLINE_FIXTURES.nonOverlapping;
    const { callGraph } = buildCallGraph(source);

    // Create frames manually (frame calculator would do this in real use)
    const frames = createFrames({
      main: 0, // void function, no locals visible
      funcA: 1, // let a: byte
      funcB: 1, // let b: byte
    });

    const result = coalescer.coalesce(callGraph, frames);

    // funcA and funcB should coalesce (both called by main, don't call each other)
    const groupA = result.functionToGroup.get('funcA');
    const groupB = result.functionToGroup.get('funcB');
    expect(groupA).toBe(groupB);
  });

  it('should handle nestedCalls fixture correctly', () => {
    const source = INLINE_FIXTURES.nestedCalls;
    const { callGraph } = buildCallGraph(source);

    const frames = createFrames({
      main: 0,
      outer: 1, // outerLocal
      inner: 1, // innerLocal
    });

    const result = coalescer.coalesce(callGraph, frames);

    // outer and inner should NOT coalesce (outer calls inner)
    const groupOuter = result.functionToGroup.get('outer');
    const groupInner = result.functionToGroup.get('inner');
    expect(groupOuter).not.toBe(groupInner);
  });

  it('should handle manyIndependent fixture with high savings', () => {
    const source = INLINE_FIXTURES.manyIndependent;
    const { callGraph } = buildCallGraph(source);

    const frames = createFrames({
      main: 0,
      funcA: 1,
      funcB: 1,
      funcC: 1,
      funcD: 1,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // All 4 functions should coalesce
    const groupA = result.functionToGroup.get('funcA');
    expect(result.functionToGroup.get('funcB')).toBe(groupA);
    expect(result.functionToGroup.get('funcC')).toBe(groupA);
    expect(result.functionToGroup.get('funcD')).toBe(groupA);

    // Savings: 4 bytes -> 1 byte = 75%
    expect(result.savingsPercent).toBeGreaterThanOrEqual(0.6);
  });

  it('should handle diamondPattern fixture correctly', () => {
    const source = INLINE_FIXTURES.diamondPattern;
    const { callGraph } = buildCallGraph(source);

    const frames = createFrames({
      main: 0,
      funcA: 0,
      funcB: 1,
      funcC: 1,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // funcB and funcC should coalesce (siblings called by funcA)
    const groupB = result.functionToGroup.get('funcB');
    const groupC = result.functionToGroup.get('funcC');
    expect(groupB).toBe(groupC);
  });

  it('should handle gameLoop fixture correctly', () => {
    const source = INLINE_FIXTURES.gameLoop;
    const { callGraph } = buildCallGraph(source);

    const frames = createFrames({
      main: 0,
      init: 1,
      update: 1,
      render: 1,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // init, update, render should all coalesce (all called by main)
    const groupInit = result.functionToGroup.get('init');
    const groupUpdate = result.functionToGroup.get('update');
    const groupRender = result.functionToGroup.get('render');
    expect(groupInit).toBe(groupUpdate);
    expect(groupUpdate).toBe(groupRender);
  });

  it('should handle stateMachine fixture correctly', () => {
    const source = INLINE_FIXTURES.stateMachine;
    const { callGraph } = buildCallGraph(source);

    const frames = createFrames({
      main: 1, // state variable
      handleIdle: 1,
      handleRunning: 1,
      handlePaused: 1,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // All handlers should coalesce (mutually exclusive execution)
    const groupIdle = result.functionToGroup.get('handleIdle');
    const groupRunning = result.functionToGroup.get('handleRunning');
    const groupPaused = result.functionToGroup.get('handlePaused');
    expect(groupIdle).toBe(groupRunning);
    expect(groupRunning).toBe(groupPaused);
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('coalesceFrames() factory function', () => {
  it('should work as a convenience wrapper', () => {
    const callGraph = createCallGraph({
      main: ['funcA', 'funcB'],
      funcA: [],
      funcB: [],
    });
    const frames = createFrames({
      main: 1,
      funcA: 2,
      funcB: 3,
    });

    const result = coalesceFrames(callGraph, frames);

    // Same behavior as creating coalescer manually
    const groupA = result.functionToGroup.get('funcA');
    const groupB = result.functionToGroup.get('funcB');
    expect(groupA).toBe(groupB);
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('FrameCoalescer - Edge Cases', () => {
  const coalescer = new FrameCoalescer();

  it('should handle function not in call graph', () => {
    const callGraph = createCallGraph({
      main: [],
    });
    // Frame for function not in call graph
    const frames = createFrames({
      main: 1,
      orphan: 2, // Not in call graph
    });

    const result = coalescer.coalesce(callGraph, frames);

    // Should still create groups for all frames
    expect(result.functionToGroup.has('main')).toBe(true);
    expect(result.functionToGroup.has('orphan')).toBe(true);
  });

  it('should handle zero-size frames', () => {
    const callGraph = createCallGraph({
      main: ['empty1', 'empty2'],
      empty1: [],
      empty2: [],
    });
    const frames = createFrames({
      main: 0,
      empty1: 0,
      empty2: 0,
    });

    const result = coalescer.coalesce(callGraph, frames);

    // Should work with zero-size frames
    expect(result.bytesWithoutCoalescing).toBe(0);
    expect(result.bytesWithCoalescing).toBe(0);
    expect(result.savingsPercent).toBe(0);
  });

  it('should produce deterministic results', () => {
    const callGraph = createCallGraph({
      main: ['f1', 'f2', 'f3', 'f4', 'f5'],
      f1: [],
      f2: [],
      f3: [],
      f4: [],
      f5: [],
    });
    const frames = createFrames({
      main: 1,
      f1: 5,
      f2: 4,
      f3: 3,
      f4: 2,
      f5: 1,
    });

    // Run multiple times
    const results: CoalesceResult[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(coalescer.coalesce(callGraph, frames));
    }

    // All results should be identical
    const firstGroups = results[0].groups.map(g => g.members.sort().join(','));
    for (let i = 1; i < results.length; i++) {
      const groups = results[i].groups.map(g => g.members.sort().join(','));
      expect(groups).toEqual(firstGroups);
    }
  });
});