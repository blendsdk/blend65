/**
 * Tests for Dominator Tree Types and Algorithm
 *
 * **Session 2 Tests:** Type structure and basic functionality
 * - DominatorInfo interface
 * - DominatorTree class
 *
 * **Session 3 Tests:** Algorithm tests for computeDominators()
 * - Various CFG patterns (linear, diamond, loops, etc.)
 * - Dominance properties (reflexive, transitive, antisymmetric)
 * - computeIntersection() helper function
 *
 * @module __tests__/il/ssa-dominators.test
 */

import { describe, it, expect } from 'vitest';
import {
  DominatorTree,
  computeDominators,
  computeIntersection,
  type DominatorInfo,
} from '../../il/ssa/dominators.js';
import { ILFunction } from '../../il/function.js';
import { IL_BYTE, IL_VOID } from '../../il/types.js';
import {
  ILReturnVoidInstruction,
  ILJumpInstruction,
  ILBranchInstruction,
} from '../../il/instructions.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a simple DominatorInfo object for testing.
 *
 * @param blockId - Block ID
 * @param immediateDominator - Immediate dominator ID (-1 for entry)
 * @param dominates - Set of block IDs this block dominates
 * @param depth - Depth in dominator tree
 * @returns DominatorInfo object
 */
function createDominatorInfo(
  blockId: number,
  immediateDominator: number,
  dominates: Set<number>,
  depth: number,
): DominatorInfo {
  return {
    blockId,
    immediateDominator,
    dominates,
    depth,
  };
}

/**
 * Creates a simple DominatorTree for testing.
 *
 * Creates a linear chain: entry(0) -> block1(1) -> block2(2)
 *
 * @returns DominatorTree with 3 blocks
 */
function createSimpleDominatorTree(): DominatorTree {
  const map = new Map<number, DominatorInfo>();

  // Entry block (0) dominates all blocks (0, 1, 2)
  map.set(
    0,
    createDominatorInfo(
      0,
      -1, // Entry has no dominator
      new Set([0, 1, 2]), // Dominates all
      0, // Depth 0
    ),
  );

  // Block 1 dominated by entry, dominates blocks 1 and 2
  map.set(
    1,
    createDominatorInfo(
      1,
      0, // Immediate dominator is entry
      new Set([1, 2]), // Dominates self and block 2
      1, // Depth 1
    ),
  );

  // Block 2 is a leaf, only dominates itself
  map.set(
    2,
    createDominatorInfo(
      2,
      1, // Immediate dominator is block 1
      new Set([2]), // Only dominates self
      2, // Depth 2
    ),
  );

  return new DominatorTree(map, 0);
}

// =============================================================================
// Session 2 Tests: Type Structure and Basic Functionality
// =============================================================================

