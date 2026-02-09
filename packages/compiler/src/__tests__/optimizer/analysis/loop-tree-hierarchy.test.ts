/**
 * Loop Tree Hierarchy Tests
 *
 * Tests for LoopTree parent/child hierarchy and advanced scenarios:
 * - Parent/child relationships in nested loops
 * - getRootLoops() for outermost loops
 * - Sequential loops (siblings at same depth)
 * - Index map caching behavior
 *
 * @module __tests__/optimizer/analysis/loop-tree-hierarchy
 */

import { describe, it, expect } from 'vitest';
import { LoopTree } from '../../../optimizer/analysis/loop-tree.js';
import type { ILInstruction } from '../../../il/instruction.js';
import type { ILLoop } from '../../../il/structures.js';
import { createILLoop } from '../../../il/factories.js';
import {
  createNestedLoopFunc,
  createSequentialLoopsFunc,
  createSingleLoopFunc,
  createNoLoopFunc,
} from './loop-tree-test-utils.js';
import {
  createTestILFunction,
  createLabelInstr,
  createLoadImmInstr,
  createJumpInstr,
  createReturnInstr,
} from '../helpers/optimizer-test-utils.js';

// ============================================================================
// Tests: Parent/Child Hierarchy
// ============================================================================

describe('LoopTree hierarchy (parent/child)', () => {
  it('should set parent to null for outermost loops', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);
    const loop = tree.getLoops()[0];

    expect(loop.parent).toBeNull();
  });

  it('should set correct parent for inner nested loop', () => {
    const func = createNestedLoopFunc();
    const tree = LoopTree.build(func);

    const outerLoop = tree.getLoops().find(l => l.headerLabel === 'outer')!;
    const innerLoop = tree.getLoops().find(l => l.headerLabel === 'inner')!;

    // Inner loop's parent should be outer loop
    expect(innerLoop.parent).toBe(outerLoop);
    // Outer loop has no parent
    expect(outerLoop.parent).toBeNull();
  });

  it('should set children correctly for outer loop with one child', () => {
    const func = createNestedLoopFunc();
    const tree = LoopTree.build(func);

    const outerLoop = tree.getLoops().find(l => l.headerLabel === 'outer')!;
    const innerLoop = tree.getLoops().find(l => l.headerLabel === 'inner')!;

    // Outer should have inner as child
    expect(outerLoop.children).toHaveLength(1);
    expect(outerLoop.children[0]).toBe(innerLoop);

    // Inner should have no children
    expect(innerLoop.children).toHaveLength(0);
  });

  it('should have no parent/child relationships for sequential loops', () => {
    const func = createSequentialLoopsFunc();
    const tree = LoopTree.build(func);
    const loops = tree.getLoops();

    // Both loops are at the same depth and not nested
    expect(loops[0].parent).toBeNull();
    expect(loops[1].parent).toBeNull();
    expect(loops[0].children).toHaveLength(0);
    expect(loops[1].children).toHaveLength(0);
  });
});

// ============================================================================
// Tests: getRootLoops()
// ============================================================================

describe('LoopTree.getRootLoops()', () => {
  it('should return single root for single loop', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);
    const roots = tree.getRootLoops();

    expect(roots).toHaveLength(1);
    expect(roots[0].headerLabel).toBe('while_0');
  });

  it('should return only the outer loop as root for nested loops', () => {
    const func = createNestedLoopFunc();
    const tree = LoopTree.build(func);
    const roots = tree.getRootLoops();

    // Only the outer loop is a root — inner loop has a parent
    expect(roots).toHaveLength(1);
    expect(roots[0].headerLabel).toBe('outer');
  });

  it('should return both loops as roots for sequential loops', () => {
    const func = createSequentialLoopsFunc();
    const tree = LoopTree.build(func);
    const roots = tree.getRootLoops();

    // Both sequential loops are roots (no nesting)
    expect(roots).toHaveLength(2);
    expect(roots[0].headerLabel).toBe('loop_a');
    expect(roots[1].headerLabel).toBe('loop_b');
  });

  it('should return empty array when no loops exist', () => {
    const func = createNoLoopFunc();
    const tree = LoopTree.build(func);

    expect(tree.getRootLoops()).toHaveLength(0);
  });
});

// ============================================================================
// Tests: Deeply Nested Loops (3 levels)
// ============================================================================

