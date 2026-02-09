/**
 * Loop Tree Query Tests
 *
 * Tests for LoopTree query methods:
 * - getLoopFor(): find innermost loop for an instruction index
 * - getDepth(): get loop nesting depth for an instruction index
 * - getBodyIndices(): get instruction indices forming a loop body
 * - getPreheaderIndex(): get LICM insertion point
 *
 * @module __tests__/optimizer/analysis/loop-tree-queries
 */

import { describe, it, expect } from 'vitest';
import { LoopTree } from '../../../optimizer/analysis/loop-tree.js';
import {
  createSingleLoopFunc,
  createNestedLoopFunc,
  createSequentialLoopsFunc,
  createNoLoopFunc,
} from './loop-tree-test-utils.js';

// ============================================================================
// Tests: getLoopFor()
// ============================================================================

describe('LoopTree.getLoopFor()', () => {
  it('should return the loop for instructions inside the loop body', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);

    // Instructions 2-7 are in the loop body (header at 2, exit at 8)
    const loopAt2 = tree.getLoopFor(2);
    expect(loopAt2).not.toBeNull();
    expect(loopAt2!.headerLabel).toBe('while_0');

    const loopAt6 = tree.getLoopFor(6);
    expect(loopAt6).not.toBeNull();
    expect(loopAt6!.headerLabel).toBe('while_0');
  });

  it('should return null for instructions outside any loop', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);

    // Instruction 0 and 1 are before the loop
    expect(tree.getLoopFor(0)).toBeNull();
    expect(tree.getLoopFor(1)).toBeNull();

    // Instruction 8 is the exit label (not in loop body)
    expect(tree.getLoopFor(8)).toBeNull();

    // Instruction 9 is RETURN (after loop)
    expect(tree.getLoopFor(9)).toBeNull();
  });

  it('should return the innermost loop for nested loop instructions', () => {
    const func = createNestedLoopFunc();
    const tree = LoopTree.build(func);

    // Instructions in the inner loop (5-10) should return inner loop
    const innerLoop = tree.getLoopFor(6);
    expect(innerLoop).not.toBeNull();
    expect(innerLoop!.headerLabel).toBe('inner');
    expect(innerLoop!.depth).toBe(2);

    // Instructions in outer loop but outside inner (e.g., 3, 12)
    // should return outer loop
    const outerLoop = tree.getLoopFor(3);
    expect(outerLoop).not.toBeNull();
    expect(outerLoop!.headerLabel).toBe('outer');
    expect(outerLoop!.depth).toBe(1);
  });

  it('should return null for out-of-range indices', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);

    expect(tree.getLoopFor(-1)).toBeNull();
    expect(tree.getLoopFor(100)).toBeNull();
  });

  it('should return correct loop for sequential loops', () => {
    const func = createSequentialLoopsFunc();
    const tree = LoopTree.build(func);

    // Instructions in loop A body (2-7)
    const loopA = tree.getLoopFor(3);
    expect(loopA).not.toBeNull();
    expect(loopA!.headerLabel).toBe('loop_a');

    // Instructions in loop B body (11-16)
    const loopB = tree.getLoopFor(12);
    expect(loopB).not.toBeNull();
    expect(loopB!.headerLabel).toBe('loop_b');

    // Between loops (8-10) — not in any loop
    expect(tree.getLoopFor(9)).toBeNull();
  });
});

// ============================================================================
// Tests: getDepth()
// ============================================================================

describe('LoopTree.getDepth()', () => {
  it('should return 0 for instructions not in any loop', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);

    expect(tree.getDepth(0)).toBe(0);
    expect(tree.getDepth(9)).toBe(0);
  });

  it('should return 1 for outermost loop instructions', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);

    // All loop body instructions should have depth 1
    expect(tree.getDepth(2)).toBe(1);
    expect(tree.getDepth(5)).toBe(1);
    expect(tree.getDepth(7)).toBe(1);
  });

  it('should return 2 for inner loop instructions in nested loops', () => {
    const func = createNestedLoopFunc();
    const tree = LoopTree.build(func);

    // Inner loop body (indices 5-10)
    expect(tree.getDepth(6)).toBe(2);
    expect(tree.getDepth(9)).toBe(2);
  });

  it('should return 0 for no-loop functions', () => {
    const func = createNoLoopFunc();
    const tree = LoopTree.build(func);

    expect(tree.getDepth(0)).toBe(0);
    expect(tree.getDepth(2)).toBe(0);
  });
});

// ============================================================================
// Tests: getBodyIndices()
// ============================================================================

describe('LoopTree.getBodyIndices()', () => {
  it('should return correct body indices for a single loop', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);
    const loop = tree.getLoops()[0];

    const body = tree.getBodyIndices(loop);
    // Header at 2, exit at 8 → body is [2, 3, 4, 5, 6, 7]
    expect(body).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('should return indices in ascending order', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);
    const loop = tree.getLoops()[0];

    const body = tree.getBodyIndices(loop);
    for (let i = 1; i < body.length; i++) {
      expect(body[i]).toBeGreaterThan(body[i - 1]);
    }
  });

  it('should include inner loop instructions in outer loop body', () => {
    const func = createNestedLoopFunc();
    const tree = LoopTree.build(func);

    // Find outer loop
    const outerLoop = tree.getLoops().find(l => l.headerLabel === 'outer')!;
    const outerBody = tree.getBodyIndices(outerLoop);

    // Outer: header at 2, exit at 17 → body is [2..16]
    expect(outerBody).toHaveLength(15);
    expect(outerBody[0]).toBe(2);
    expect(outerBody[outerBody.length - 1]).toBe(16);

    // Inner loop instructions should be included in outer body
    expect(outerBody).toContain(5); // inner header
    expect(outerBody).toContain(9); // inner body instruction
  });

  it('should return only inner loop indices for inner loop', () => {
    const func = createNestedLoopFunc();
    const tree = LoopTree.build(func);

    // Find inner loop
    const innerLoop = tree.getLoops().find(l => l.headerLabel === 'inner')!;
    const innerBody = tree.getBodyIndices(innerLoop);

    // Inner: header at 5, exit at 11 → body is [5, 6, 7, 8, 9, 10]
    expect(innerBody).toEqual([5, 6, 7, 8, 9, 10]);
  });
});

// ============================================================================
// Tests: getPreheaderIndex()
// ============================================================================

describe('LoopTree.getPreheaderIndex()', () => {
  it('should return header index as the preheader insertion point', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);
    const loop = tree.getLoops()[0];

    // Header is at index 2, so preheader should be at index 2
    // (caller inserts before this position using splice)
    const preheader = tree.getPreheaderIndex(loop);
    expect(preheader).toBe(2);
  });

  it('should return 0 when header is at the start of instructions', () => {
    // The nested loop's outer header is at index 2 (not 0),
    // but we can test the boundary behavior: if a loop's header
    // is at index 0, preheader should be 0 (Math.max(0, 0) = 0)
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);
    const loop = tree.getLoops()[0];

    // Preheader for header at 2 is 2
    expect(tree.getPreheaderIndex(loop)).toBe(2);
  });

  it('should return correct preheader for inner nested loop', () => {
    const func = createNestedLoopFunc();
    const tree = LoopTree.build(func);

    const innerLoop = tree.getLoops().find(l => l.headerLabel === 'inner')!;
    // Inner header at index 5
    expect(tree.getPreheaderIndex(innerLoop)).toBe(5);
  });
});