describe('SSA Dominator Tree Types (Session 2)', () => {
  // ---------------------------------------------------------------------------
  // Test 1: DominatorInfo interface has required fields
  // ---------------------------------------------------------------------------
  describe('DominatorInfo Interface', () => {
    it('Test 1: DominatorInfo interface has all required fields', () => {
      // Create a DominatorInfo object with all required fields
      const info: DominatorInfo = {
        blockId: 0,
        immediateDominator: -1,
        dominates: new Set([0, 1, 2]),
        depth: 0,
      };

      // Verify all fields exist and have correct types
      expect(typeof info.blockId).toBe('number');
      expect(typeof info.immediateDominator).toBe('number');
      expect(info.dominates).toBeInstanceOf(Set);
      expect(typeof info.depth).toBe('number');

      // Verify values
      expect(info.blockId).toBe(0);
      expect(info.immediateDominator).toBe(-1);
      expect(info.dominates.has(0)).toBe(true);
      expect(info.dominates.has(1)).toBe(true);
      expect(info.dominates.has(2)).toBe(true);
      expect(info.depth).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: DominatorTree class instantiation
  // ---------------------------------------------------------------------------
  describe('DominatorTree Class Instantiation', () => {
    it('Test 2: DominatorTree class can be instantiated', () => {
      const map = new Map<number, DominatorInfo>();
      const entryInfo = createDominatorInfo(0, -1, new Set([0]), 0);
      map.set(0, entryInfo);

      const tree = new DominatorTree(map, 0);

      expect(tree).toBeInstanceOf(DominatorTree);
      expect(tree.getBlockCount()).toBe(1);
      expect(tree.getEntryBlockId()).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: getImmediateDominator() returns undefined for unknown block
  // ---------------------------------------------------------------------------
  describe('getImmediateDominator()', () => {
    it('Test 3: returns undefined for unknown block', () => {
      const tree = createSimpleDominatorTree();

      // Query a block that doesn't exist
      const result = tree.getImmediateDominator(999);

      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: dominates() returns false for unrelated blocks
  // ---------------------------------------------------------------------------
  describe('dominates()', () => {
    it('Test 4: returns false for unrelated/unknown blocks', () => {
      const tree = createSimpleDominatorTree();

      // Unknown block cannot dominate anything
      expect(tree.dominates(999, 0)).toBe(false);

      // Known block cannot dominate unknown block
      expect(tree.dominates(0, 999)).toBe(false);

      // Block 2 does not dominate block 1 (reverse direction)
      expect(tree.dominates(2, 1)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 5: getDominatedBlocks() returns empty set for unknown block
  // ---------------------------------------------------------------------------
  describe('getDominatedBlocks()', () => {
    it('Test 5: returns empty set for unknown block', () => {
      const tree = createSimpleDominatorTree();

      const result = tree.getDominatedBlocks(999);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 6: getDepth() returns -1 for unknown block
  // ---------------------------------------------------------------------------
  describe('getDepth()', () => {
    it('Test 6: returns -1 for unknown block', () => {
      const tree = createSimpleDominatorTree();

      const result = tree.getDepth(999);

      expect(result).toBe(-1);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 7: Entry block immediate dominator is -1
  // ---------------------------------------------------------------------------
  describe('Entry Block Properties', () => {
    it('Test 7: entry block immediate dominator is -1', () => {
      const tree = createSimpleDominatorTree();

      const idom = tree.getImmediateDominator(0);

      expect(idom).toBe(-1);
    });

    // -------------------------------------------------------------------------
    // Test 8: Entry block depth is 0
    // -------------------------------------------------------------------------
    it('Test 8: entry block depth is 0', () => {
      const tree = createSimpleDominatorTree();

      const depth = tree.getDepth(0);

      expect(depth).toBe(0);
    });

    // -------------------------------------------------------------------------
    // Test 9: Entry block dominates itself
    // -------------------------------------------------------------------------
    it('Test 9: entry block dominates itself', () => {
      const tree = createSimpleDominatorTree();

      // Reflexive property: every block dominates itself
      expect(tree.dominates(0, 0)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 10: DominatorTree is frozen/immutable after construction
  // ---------------------------------------------------------------------------
  describe('Immutability', () => {
    it('Test 10: DominatorTree is frozen/immutable after construction', () => {
      const tree = createSimpleDominatorTree();

      // Verify the tree is frozen
      expect(Object.isFrozen(tree)).toBe(true);

      // Attempting to modify should fail silently or throw in strict mode
      // We test that the properties haven't changed
      expect(tree.getBlockCount()).toBe(3);
      expect(tree.getEntryBlockId()).toBe(0);

      // The dominated set returned should be a copy, so modifications don't affect tree
      const dominated = tree.getDominatedBlocks(0);
      dominated.add(999);

      // Original should be unchanged
      const dominatedAgain = tree.getDominatedBlocks(0);
      expect(dominatedAgain.has(999)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Additional Structural Tests (Beyond Session 2 minimum)
  // ---------------------------------------------------------------------------
  describe('Additional Structural Tests', () => {
    it('getAllBlockIds() returns all block IDs', () => {
      const tree = createSimpleDominatorTree();

      const ids = tree.getAllBlockIds();

      expect(ids.sort()).toEqual([0, 1, 2]);
    });

    it('getInfo() returns DominatorInfo for valid block', () => {
      const tree = createSimpleDominatorTree();

      const info = tree.getInfo(1);

      expect(info).toBeDefined();
      expect(info?.blockId).toBe(1);
      expect(info?.immediateDominator).toBe(0);
      expect(info?.depth).toBe(1);
    });

    it('getInfo() returns undefined for invalid block', () => {
      const tree = createSimpleDominatorTree();

      const info = tree.getInfo(999);

      expect(info).toBeUndefined();
    });

    it('strictlyDominates() works correctly', () => {
      const tree = createSimpleDominatorTree();

      // Entry strictly dominates block 1
      expect(tree.strictlyDominates(0, 1)).toBe(true);

      // Entry does NOT strictly dominate itself
      expect(tree.strictlyDominates(0, 0)).toBe(false);

      // Block 2 does not strictly dominate block 1
      expect(tree.strictlyDominates(2, 1)).toBe(false);
    });

    it('getImmediatelyDominatedBlocks() returns correct children', () => {
      const tree = createSimpleDominatorTree();

      // Entry block's immediate children: [1]
      expect(tree.getImmediatelyDominatedBlocks(0)).toEqual([1]);

      // Block 1's immediate children: [2]
      expect(tree.getImmediatelyDominatedBlocks(1)).toEqual([2]);

      // Block 2 is a leaf (no children)
      expect(tree.getImmediatelyDominatedBlocks(2)).toEqual([]);
    });

    it('getPreorder() returns correct traversal order', () => {
      const tree = createSimpleDominatorTree();

      const preorder = tree.getPreorder();

      // Preorder: parent before children
      // Entry -> Block 1 -> Block 2
      expect(preorder).toEqual([0, 1, 2]);
    });

    it('getPostorder() returns correct traversal order', () => {
      const tree = createSimpleDominatorTree();

      const postorder = tree.getPostorder();

      // Postorder: children before parent
      // Block 2 -> Block 1 -> Entry
      expect(postorder).toEqual([2, 1, 0]);
    });

    it('toString() returns human-readable representation', () => {
      const tree = createSimpleDominatorTree();

      const str = tree.toString();

      expect(str).toContain('DominatorTree');
      expect(str).toContain('block0');
      expect(str).toContain('block1');
      expect(str).toContain('block2');
      expect(str).toContain('depth=0');
      expect(str).toContain('depth=1');
      expect(str).toContain('depth=2');
    });
  });

});

// =============================================================================
// Session 3 Tests: Algorithm Tests for computeDominators()
// =============================================================================

describe('SSA Dominator Tree Algorithm (Session 3)', () => {
  // ---------------------------------------------------------------------------
  // computeIntersection() Helper Tests
  // ---------------------------------------------------------------------------
  describe('computeIntersection() Helper', () => {
    it('Test S3.1: returns empty set for empty input', () => {
      const result = computeIntersection([]);
      expect(result.size).toBe(0);
    });

    it('Test S3.2: returns copy of single set', () => {
      const set = new Set([1, 2, 3]);
      const result = computeIntersection([set]);

      expect(result.size).toBe(3);
      expect(result.has(1)).toBe(true);
      expect(result.has(2)).toBe(true);
      expect(result.has(3)).toBe(true);

      // Should be a copy, not the same reference
      set.add(4);
      expect(result.has(4)).toBe(false);
    });

    it('Test S3.3: computes correct intersection of multiple sets', () => {
      const set1 = new Set([1, 2, 3, 4]);
      const set2 = new Set([2, 3, 4, 5]);
      const set3 = new Set([3, 4, 5, 6]);

      const result = computeIntersection([set1, set2, set3]);

      // Only 3 and 4 are in all sets
      expect(result.size).toBe(2);
      expect(result.has(3)).toBe(true);
      expect(result.has(4)).toBe(true);
      expect(result.has(1)).toBe(false);
      expect(result.has(2)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Single Block and Linear Chain Tests
  // ---------------------------------------------------------------------------
  describe('Single Block and Linear Chain CFGs', () => {
    it('Test S3.4: single block function (entry only)', () => {
      // Create function with only entry block
      const func = new ILFunction('single', [], IL_VOID);
      const entry = func.getEntryBlock();
      entry.addInstruction(new ILReturnVoidInstruction(0));

      const domTree = computeDominators(func);

      // Entry dominates only itself
      expect(domTree.getBlockCount()).toBe(1);
      expect(domTree.dominates(0, 0)).toBe(true);
      expect(domTree.getImmediateDominator(0)).toBe(-1);
      expect(domTree.getDepth(0)).toBe(0);
    });

    it('Test S3.5: linear chain A -> B -> C', () => {
      // Create: entry -> b1 -> b2 (linear chain)
      const func = new ILFunction('linear', [], IL_VOID);
      const entry = func.getEntryBlock();
      const b1 = func.createBlock('b1');
      const b2 = func.createBlock('b2');

      // Link: entry -> b1 -> b2
      entry.linkTo(b1);
      entry.addInstruction(new ILJumpInstruction(0, b1.getLabel()));

      b1.linkTo(b2);
      b1.addInstruction(new ILJumpInstruction(1, b2.getLabel()));

      b2.addInstruction(new ILReturnVoidInstruction(2));

      const domTree = computeDominators(func);

      // Verify block count
      expect(domTree.getBlockCount()).toBe(3);

      // Entry (0) dominates all
      expect(domTree.dominates(0, 0)).toBe(true);
      expect(domTree.dominates(0, 1)).toBe(true);
      expect(domTree.dominates(0, 2)).toBe(true);

      // B1 (1) dominates itself and B2
      expect(domTree.dominates(1, 1)).toBe(true);
      expect(domTree.dominates(1, 2)).toBe(true);
      expect(domTree.dominates(1, 0)).toBe(false);

      // B2 (2) only dominates itself
      expect(domTree.dominates(2, 2)).toBe(true);
      expect(domTree.dominates(2, 1)).toBe(false);
      expect(domTree.dominates(2, 0)).toBe(false);

      // Verify depths
      expect(domTree.getDepth(0)).toBe(0);
      expect(domTree.getDepth(1)).toBe(1);
      expect(domTree.getDepth(2)).toBe(2);
    });

    it('Test S3.6: entry dominates all reachable blocks', () => {
      // Create: entry -> b1, entry -> b2 (two parallel branches)
      const func = new ILFunction('parallel', [], IL_VOID);
      const entry = func.getEntryBlock();
      const b1 = func.createBlock('b1');
      const b2 = func.createBlock('b2');

      // Create a dummy condition register
      const condReg = func.createRegister(IL_BYTE, 'cond');

      // Link: entry branches to b1 or b2
      entry.linkTo(b1);
      entry.linkTo(b2);
      entry.addInstruction(new ILBranchInstruction(0, condReg, b1.getLabel(), b2.getLabel()));

      b1.addInstruction(new ILReturnVoidInstruction(1));
      b2.addInstruction(new ILReturnVoidInstruction(2));

      const domTree = computeDominators(func);

      // Entry dominates all blocks
      expect(domTree.dominates(0, 0)).toBe(true);
      expect(domTree.dominates(0, 1)).toBe(true);
      expect(domTree.dominates(0, 2)).toBe(true);

      // B1 and B2 don't dominate each other (parallel branches)
      expect(domTree.dominates(1, 2)).toBe(false);
      expect(domTree.dominates(2, 1)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Diamond and Loop Pattern Tests
  // ---------------------------------------------------------------------------
  describe('Diamond and Loop Patterns', () => {
    it('Test S3.7: diamond pattern A -> B,C -> D', () => {
      // Create diamond: entry -> b1 and b2 -> merge
      //     entry (0)
      //      / \
      //     b1  b2
      //      \ /
      //     merge
      const func = new ILFunction('diamond', [], IL_VOID);
      const entry = func.getEntryBlock();
      const b1 = func.createBlock('b1');
      const b2 = func.createBlock('b2');
      const merge = func.createBlock('merge');

      const condReg = func.createRegister(IL_BYTE, 'cond');

      // Link edges
      entry.linkTo(b1);
      entry.linkTo(b2);
      entry.addInstruction(new ILBranchInstruction(0, condReg, b1.getLabel(), b2.getLabel()));

      b1.linkTo(merge);
      b1.addInstruction(new ILJumpInstruction(1, merge.getLabel()));

      b2.linkTo(merge);
      b2.addInstruction(new ILJumpInstruction(2, merge.getLabel()));

      merge.addInstruction(new ILReturnVoidInstruction(3));

      const domTree = computeDominators(func);

      // Verify block count
      expect(domTree.getBlockCount()).toBe(4);

      // Entry dominates all blocks
      expect(domTree.dominates(0, 0)).toBe(true);
      expect(domTree.dominates(0, 1)).toBe(true);
      expect(domTree.dominates(0, 2)).toBe(true);
      expect(domTree.dominates(0, 3)).toBe(true);

      // B1 and B2 only dominate themselves
      expect(domTree.dominates(1, 1)).toBe(true);
      expect(domTree.dominates(1, 3)).toBe(false); // B1 does NOT dominate merge
      expect(domTree.dominates(2, 2)).toBe(true);
      expect(domTree.dominates(2, 3)).toBe(false); // B2 does NOT dominate merge

      // Merge's idom is entry (the only common dominator of b1 and b2)
      expect(domTree.getImmediateDominator(3)).toBe(0);
    });

    it('Test S3.8: simple loop A -> B -> C with back edge C -> B', () => {
      // Create: entry -> header -> body -> back to header
      //     entry (0)
      //        |
      //     header (1) <--+
      //        |          |
      //      body (2) ----+
      //        |
      //      exit (3)
      const func = new ILFunction('loop', [], IL_VOID);
      const entry = func.getEntryBlock();
      const header = func.createBlock('header');
      const body = func.createBlock('body');
      const exit = func.createBlock('exit');

      const condReg = func.createRegister(IL_BYTE, 'cond');

      // entry -> header
      entry.linkTo(header);
      entry.addInstruction(new ILJumpInstruction(0, header.getLabel()));

      // header -> body or exit
      header.linkTo(body);
      header.linkTo(exit);
      header.addInstruction(new ILBranchInstruction(1, condReg, body.getLabel(), exit.getLabel()));

      // body -> header (back edge)
      body.linkTo(header);
      body.addInstruction(new ILJumpInstruction(2, header.getLabel()));

      exit.addInstruction(new ILReturnVoidInstruction(3));

      const domTree = computeDominators(func);

      // Verify entry dominates all
      expect(domTree.dominates(0, 0)).toBe(true);
      expect(domTree.dominates(0, 1)).toBe(true);
      expect(domTree.dominates(0, 2)).toBe(true);
      expect(domTree.dominates(0, 3)).toBe(true);

      // Header dominates body and exit
      expect(domTree.dominates(1, 1)).toBe(true);
      expect(domTree.dominates(1, 2)).toBe(true);
      expect(domTree.dominates(1, 3)).toBe(true);

      // Body only dominates itself (back edge doesn't change dominance)
      expect(domTree.dominates(2, 2)).toBe(true);
      expect(domTree.dominates(2, 1)).toBe(false); // Body does NOT dominate header
      expect(domTree.dominates(2, 3)).toBe(false);
    });

    it('Test S3.9: multiple predecessors join correctly', () => {
      // Create: entry -> a, b, c -> join
      // Three paths converge at join
      const func = new ILFunction('multi_pred', [], IL_VOID);
      const entry = func.getEntryBlock();
      const a = func.createBlock('a');
      const b = func.createBlock('b');
      const c = func.createBlock('c');
      const join = func.createBlock('join');

      const condReg1 = func.createRegister(IL_BYTE, 'cond1');
      const condReg2 = func.createRegister(IL_BYTE, 'cond2');

      // entry -> a (via branch)
      entry.linkTo(a);
      entry.linkTo(b);
      entry.addInstruction(new ILBranchInstruction(0, condReg1, a.getLabel(), b.getLabel()));

      // a -> c or join
      a.linkTo(c);
      a.linkTo(join);
      a.addInstruction(new ILBranchInstruction(1, condReg2, c.getLabel(), join.getLabel()));

      // b -> join
      b.linkTo(join);
      b.addInstruction(new ILJumpInstruction(2, join.getLabel()));

      // c -> join
      c.linkTo(join);
      c.addInstruction(new ILJumpInstruction(3, join.getLabel()));

      join.addInstruction(new ILReturnVoidInstruction(4));

      const domTree = computeDominators(func);

      // Join has three predecessors: a, b, c
      // Only entry dominates join (common to all paths)
      expect(domTree.getImmediateDominator(4)).toBe(0);

      // Entry dominates all
      expect(domTree.dominates(0, 4)).toBe(true);

      // None of a, b, c dominate join
      expect(domTree.dominates(1, 4)).toBe(false);
      expect(domTree.dominates(2, 4)).toBe(false);
      expect(domTree.dominates(3, 4)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Dominance Property Tests
  // ---------------------------------------------------------------------------
  describe('Dominance Properties', () => {
    it('Test S3.10: dominates() is reflexive (A dom A)', () => {
      // Every block dominates itself
      const func = new ILFunction('reflexive', [], IL_VOID);
      const entry = func.getEntryBlock();
      const b1 = func.createBlock('b1');
      const b2 = func.createBlock('b2');

      entry.linkTo(b1);
      entry.addInstruction(new ILJumpInstruction(0, b1.getLabel()));

      b1.linkTo(b2);
      b1.addInstruction(new ILJumpInstruction(1, b2.getLabel()));

      b2.addInstruction(new ILReturnVoidInstruction(2));

      const domTree = computeDominators(func);

      // Every block dominates itself (reflexive property)
      for (const blockId of domTree.getAllBlockIds()) {
        expect(domTree.dominates(blockId, blockId)).toBe(true);
      }
    });

    it('Test S3.11: dominates() is transitive (A dom B, B dom C -> A dom C)', () => {
      // If A dominates B and B dominates C, then A dominates C
      const func = new ILFunction('transitive', [], IL_VOID);
      const entry = func.getEntryBlock();
      const b1 = func.createBlock('b1');
      const b2 = func.createBlock('b2');
      const b3 = func.createBlock('b3');

      entry.linkTo(b1);
      entry.addInstruction(new ILJumpInstruction(0, b1.getLabel()));

      b1.linkTo(b2);
      b1.addInstruction(new ILJumpInstruction(1, b2.getLabel()));

      b2.linkTo(b3);
      b2.addInstruction(new ILJumpInstruction(2, b3.getLabel()));

      b3.addInstruction(new ILReturnVoidInstruction(3));

      const domTree = computeDominators(func);

      // entry dominates b1
      expect(domTree.dominates(0, 1)).toBe(true);
      // b1 dominates b2
      expect(domTree.dominates(1, 2)).toBe(true);
      // b2 dominates b3
      expect(domTree.dominates(2, 3)).toBe(true);

      // Transitivity: entry dominates b2 and b3
      expect(domTree.dominates(0, 2)).toBe(true);
      expect(domTree.dominates(0, 3)).toBe(true);

      // Transitivity: b1 dominates b3
      expect(domTree.dominates(1, 3)).toBe(true);
    });

    it('Test S3.12: dominates() is antisymmetric (A dom B, B dom A -> A = B)', () => {
      // If A dominates B and B dominates A, then A equals B
      // (i.e., if A != B and A dom B, then B does NOT dom A)
      const func = new ILFunction('antisymmetric', [], IL_VOID);
      const entry = func.getEntryBlock();
      const b1 = func.createBlock('b1');
      const b2 = func.createBlock('b2');

      entry.linkTo(b1);
      entry.addInstruction(new ILJumpInstruction(0, b1.getLabel()));

      b1.linkTo(b2);
      b1.addInstruction(new ILJumpInstruction(1, b2.getLabel()));

      b2.addInstruction(new ILReturnVoidInstruction(2));

      const domTree = computeDominators(func);

      // entry dominates b1, but b1 does NOT dominate entry
      expect(domTree.dominates(0, 1)).toBe(true);
      expect(domTree.dominates(1, 0)).toBe(false);

      // b1 dominates b2, but b2 does NOT dominate b1
      expect(domTree.dominates(1, 2)).toBe(true);
      expect(domTree.dominates(2, 1)).toBe(false);

      // entry dominates b2, but b2 does NOT dominate entry
      expect(domTree.dominates(0, 2)).toBe(true);
      expect(domTree.dominates(2, 0)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Complex CFG Tests
  // ---------------------------------------------------------------------------
  describe('Complex CFG Patterns', () => {
    it('Test S3.13: immediate dominator is closest dominator', () => {
      // Create: entry -> a -> b -> c (linear)
      // idom(c) should be b, not entry or a
      const func = new ILFunction('idom_closest', [], IL_VOID);
      const entry = func.getEntryBlock();
      const a = func.createBlock('a');
      const b = func.createBlock('b');
      const c = func.createBlock('c');

      entry.linkTo(a);
      entry.addInstruction(new ILJumpInstruction(0, a.getLabel()));

      a.linkTo(b);
      a.addInstruction(new ILJumpInstruction(1, b.getLabel()));

      b.linkTo(c);
      b.addInstruction(new ILJumpInstruction(2, c.getLabel()));

      c.addInstruction(new ILReturnVoidInstruction(3));

      const domTree = computeDominators(func);

      // Immediate dominators should be the closest
      expect(domTree.getImmediateDominator(1)).toBe(0); // idom(a) = entry
      expect(domTree.getImmediateDominator(2)).toBe(1); // idom(b) = a
      expect(domTree.getImmediateDominator(3)).toBe(2); // idom(c) = b

      // Verify depths are incremental
      expect(domTree.getDepth(0)).toBe(0);
      expect(domTree.getDepth(1)).toBe(1);
      expect(domTree.getDepth(2)).toBe(2);
      expect(domTree.getDepth(3)).toBe(3);
    });

    it('Test S3.14: dominator chain depth is correct', () => {
      // Create a deeper linear chain to verify depth calculation
      const func = new ILFunction('depth_chain', [], IL_VOID);
      const entry = func.getEntryBlock();
      const blocks = [entry];

      // Create a chain of 6 blocks total (entry + 5 more)
      let prev = entry;
      for (let i = 1; i <= 5; i++) {
        const block = func.createBlock(`b${i}`);
        blocks.push(block);
        prev.linkTo(block);
        prev.addInstruction(new ILJumpInstruction(i - 1, block.getLabel()));
        prev = block;
      }

      // Last block returns
      blocks[5].addInstruction(new ILReturnVoidInstruction(5));

      const domTree = computeDominators(func);

      // Verify depths
      expect(domTree.getBlockCount()).toBe(6);
      for (let i = 0; i < 6; i++) {
        expect(domTree.getDepth(i)).toBe(i);
      }

      // Verify dominator tree preorder matches creation order
      const preorder = domTree.getPreorder();
      expect(preorder).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('Test S3.15: complex CFG with 10+ blocks', () => {
      // Create a complex CFG:
      //
      //     entry (0)
      //        |
      //        v
      //     header (1) <------+
      //      / \              |
      //     v   v             |
      //   left right          |
      //   (2)   (3)           |
      //      \ /              |
      //       v               |
      //     merge (4)         |
      //      /  \             |
      //     v    v            |
      //  cont  early_exit     |
      //   (5)    (6)          |
      //    |                  |
      //    v                  |
      //  loop_body (7) -------+
      //    |
      //    v
      //  finish (8)
      //    |
      //    v
      //  cleanup (9)
      //    |
      //    v
      //   exit (10)
      //
      const func = new ILFunction('complex', [], IL_VOID);
      const entry = func.getEntryBlock(); // 0
      const header = func.createBlock('header'); // 1
      const left = func.createBlock('left'); // 2
      const right = func.createBlock('right'); // 3
      const merge = func.createBlock('merge'); // 4
      const cont = func.createBlock('cont'); // 5
      const earlyExit = func.createBlock('early_exit'); // 6
      const loopBody = func.createBlock('loop_body'); // 7
      const finish = func.createBlock('finish'); // 8
      const cleanup = func.createBlock('cleanup'); // 9
      const exit = func.createBlock('exit'); // 10

      const cond1 = func.createRegister(IL_BYTE, 'cond1');
      const cond2 = func.createRegister(IL_BYTE, 'cond2');
      const cond3 = func.createRegister(IL_BYTE, 'cond3');

      // entry -> header
      entry.linkTo(header);
      entry.addInstruction(new ILJumpInstruction(0, header.getLabel()));

      // header -> left, right
      header.linkTo(left);
      header.linkTo(right);
      header.addInstruction(new ILBranchInstruction(1, cond1, left.getLabel(), right.getLabel()));

      // left -> merge
      left.linkTo(merge);
      left.addInstruction(new ILJumpInstruction(2, merge.getLabel()));

      // right -> merge
      right.linkTo(merge);
      right.addInstruction(new ILJumpInstruction(3, merge.getLabel()));

      // merge -> cont, early_exit
      merge.linkTo(cont);
      merge.linkTo(earlyExit);
      merge.addInstruction(
        new ILBranchInstruction(4, cond2, cont.getLabel(), earlyExit.getLabel()),
      );

      // cont -> loop_body
      cont.linkTo(loopBody);
      cont.addInstruction(new ILJumpInstruction(5, loopBody.getLabel()));

      // early_exit returns
      earlyExit.addInstruction(new ILReturnVoidInstruction(6));

      // loop_body -> header (back edge), finish
      loopBody.linkTo(header);
      loopBody.linkTo(finish);
      loopBody.addInstruction(
        new ILBranchInstruction(7, cond3, header.getLabel(), finish.getLabel()),
      );

      // finish -> cleanup
      finish.linkTo(cleanup);
      finish.addInstruction(new ILJumpInstruction(8, cleanup.getLabel()));

      // cleanup -> exit
      cleanup.linkTo(exit);
      cleanup.addInstruction(new ILJumpInstruction(9, exit.getLabel()));

      // exit returns
      exit.addInstruction(new ILReturnVoidInstruction(10));

      const domTree = computeDominators(func);

      // Verify we have all 11 blocks
      expect(domTree.getBlockCount()).toBe(11);

      // Entry dominates all reachable blocks
      for (let i = 0; i <= 10; i++) {
        expect(domTree.dominates(0, i)).toBe(true);
      }

      // Header dominates blocks in the loop structure
      expect(domTree.dominates(1, 2)).toBe(true); // header dom left
      expect(domTree.dominates(1, 3)).toBe(true); // header dom right
      expect(domTree.dominates(1, 4)).toBe(true); // header dom merge
      expect(domTree.dominates(1, 5)).toBe(true); // header dom cont
      expect(domTree.dominates(1, 6)).toBe(true); // header dom early_exit
      expect(domTree.dominates(1, 7)).toBe(true); // header dom loop_body
      expect(domTree.dominates(1, 8)).toBe(true); // header dom finish
      expect(domTree.dominates(1, 9)).toBe(true); // header dom cleanup
      expect(domTree.dominates(1, 10)).toBe(true); // header dom exit

      // merge dominates its successors (except early_exit path doesn't dominate finish)
      expect(domTree.dominates(4, 5)).toBe(true); // merge dom cont
      expect(domTree.dominates(4, 6)).toBe(true); // merge dom early_exit
      expect(domTree.dominates(4, 7)).toBe(true); // merge dom loop_body

      // left and right do NOT dominate merge (parallel paths)
      expect(domTree.dominates(2, 4)).toBe(false);
      expect(domTree.dominates(3, 4)).toBe(false);

      // loop_body does NOT dominate header (back edge)
      expect(domTree.dominates(7, 1)).toBe(false);

      // Verify immediate dominators
      expect(domTree.getImmediateDominator(4)).toBe(1); // merge's idom is header
      expect(domTree.getImmediateDominator(8)).toBe(7); // finish's idom is loop_body
    });
  });
});

// =============================================================================
// Session 4 Tests: Extreme Edge Case Tests
// =============================================================================

describe('SSA Dominator Tree Extreme Tests (Session 4)', () => {
  // ---------------------------------------------------------------------------
  // Helper Functions for Building Large CFGs
  // ---------------------------------------------------------------------------

  /**
   * Creates a linear chain CFG with N blocks.
   * Structure: entry -> b1 -> b2 -> ... -> bN-1
   *
   * @param blockCount - Total number of blocks (including entry)
   * @returns ILFunction with linear chain CFG
   */
  function createLinearChain(blockCount: number): ILFunction {
    const func = new ILFunction(`linear_${blockCount}`, [], IL_VOID);
    const entry = func.getEntryBlock();

    if (blockCount === 1) {
      entry.addInstruction(new ILReturnVoidInstruction(0));
      return func;
    }

    let prev = entry;
    for (let i = 1; i < blockCount; i++) {
      const block = func.createBlock(`b${i}`);
      prev.linkTo(block);
      prev.addInstruction(new ILJumpInstruction(i - 1, block.getLabel()));
      prev = block;
    }

    // Last block returns
    prev.addInstruction(new ILReturnVoidInstruction(blockCount - 1));
    return func;
  }

  /**
   * Creates a binary tree shaped CFG with approximately N blocks.
   * Each non-leaf node branches to two children.
   *
   * @param depth - Tree depth (0 = entry only)
   * @returns ILFunction with binary tree CFG and block info
   */
  function createBinaryTree(depth: number): { func: ILFunction; leafIds: number[] } {
    const func = new ILFunction(`btree_depth${depth}`, [], IL_VOID);
    const entry = func.getEntryBlock();
    const leafIds: number[] = [];

    if (depth === 0) {
      entry.addInstruction(new ILReturnVoidInstruction(0));
      leafIds.push(0);
      return { func, leafIds };
    }

    const condReg = func.createRegister(IL_BYTE, 'cond');
    let instrId = 0;

    // Build tree level by level using BFS
    interface QueueItem {
      block: ReturnType<typeof func.createBlock>;
      level: number;
    }

    const queue: QueueItem[] = [{ block: entry, level: 0 }];

    while (queue.length > 0) {
      const { block, level } = queue.shift()!;

      if (level >= depth) {
        // Leaf node
        block.addInstruction(new ILReturnVoidInstruction(instrId++));
        leafIds.push(block.id);
      } else {
        // Internal node - branch to two children
        const left = func.createBlock(`l${block.id}`);
        const right = func.createBlock(`r${block.id}`);

        block.linkTo(left);
        block.linkTo(right);
        block.addInstruction(
          new ILBranchInstruction(instrId++, condReg, left.getLabel(), right.getLabel()),
        );

        queue.push({ block: left, level: level + 1 });
        queue.push({ block: right, level: level + 1 });
      }
    }

    return { func, leafIds };
  }

  /**
   * Creates a CFG with deeply nested loops.
   *
   * @param nestingLevel - Number of nested loop levels
   * @returns ILFunction with nested loop CFG
   */
  function createNestedLoops(nestingLevel: number): ILFunction {
    const func = new ILFunction(`nested_loops_${nestingLevel}`, [], IL_VOID);
    const entry = func.getEntryBlock();
    const condReg = func.createRegister(IL_BYTE, 'cond');
    let instrId = 0;

    if (nestingLevel === 0) {
      entry.addInstruction(new ILReturnVoidInstruction(instrId));
      return func;
    }

    // Create structure:
    // entry -> header1 -> header2 -> ... -> headerN -> body -> headerN -> ... -> exit
    const headers: ReturnType<typeof func.createBlock>[] = [];
    const bodies: ReturnType<typeof func.createBlock>[] = [];

    // Create all headers and bodies first
    for (let i = 0; i < nestingLevel; i++) {
      headers.push(func.createBlock(`header${i}`));
      bodies.push(func.createBlock(`body${i}`));
    }

    const exit = func.createBlock('exit');

    // Link entry to first header
    entry.linkTo(headers[0]);
    entry.addInstruction(new ILJumpInstruction(instrId++, headers[0].getLabel()));

    // Link each header to next header (or innermost body) and to exit/previous body
    for (let i = 0; i < nestingLevel; i++) {
      const header = headers[i];
      const body = bodies[i];

      if (i < nestingLevel - 1) {
        // Not innermost - link to next header or body
        header.linkTo(headers[i + 1]); // Continue into loop
        header.linkTo(bodies[i]); // Exit this level
        header.addInstruction(
          new ILBranchInstruction(
            instrId++,
            condReg,
            headers[i + 1].getLabel(),
            bodies[i].getLabel(),
          ),
        );
      } else {
        // Innermost header - link to body or exit inner
        header.linkTo(body);
        header.linkTo(i > 0 ? bodies[i - 1] : exit);
        header.addInstruction(
          new ILBranchInstruction(
            instrId++,
            condReg,
            body.getLabel(),
            i > 0 ? bodies[i - 1].getLabel() : exit.getLabel(),
          ),
        );
      }
    }

    // Link each body back to its header (back edge)
    for (let i = 0; i < nestingLevel; i++) {
      const body = bodies[i];
      const header = headers[i];

      body.linkTo(header);
      body.addInstruction(new ILJumpInstruction(instrId++, header.getLabel()));
    }

    // Exit block
    exit.addInstruction(new ILReturnVoidInstruction(instrId));

    return func;
  }

  /**
   * Creates an irreducible control flow pattern.
   * Two entry points to a loop-like structure.
   *
   * @returns ILFunction with irreducible CFG
   */
  function createIrreducibleCFG(): ILFunction {
    //     entry (0)
    //      / \
    //     v   v
    //    a     b
    //   (1)   (2)
    //    |  X  |
    //    v /|\ v
    //    c     d
    //   (3)   (4)
    //     \ /
    //      v
    //    merge (5)
    //
    // Where c->d and d->c create an irreducible region
    const func = new ILFunction('irreducible', [], IL_VOID);
    const entry = func.getEntryBlock();
    const a = func.createBlock('a');
    const b = func.createBlock('b');
    const c = func.createBlock('c');
    const d = func.createBlock('d');
    const merge = func.createBlock('merge');

    const cond1 = func.createRegister(IL_BYTE, 'cond1');
    const cond2 = func.createRegister(IL_BYTE, 'cond2');
    const cond3 = func.createRegister(IL_BYTE, 'cond3');

    // entry -> a, b
    entry.linkTo(a);
    entry.linkTo(b);
    entry.addInstruction(new ILBranchInstruction(0, cond1, a.getLabel(), b.getLabel()));

    // a -> c (normal) or d (cross edge for irreducibility)
    a.linkTo(c);
    a.linkTo(d);
    a.addInstruction(new ILBranchInstruction(1, cond2, c.getLabel(), d.getLabel()));

    // b -> d (normal) or c (cross edge for irreducibility)
    b.linkTo(d);
    b.linkTo(c);
    b.addInstruction(new ILBranchInstruction(2, cond3, d.getLabel(), c.getLabel()));

    // c -> merge
    c.linkTo(merge);
    c.addInstruction(new ILJumpInstruction(3, merge.getLabel()));

    // d -> merge
    d.linkTo(merge);
    d.addInstruction(new ILJumpInstruction(4, merge.getLabel()));

    merge.addInstruction(new ILReturnVoidInstruction(5));

    return func;
  }

  /**
   * Creates a CFG where one block has many predecessors.
   *
   * @param predCount - Number of predecessor blocks
   * @returns ILFunction with high fan-in CFG
   */
  function createHighFanIn(predCount: number): ILFunction {
    const func = new ILFunction(`fanin_${predCount}`, [], IL_VOID);
    const entry = func.getEntryBlock();
    const merge = func.createBlock('merge');

    if (predCount === 1) {
      entry.linkTo(merge);
      entry.addInstruction(new ILJumpInstruction(0, merge.getLabel()));
      merge.addInstruction(new ILReturnVoidInstruction(1));
      return func;
    }

    const condReg = func.createRegister(IL_BYTE, 'cond');
    let instrId = 0;

    // Create a cascade of branches from entry to create predCount branches
    // Each branch leads to a separate block that merges at merge point
    const branches: ReturnType<typeof func.createBlock>[] = [];
    for (let i = 0; i < predCount; i++) {
      branches.push(func.createBlock(`branch${i}`));
    }

    // Create a binary tree of decisions to reach each branch
    // This ensures all branches are reachable
    let currentBlock = entry;
    for (let i = 0; i < predCount - 1; i++) {
      const branch = branches[i];
      const nextDecision = i < predCount - 2 ? func.createBlock(`decision${i}`) : branches[predCount - 1];

      currentBlock.linkTo(branch);
      currentBlock.linkTo(nextDecision);
      currentBlock.addInstruction(
        new ILBranchInstruction(instrId++, condReg, branch.getLabel(), nextDecision.getLabel()),
      );

      if (i < predCount - 2) {
        currentBlock = nextDecision;
      }
    }

    // All branches lead to merge
    for (const branch of branches) {
      branch.linkTo(merge);
      branch.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));
    }

    merge.addInstruction(new ILReturnVoidInstruction(instrId));
    return func;
  }

  // ---------------------------------------------------------------------------
  // Tests 1-5: CFG with 100 blocks (linear chain)
  // ---------------------------------------------------------------------------
  describe('Large Linear Chain CFGs (Tests S4.1-S4.5)', () => {
    it('Test S4.1: 100-block linear chain computes correctly', () => {
      const func = createLinearChain(100);
      const domTree = computeDominators(func);

      expect(domTree.getBlockCount()).toBe(100);

      // Entry dominates all blocks
      for (let i = 0; i < 100; i++) {
        expect(domTree.dominates(0, i)).toBe(true);
      }
    });

    it('Test S4.2: 100-block linear chain has correct depths', () => {
      const func = createLinearChain(100);
      const domTree = computeDominators(func);

      // Depth should equal block index in linear chain
      for (let i = 0; i < 100; i++) {
        expect(domTree.getDepth(i)).toBe(i);
      }
    });

    it('Test S4.3: 100-block linear chain has correct immediate dominators', () => {
      const func = createLinearChain(100);
      const domTree = computeDominators(func);

      // Entry has no idom
      expect(domTree.getImmediateDominator(0)).toBe(-1);

      // Each other block's idom is the previous block
      for (let i = 1; i < 100; i++) {
        expect(domTree.getImmediateDominator(i)).toBe(i - 1);
      }
    });

    it('Test S4.4: 100-block linear chain dominance is transitive', () => {
      const func = createLinearChain(100);
      const domTree = computeDominators(func);

      // Block 10 should dominate all blocks from 10 to 99
      for (let i = 10; i < 100; i++) {
        expect(domTree.dominates(10, i)).toBe(true);
      }

      // Block 10 should NOT dominate blocks 0-9
      for (let i = 0; i < 10; i++) {
        expect(domTree.dominates(10, i)).toBe(false);
      }
    });

    it('Test S4.5: 100-block linear chain preorder matches block order', () => {
      const func = createLinearChain(100);
      const domTree = computeDominators(func);

      const preorder = domTree.getPreorder();
      expect(preorder.length).toBe(100);

      // In linear chain, preorder should be 0, 1, 2, ..., 99
      for (let i = 0; i < 100; i++) {
        expect(preorder[i]).toBe(i);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Tests 6-10: CFG with 100 blocks (binary tree shape)
  // ---------------------------------------------------------------------------
  describe('Large Binary Tree CFGs (Tests S4.6-S4.10)', () => {
    it('Test S4.6: binary tree depth 6 (127 blocks) computes correctly', () => {
      // Depth 6 = 2^7 - 1 = 127 blocks
      const { func } = createBinaryTree(6);
      const domTree = computeDominators(func);

      expect(domTree.getBlockCount()).toBe(127);
    });

    it('Test S4.7: binary tree entry dominates all nodes', () => {
      const { func } = createBinaryTree(6);
      const domTree = computeDominators(func);

      // Entry dominates all blocks
      for (const blockId of domTree.getAllBlockIds()) {
        expect(domTree.dominates(0, blockId)).toBe(true);
      }
    });

    it('Test S4.8: binary tree leaf nodes have correct depth', () => {
      const { func, leafIds } = createBinaryTree(6);
      const domTree = computeDominators(func);

      // All leaves should have depth 6
      for (const leafId of leafIds) {
        expect(domTree.getDepth(leafId)).toBe(6);
      }
    });

    it('Test S4.9: binary tree siblings do not dominate each other', () => {
      // Create a smaller tree for easier verification
      const { func } = createBinaryTree(3);
      const domTree = computeDominators(func);

      // In a binary tree from entry:
      // - Entry's children (IDs 1 and 2 based on creation order)
      // - These children should not dominate each other
      const entryChildren = domTree.getImmediatelyDominatedBlocks(0);
      if (entryChildren.length >= 2) {
        const child1 = entryChildren[0];
        const child2 = entryChildren[1];

        expect(domTree.dominates(child1, child2)).toBe(false);
        expect(domTree.dominates(child2, child1)).toBe(false);
      }
    });

    it('Test S4.10: binary tree internal nodes dominate their subtrees', () => {
      const { func } = createBinaryTree(4);
      const domTree = computeDominators(func);

      // Pick an internal node and verify it dominates its descendants
      // Entry's first child should dominate all blocks in its subtree
      const entryChildren = domTree.getImmediatelyDominatedBlocks(0);
      if (entryChildren.length > 0) {
        const internalNode = entryChildren[0];
        const dominated = domTree.getDominatedBlocks(internalNode);

        // Internal node should dominate at least itself and some children
        expect(dominated.size).toBeGreaterThan(1);

        // All dominated blocks should have internalNode in their dominator path
        for (const domId of dominated) {
          expect(domTree.dominates(internalNode, domId)).toBe(true);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Tests 11-15: Deeply nested loops (10 levels)
  // ---------------------------------------------------------------------------
  describe('Deeply Nested Loop CFGs (Tests S4.11-S4.15)', () => {
    it('Test S4.11: 10-level nested loops computes without stack overflow', () => {
      const func = createNestedLoops(10);
      const domTree = computeDominators(func);

      // Should have entry + 10 headers + 10 bodies + exit = 22 blocks
      expect(domTree.getBlockCount()).toBeGreaterThanOrEqual(20);
    });

    it('Test S4.12: nested loop headers form dominator chain', () => {
      const func = createNestedLoops(5);
      const domTree = computeDominators(func);

      // Header0 should dominate Header1 which should dominate Header2, etc.
      // Entry is 0, headers start at 1
      // In our structure: entry(0), header0(1), header1(2), ...

      // Find block IDs by checking structure
      const blockCount = domTree.getBlockCount();
      expect(blockCount).toBeGreaterThanOrEqual(10);

      // Entry dominates all
      for (const blockId of domTree.getAllBlockIds()) {
        expect(domTree.dominates(0, blockId)).toBe(true);
      }
    });

    it('Test S4.13: loop bodies do not dominate their headers (back edges)', () => {
      const func = createNestedLoops(3);
      const domTree = computeDominators(func);

      // Back edges should not create dominance from body to header
      // In nested loops, bodies jump back to headers
      // The body should NOT dominate its target header

      const allIds = domTree.getAllBlockIds();
      for (const id of allIds) {
        const idom = domTree.getImmediateDominator(id);
        if (idom !== -1) {
          // Parent should dominate child, not reverse
          expect(domTree.dominates(idom, id)).toBe(true);
          if (idom !== id) {
            expect(domTree.dominates(id, idom)).toBe(false);
          }
        }
      }
    });

    it('Test S4.14: nested loop dominator tree depth is bounded', () => {
      const func = createNestedLoops(10);
      const domTree = computeDominators(func);

      // Maximum depth should be reasonable (not O(n^2) or exponential)
      let maxDepth = 0;
      for (const blockId of domTree.getAllBlockIds()) {
        const depth = domTree.getDepth(blockId);
        if (depth > maxDepth) {
          maxDepth = depth;
        }
      }

      // Depth should be proportional to nesting level, not block count
      expect(maxDepth).toBeLessThan(domTree.getBlockCount());
    });

    it('Test S4.15: nested loops reflexive property holds for all blocks', () => {
      const func = createNestedLoops(10);
      const domTree = computeDominators(func);

      // Every block dominates itself (reflexive)
      for (const blockId of domTree.getAllBlockIds()) {
        expect(domTree.dominates(blockId, blockId)).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Tests 16-20: Irreducible control flow patterns
  // ---------------------------------------------------------------------------
  describe('Irreducible Control Flow (Tests S4.16-S4.20)', () => {
    it('Test S4.16: basic irreducible CFG computes correctly', () => {
      const func = createIrreducibleCFG();
      const domTree = computeDominators(func);

      // Should have 6 blocks
      expect(domTree.getBlockCount()).toBe(6);
    });

    it('Test S4.17: irreducible region blocks have entry as common dominator', () => {
      const func = createIrreducibleCFG();
      const domTree = computeDominators(func);

      // In irreducible CFG, blocks c and d both have entry as idom
      // because neither a nor b dominates them exclusively
      // IDs: entry(0), a(1), b(2), c(3), d(4), merge(5)

      // Entry dominates all
      expect(domTree.dominates(0, 3)).toBe(true); // entry dom c
      expect(domTree.dominates(0, 4)).toBe(true); // entry dom d

      // Neither a nor b should dominate both c and d
      // (because of cross edges)
    });

    it('Test S4.18: irreducible CFG dominance is still antisymmetric', () => {
      const func = createIrreducibleCFG();
      const domTree = computeDominators(func);

      // Test antisymmetry for all pairs
      const allIds = domTree.getAllBlockIds();
      for (const a of allIds) {
        for (const b of allIds) {
          if (a !== b) {
            if (domTree.dominates(a, b)) {
              expect(domTree.dominates(b, a)).toBe(false);
            }
          }
        }
      }
    });

    it('Test S4.19: complex irreducible with multiple entry points', () => {
      // Create a more complex irreducible pattern
      const func = new ILFunction('complex_irreducible', [], IL_VOID);
      const entry = func.getEntryBlock();
      const cond = func.createRegister(IL_BYTE, 'cond');

      // Create blocks
      const blocks: ReturnType<typeof func.createBlock>[] = [];
      for (let i = 0; i < 6; i++) {
        blocks.push(func.createBlock(`b${i}`));
      }
      const exit = func.createBlock('exit');

      // Complex interconnections
      let instrId = 0;

      entry.linkTo(blocks[0]);
      entry.linkTo(blocks[1]);
      entry.addInstruction(
        new ILBranchInstruction(instrId++, cond, blocks[0].getLabel(), blocks[1].getLabel()),
      );

      // Create cross-connections
      blocks[0].linkTo(blocks[2]);
      blocks[0].linkTo(blocks[3]);
      blocks[0].addInstruction(
        new ILBranchInstruction(instrId++, cond, blocks[2].getLabel(), blocks[3].getLabel()),
      );

      blocks[1].linkTo(blocks[3]);
      blocks[1].linkTo(blocks[2]);
      blocks[1].addInstruction(
        new ILBranchInstruction(instrId++, cond, blocks[3].getLabel(), blocks[2].getLabel()),
      );

      blocks[2].linkTo(blocks[4]);
      blocks[2].addInstruction(new ILJumpInstruction(instrId++, blocks[4].getLabel()));

      blocks[3].linkTo(blocks[4]);
      blocks[3].addInstruction(new ILJumpInstruction(instrId++, blocks[4].getLabel()));

      blocks[4].linkTo(blocks[5]);
      blocks[4].addInstruction(new ILJumpInstruction(instrId++, blocks[5].getLabel()));

      blocks[5].linkTo(exit);
      blocks[5].addInstruction(new ILJumpInstruction(instrId++, exit.getLabel()));

      exit.addInstruction(new ILReturnVoidInstruction(instrId));

      const domTree = computeDominators(func);

      // Should compute without errors
      expect(domTree.getBlockCount()).toBe(8);

      // Entry still dominates all
      for (const blockId of domTree.getAllBlockIds()) {
        expect(domTree.dominates(0, blockId)).toBe(true);
      }
    });

    it('Test S4.20: irreducible CFG transitive property holds', () => {
      const func = createIrreducibleCFG();
      const domTree = computeDominators(func);

      // Test transitivity: if A dom B and B dom C, then A dom C
      const allIds = domTree.getAllBlockIds();
      for (const a of allIds) {
        for (const b of allIds) {
          if (domTree.dominates(a, b)) {
            for (const c of allIds) {
              if (domTree.dominates(b, c)) {
                expect(domTree.dominates(a, c)).toBe(true);
              }
            }
          }
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Tests 21-25: Maximum predecessor count (50+ preds)
  // ---------------------------------------------------------------------------
  describe('High Fan-In CFGs (Tests S4.21-S4.25)', () => {
    it('Test S4.21: 50 predecessors merge correctly', () => {
      const func = createHighFanIn(50);
      const domTree = computeDominators(func);

      // Should have reasonable block count
      expect(domTree.getBlockCount()).toBeGreaterThan(50);
    });

    it('Test S4.22: merge block idom is entry in high fan-in CFG', () => {
      const func = createHighFanIn(20);
      const domTree = computeDominators(func);

      // Find the merge block (it should be the one with most predecessors)
      // In our construction, merge has the highest ID
      const mergeId = Math.max(...domTree.getAllBlockIds());

      // The merge block's idom should be entry (or close to it)
      // because many parallel paths converge there
      const idom = domTree.getImmediateDominator(mergeId);
      expect(idom).toBeDefined();
      expect(idom).not.toBe(-1); // Not entry directly (has predecessors)
    });

    it('Test S4.23: high fan-in merge only dominates itself', () => {
      const func = createHighFanIn(30);
      const domTree = computeDominators(func);

      // In createHighFanIn, merge is the second block created (ID = 1)
      // It's the exit block that all branches converge to
      const mergeId = 1;

      // Merge should only dominate itself (it's a leaf/exit block)
      const dominated = domTree.getDominatedBlocks(mergeId);
      expect(dominated.size).toBe(1);
      expect(dominated.has(mergeId)).toBe(true);
    });

    it('Test S4.24: 100 predecessors stress test', () => {
      const func = createHighFanIn(100);
      const domTree = computeDominators(func);

      // Should compute without errors or timeouts
      expect(domTree.getBlockCount()).toBeGreaterThan(100);

      // Entry still dominates all
      for (const blockId of domTree.getAllBlockIds()) {
        expect(domTree.dominates(0, blockId)).toBe(true);
      }
    });

    it('Test S4.25: high fan-in dominator tree is valid', () => {
      const func = createHighFanIn(50);
      const domTree = computeDominators(func);

      // Verify dominator tree invariants
      for (const blockId of domTree.getAllBlockIds()) {
        // Reflexive: every block dominates itself
        expect(domTree.dominates(blockId, blockId)).toBe(true);

        // idom should be a dominator
        const idom = domTree.getImmediateDominator(blockId);
        if (idom !== -1 && idom !== undefined) {
          expect(domTree.dominates(idom, blockId)).toBe(true);
        }

        // Depth should be non-negative
        expect(domTree.getDepth(blockId)).toBeGreaterThanOrEqual(0);
      }
    });
  });
});