describe('LoopTree with 3-level nesting', () => {
  /**
   * Creates a function with 3 levels of nesting: L1 > L2 > L3
   *
   * Structure:
   *   LOAD_IMM 0         [0]
   *   LABEL L1           [1]  ← L1 header (depth 1)
   *   LABEL L2           [2]  ← L2 header (depth 2)
   *   LABEL L3           [3]  ← L3 header (depth 3)
   *   LOAD_IMM 1         [4]  (innermost body)
   *   JUMP L3            [5]
   *   LABEL L3_exit      [6]  ← L3 exit
   *   JUMP L2            [7]
   *   LABEL L2_exit      [8]  ← L2 exit
   *   JUMP L1            [9]
   *   LABEL L1_exit      [10] ← L1 exit
   *   RETURN             [11]
   */
  function createTripleNestedFunc() {
    const instructions: ILInstruction[] = [
      createLoadImmInstr(0),          // [0]
      createLabelInstr('L1'),         // [1] L1 header
      createLabelInstr('L2'),         // [2] L2 header
      createLabelInstr('L3'),         // [3] L3 header
      createLoadImmInstr(1),          // [4] innermost body
      createJumpInstr('L3'),          // [5]
      createLabelInstr('L3_exit'),    // [6] L3 exit
      createJumpInstr('L2'),          // [7]
      createLabelInstr('L2_exit'),    // [8] L2 exit
      createJumpInstr('L1'),          // [9]
      createLabelInstr('L1_exit'),    // [10] L1 exit
      createReturnInstr(),            // [11]
    ];

    const loops: ILLoop[] = [
      createILLoop('L1', 'L1_exit', 1),
      createILLoop('L2', 'L2_exit', 2),
      createILLoop('L3', 'L3_exit', 3),
    ];

    const func = createTestILFunction('tripleNested', instructions, true);
    func.loops = loops;
    func.maxLoopDepth = 3;
    return func;
  }

  it('should detect 3 loops with correct depths', () => {
    const func = createTripleNestedFunc();
    const tree = LoopTree.build(func);

    expect(tree.getLoopCount()).toBe(3);
    expect(tree.getMaxDepth()).toBe(3);
  });

  it('should build correct hierarchy: L1 > L2 > L3', () => {
    const func = createTripleNestedFunc();
    const tree = LoopTree.build(func);
    const loops = tree.getLoops();

    const l1 = loops.find(l => l.headerLabel === 'L1')!;
    const l2 = loops.find(l => l.headerLabel === 'L2')!;
    const l3 = loops.find(l => l.headerLabel === 'L3')!;

    // L1 is root
    expect(l1.parent).toBeNull();
    expect(l1.children).toContain(l2);

    // L2 is child of L1, parent of L3
    expect(l2.parent).toBe(l1);
    expect(l2.children).toContain(l3);

    // L3 is leaf
    expect(l3.parent).toBe(l2);
    expect(l3.children).toHaveLength(0);
  });

  it('should return only L1 as root', () => {
    const func = createTripleNestedFunc();
    const tree = LoopTree.build(func);

    const roots = tree.getRootLoops();
    expect(roots).toHaveLength(1);
    expect(roots[0].headerLabel).toBe('L1');
  });

  it('should return innermost (L3) for deeply nested instructions', () => {
    const func = createTripleNestedFunc();
    const tree = LoopTree.build(func);

    // Instruction 4 is in L3 body (innermost)
    const loop = tree.getLoopFor(4);
    expect(loop).not.toBeNull();
    expect(loop!.headerLabel).toBe('L3');
    expect(loop!.depth).toBe(3);
  });
});

// ============================================================================
// Tests: Index Map Caching
// ============================================================================

describe('LoopTree index map caching', () => {
  it('should return consistent results on repeated queries', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);

    // First call builds the index map
    const first = tree.getLoopFor(5);
    // Second call uses cached map
    const second = tree.getLoopFor(5);

    // Both should return the same loop object
    expect(first).toBe(second);
  });

  it('should handle getDepth after getLoopFor (shared cache)', () => {
    const func = createNestedLoopFunc();
    const tree = LoopTree.build(func);

    // getLoopFor triggers index map build
    const loop = tree.getLoopFor(6);
    expect(loop).not.toBeNull();

    // getDepth should use the same cached map
    expect(tree.getDepth(6)).toBe(2);
    expect(tree.getDepth(3)).toBe(1);
    expect(tree.getDepth(0)).toBe(0);
  });
});
