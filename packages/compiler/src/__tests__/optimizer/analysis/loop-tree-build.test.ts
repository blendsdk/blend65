/**
 * Loop Tree Build Tests
 *
 * Tests for LoopTree.build() construction and basic query methods:
 * - Building from functions with various loop configurations
 * - getLoops(), hasLoops(), getLoopCount(), getMaxDepth()
 * - Counted loop metadata preservation
 * - Edge cases: empty functions, no loops, unresolvable labels
 *
 * @module __tests__/optimizer/analysis/loop-tree-build
 */

import { describe, it, expect } from 'vitest';
import { LoopTree } from '../../../optimizer/analysis/loop-tree.js';
import {
  createSingleLoopFunc,
  createCountedLoopFunc,
  createNestedLoopFunc,
  createSequentialLoopsFunc,
  createNoLoopFunc,
  createEmptyFunc,
  createUnresolvableLoopFunc,
} from './loop-tree-test-utils.js';

// ============================================================================
// Tests: LoopTree.build() — Basic Construction
// ============================================================================

describe('LoopTree.build()', () => {
  it('should build from a function with a single loop', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);

    expect(tree.hasLoops()).toBe(true);
    expect(tree.getLoopCount()).toBe(1);
  });

  it('should resolve header and exit indices correctly for a single loop', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);
    const loops = tree.getLoops();

    expect(loops).toHaveLength(1);
    // while_0 label is at index 2, while_0_exit label is at index 8
    expect(loops[0].headerIndex).toBe(2);
    expect(loops[0].exitIndex).toBe(8);
    expect(loops[0].headerLabel).toBe('while_0');
    expect(loops[0].exitLabel).toBe('while_0_exit');
  });

  it('should preserve depth from ILLoop', () => {
    const func = createSingleLoopFunc();
    const tree = LoopTree.build(func);
    const loops = tree.getLoops();

    expect(loops[0].depth).toBe(1);
  });

  it('should build from a counted loop and preserve metadata', () => {
    const func = createCountedLoopFunc();
    const tree = LoopTree.build(func);
    const loops = tree.getLoops();

    expect(loops).toHaveLength(1);
    // Original ILLoop should be accessible via .loop property
    expect(loops[0].loop.isCountedLoop).toBe(true);
    expect(loops[0].loop.boundValue).toBe(8);
    expect(loops[0].loop.estimatedIterations).toBe(8);
  });

  it('should build from nested loops', () => {
    const func = createNestedLoopFunc();
    const tree = LoopTree.build(func);

    expect(tree.getLoopCount()).toBe(2);
    expect(tree.getMaxDepth()).toBe(2);
  });

  it('should build from sequential loops', () => {
    const func = createSequentialLoopsFunc();
    const tree = LoopTree.build(func);

    expect(tree.getLoopCount()).toBe(2);
    expect(tree.getMaxDepth()).toBe(1);
  });

  it('should sort loops by headerIndex (ascending)', () => {
    const func = createSequentialLoopsFunc();
    const tree = LoopTree.build(func);
    const loops = tree.getLoops();

    // loop_a (header at 2) should come before loop_b (header at 11)
    expect(loops[0].headerLabel).toBe('loop_a');
    expect(loops[1].headerLabel).toBe('loop_b');
    expect(loops[0].headerIndex).toBeLessThan(loops[1].headerIndex);
  });
});

// ============================================================================
// Tests: LoopTree.build() — Edge Cases
// ============================================================================

describe('LoopTree.build() edge cases', () => {
  it('should handle function with no loops', () => {
    const func = createNoLoopFunc();
    const tree = LoopTree.build(func);

    expect(tree.hasLoops()).toBe(false);
    expect(tree.getLoopCount()).toBe(0);
    expect(tree.getLoops()).toHaveLength(0);
    expect(tree.getMaxDepth()).toBe(0);
  });

  it('should handle empty function (no instructions)', () => {
    const func = createEmptyFunc();
    const tree = LoopTree.build(func);

    expect(tree.hasLoops()).toBe(false);
    expect(tree.getLoopCount()).toBe(0);
  });

  it('should skip loops with unresolvable labels', () => {
    // The function has loop metadata but the LABEL instructions
    // referenced by the loop don't exist in the instruction stream
    const func = createUnresolvableLoopFunc();
    const tree = LoopTree.build(func);

    // The unresolvable loop should be silently skipped
    expect(tree.hasLoops()).toBe(false);
    expect(tree.getLoopCount()).toBe(0);
  });

  it('should return empty root loops when no loops exist', () => {
    const func = createNoLoopFunc();
    const tree = LoopTree.build(func);

    expect(tree.getRootLoops()).toHaveLength(0);
  });
});
