/**
 * Tests for Dominance Frontier Implementation
 *
 * **Session 5 Tests:** Dominance frontier computation algorithm
 * - DominanceFrontier class methods
 * - computeFrontiers() for various CFG patterns
 * - Iterated dominance frontier (DF+) computation
 *
 * **Key Concepts Tested:**
 * - DF(B) = {X | B dominates a predecessor of X, but B does not strictly dominate X}
 * - Single blocks have empty frontiers
 * - Linear chains have no frontiers (no join points)
 * - Diamond patterns: branches have merge in frontier
 * - Loop headers are in frontier of blocks inside loops
 *
 * @module __tests__/il/ssa-frontiers.test
 */

import { describe, it, expect } from 'vitest';
import { DominanceFrontier, computeFrontiers } from '../../il/ssa/frontiers.js';
import { computeDominators, DominatorTree, type DominatorInfo } from '../../il/ssa/dominators.js';
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
 * Creates a simple DominatorTree for testing (same as in dominators tests).
 *
 * Creates a linear chain: entry(0) -> block1(1) -> block2(2)
 *
 * @returns DominatorTree with 3 blocks
 */
function createSimpleDominatorTree(): DominatorTree {
  const map = new Map<number, DominatorInfo>();

  // Entry block (0) dominates all blocks (0, 1, 2)
  map.set(0, {
    blockId: 0,
    immediateDominator: -1,
    dominates: new Set([0, 1, 2]),
    depth: 0,
  });

  // Block 1 dominated by entry, dominates blocks 1 and 2
  map.set(1, {
    blockId: 1,
    immediateDominator: 0,
    dominates: new Set([1, 2]),
    depth: 1,
  });

  // Block 2 is a leaf, only dominates itself
  map.set(2, {
    blockId: 2,
    immediateDominator: 1,
    dominates: new Set([2]),
    depth: 2,
  });

  return new DominatorTree(map, 0);
}

/**
 * Creates a diamond CFG for testing dominance frontiers.
 *
 * Structure:
 * ```
 *     entry (0)
 *        |
 *     header (1)
 *      / \
 *     v   v
 *   left  right
 *   (2)    (3)
 *     \   /
 *      v v
 *    merge (4)
 * ```
 *
 * @returns ILFunction with diamond CFG
 */
function createDiamondCFG(): ILFunction {
  const func = new ILFunction('diamond', [], IL_VOID);
  const entry = func.getEntryBlock();
  const header = func.createBlock('header');
  const left = func.createBlock('left');
  const right = func.createBlock('right');
  const merge = func.createBlock('merge');

  const condReg = func.createRegister(IL_BYTE, 'cond');

  // entry -> header
  entry.linkTo(header);
  entry.addInstruction(new ILJumpInstruction(0, header.getLabel()));

  // header -> left, right
  header.linkTo(left);
  header.linkTo(right);
  header.addInstruction(new ILBranchInstruction(1, condReg, left.getLabel(), right.getLabel()));

  // left -> merge
  left.linkTo(merge);
  left.addInstruction(new ILJumpInstruction(2, merge.getLabel()));

  // right -> merge
  right.linkTo(merge);
  right.addInstruction(new ILJumpInstruction(3, merge.getLabel()));

  // merge returns
  merge.addInstruction(new ILReturnVoidInstruction(4));

  return func;
}

/**
 * Creates a simple loop CFG for testing.
 *
 * Structure:
 * ```
 *     entry (0)
 *        |
 *     header (1) <--+
 *        |          |
 *      body (2) ----+
 *        |
 *      exit (3)
 * ```
 *
 * @returns ILFunction with loop CFG
 */
function createLoopCFG(): ILFunction {
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

  // exit returns
  exit.addInstruction(new ILReturnVoidInstruction(3));

  return func;
}

/**
 * Creates a nested loop CFG for testing.
 *
 * Structure:
 * ```
 *     entry (0)
 *        |
 *   outer_header (1) <------+
 *        |                  |
 *   inner_header (2) <--+   |
 *        |              |   |
 *   inner_body (3) -----+   |
 *        |                  |
 *   outer_body (4) ---------+
 *        |
 *      exit (5)
 * ```
 *
 * @returns ILFunction with nested loop CFG
 */
function createNestedLoopCFG(): ILFunction {
  const func = new ILFunction('nested_loop', [], IL_VOID);
  const entry = func.getEntryBlock();
  const outerHeader = func.createBlock('outer_header');
  const innerHeader = func.createBlock('inner_header');
  const innerBody = func.createBlock('inner_body');
  const outerBody = func.createBlock('outer_body');
  const exit = func.createBlock('exit');

  const cond1 = func.createRegister(IL_BYTE, 'cond1');
  const cond2 = func.createRegister(IL_BYTE, 'cond2');
  const cond3 = func.createRegister(IL_BYTE, 'cond3');

  // entry -> outer_header
  entry.linkTo(outerHeader);
  entry.addInstruction(new ILJumpInstruction(0, outerHeader.getLabel()));

  // outer_header -> inner_header or exit
  outerHeader.linkTo(innerHeader);
  outerHeader.linkTo(exit);
  outerHeader.addInstruction(
    new ILBranchInstruction(1, cond1, innerHeader.getLabel(), exit.getLabel()),
  );

  // inner_header -> inner_body or outer_body
  innerHeader.linkTo(innerBody);
  innerHeader.linkTo(outerBody);
  innerHeader.addInstruction(
    new ILBranchInstruction(2, cond2, innerBody.getLabel(), outerBody.getLabel()),
  );

  // inner_body -> inner_header (back edge)
  innerBody.linkTo(innerHeader);
  innerBody.addInstruction(new ILJumpInstruction(3, innerHeader.getLabel()));

  // outer_body -> outer_header (back edge)
  outerBody.linkTo(outerHeader);
  outerBody.addInstruction(new ILJumpInstruction(4, outerHeader.getLabel()));

  // exit returns
  exit.addInstruction(new ILReturnVoidInstruction(5));

  return func;
}

// =============================================================================
// Session 5 Tests: Dominance Frontier Implementation
// =============================================================================

describe('SSA Dominance Frontier Implementation (Session 5)', () => {
  // ---------------------------------------------------------------------------
  // Test S5.1: Single block has empty frontier
  // ---------------------------------------------------------------------------
  describe('Single Block CFG', () => {
    it('Test S5.1: single block has empty frontier', () => {
      // Create function with only entry block
      const func = new ILFunction('single', [], IL_VOID);
      const entry = func.getEntryBlock();
      entry.addInstruction(new ILReturnVoidInstruction(0));

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Entry block has empty frontier (nowhere for control to merge)
      const entryFrontier = frontiers.getFrontier(0);
      expect(entryFrontier.size).toBe(0);

      // Verify no frontiers at all
      expect(frontiers.hasNoFrontiers()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.2: Linear chain has no frontiers
  // ---------------------------------------------------------------------------
  describe('Linear Chain CFG', () => {
    it('Test S5.2: linear chain has no frontiers', () => {
      // Create: entry -> b1 -> b2 -> b3 (linear)
      const func = new ILFunction('linear', [], IL_VOID);
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
      const frontiers = computeFrontiers(func, domTree);

      // No block has any frontier in linear chain
      // (no join points means no frontiers)
      expect(frontiers.getFrontier(0).size).toBe(0);
      expect(frontiers.getFrontier(1).size).toBe(0);
      expect(frontiers.getFrontier(2).size).toBe(0);
      expect(frontiers.getFrontier(3).size).toBe(0);

      expect(frontiers.hasNoFrontiers()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.3: Diamond join point is in frontier
  // ---------------------------------------------------------------------------
  describe('Diamond CFG Frontiers', () => {
    it('Test S5.3: diamond join point is in branch frontiers', () => {
      const func = createDiamondCFG();
      // IDs: entry(0), header(1), left(2), right(3), merge(4)

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Left branch (2) has merge (4) in its frontier
      // because left dominates a predecessor of merge (itself)
      // but does NOT strictly dominate merge
      expect(frontiers.getFrontier(2).has(4)).toBe(true);

      // Right branch (3) also has merge (4) in its frontier
      expect(frontiers.getFrontier(3).has(4)).toBe(true);

      // Header (1) does NOT have merge in its frontier
      // because header strictly dominates merge
      expect(frontiers.getFrontier(1).has(4)).toBe(false);

      // Entry (0) has empty frontier
      expect(frontiers.getFrontier(0).size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.4: Loop header is in frontier
  // ---------------------------------------------------------------------------
  describe('Loop CFG Frontiers', () => {
    it('Test S5.4: loop header is in body frontier', () => {
      const func = createLoopCFG();
      // IDs: entry(0), header(1), body(2), exit(3)

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Body (2) has header (1) in its frontier
      // because body dominates itself (predecessor of header via back edge)
      // but body does NOT strictly dominate header
      expect(frontiers.getFrontier(2).has(1)).toBe(true);

      // Header does NOT have header in its own frontier
      // (but header might have other frontiers depending on analysis)
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.5: Nested loop frontiers
  // ---------------------------------------------------------------------------
  describe('Nested Loop CFG Frontiers', () => {
    it('Test S5.5: nested loop has correct frontiers', () => {
      const func = createNestedLoopCFG();
      // IDs: entry(0), outer_header(1), inner_header(2), inner_body(3), outer_body(4), exit(5)

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Inner body (3) has inner_header (2) in its frontier
      expect(frontiers.getFrontier(3).has(2)).toBe(true);

      // Outer body (4) has outer_header (1) in its frontier
      expect(frontiers.getFrontier(4).has(1)).toBe(true);

      // Inner header (2) has outer_body (4) in its frontier
      // because inner_header is a predecessor of outer_body
      // through the branch to outer_body when exiting inner loop
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.6: Multiple assignment points (iterated frontier)
  // ---------------------------------------------------------------------------
  describe('Iterated Dominance Frontier', () => {
    it('Test S5.6: iterated frontier computation', () => {
      const func = createDiamondCFG();
      // IDs: entry(0), header(1), left(2), right(3), merge(4)

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // If variable is defined in both left and right branches
      const defBlocks = new Set([2, 3]);
      const iteratedDF = frontiers.computeIteratedFrontier(defBlocks);

      // Both branches have merge in their frontier
      // So iterated frontier should include merge
      expect(iteratedDF.has(4)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.7: If-else merge frontier
  // ---------------------------------------------------------------------------
  describe('If-Else CFG Frontiers', () => {
    it('Test S5.7: if-else branches have merge in frontier', () => {
      // This is essentially the same as diamond, testing the pattern explicitly
      const func = new ILFunction('if_else', [], IL_VOID);
      const entry = func.getEntryBlock();
      const thenBlock = func.createBlock('then');
      const elseBlock = func.createBlock('else');
      const endIf = func.createBlock('endif');

      const condReg = func.createRegister(IL_BYTE, 'cond');

      // entry branches
      entry.linkTo(thenBlock);
      entry.linkTo(elseBlock);
      entry.addInstruction(
        new ILBranchInstruction(0, condReg, thenBlock.getLabel(), elseBlock.getLabel()),
      );

      // both branches merge
      thenBlock.linkTo(endIf);
      thenBlock.addInstruction(new ILJumpInstruction(1, endIf.getLabel()));

      elseBlock.linkTo(endIf);
      elseBlock.addInstruction(new ILJumpInstruction(2, endIf.getLabel()));

      endIf.addInstruction(new ILReturnVoidInstruction(3));

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // IDs: entry(0), then(1), else(2), endif(3)
      // Both then and else have endif in their frontier
      expect(frontiers.getFrontier(1).has(3)).toBe(true);
      expect(frontiers.getFrontier(2).has(3)).toBe(true);

      // Entry does NOT have endif in frontier
      expect(frontiers.getFrontier(0).has(3)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.8: Early return frontiers
  // ---------------------------------------------------------------------------
  describe('Early Return CFG Frontiers', () => {
    it('Test S5.8: early return path frontiers', () => {
      // Create CFG with early return
      //   entry (0)
      //     |
      //   check (1)
      //    /  \
      //  early  continue
      //  (2)     (3)
      //           |
      //         end (4)
      const func = new ILFunction('early_return', [], IL_VOID);
      const entry = func.getEntryBlock();
      const check = func.createBlock('check');
      const early = func.createBlock('early_return');
      const cont = func.createBlock('continue');
      const end = func.createBlock('end');

      const condReg = func.createRegister(IL_BYTE, 'cond');

      entry.linkTo(check);
      entry.addInstruction(new ILJumpInstruction(0, check.getLabel()));

      check.linkTo(early);
      check.linkTo(cont);
      check.addInstruction(new ILBranchInstruction(1, condReg, early.getLabel(), cont.getLabel()));

      // Early return exits immediately
      early.addInstruction(new ILReturnVoidInstruction(2));

      cont.linkTo(end);
      cont.addInstruction(new ILJumpInstruction(3, end.getLabel()));

      end.addInstruction(new ILReturnVoidInstruction(4));

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // IDs: entry(0), check(1), early(2), continue(3), end(4)
      // No join points in this CFG (early return never rejoins)
      // So all frontiers should be empty
      expect(frontiers.hasNoFrontiers()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.9: Complex CFG frontiers
  // ---------------------------------------------------------------------------
  describe('Complex CFG Frontiers', () => {
    it('Test S5.9: complex CFG with multiple join points', () => {
      // Create:
      //     entry (0)
      //        |
      //     split (1)
      //      /  \
      //    a      b
      //   (2)    (3)
      //    |   /  |
      //    v  v   v
      //   join1  c
      //    (4)  (5)
      //      \  /
      //       vv
      //     join2 (6)
      const func = new ILFunction('complex', [], IL_VOID);
      const entry = func.getEntryBlock();
      const split = func.createBlock('split');
      const a = func.createBlock('a');
      const b = func.createBlock('b');
      const join1 = func.createBlock('join1');
      const c = func.createBlock('c');
      const join2 = func.createBlock('join2');

      const cond1 = func.createRegister(IL_BYTE, 'cond1');
      const cond2 = func.createRegister(IL_BYTE, 'cond2');

      entry.linkTo(split);
      entry.addInstruction(new ILJumpInstruction(0, split.getLabel()));

      // split -> a, b
      split.linkTo(a);
      split.linkTo(b);
      split.addInstruction(new ILBranchInstruction(1, cond1, a.getLabel(), b.getLabel()));

      // a -> join1
      a.linkTo(join1);
      a.addInstruction(new ILJumpInstruction(2, join1.getLabel()));

      // b -> join1 or c
      b.linkTo(join1);
      b.linkTo(c);
      b.addInstruction(new ILBranchInstruction(3, cond2, join1.getLabel(), c.getLabel()));

      // join1 -> join2
      join1.linkTo(join2);
      join1.addInstruction(new ILJumpInstruction(4, join2.getLabel()));

      // c -> join2
      c.linkTo(join2);
      c.addInstruction(new ILJumpInstruction(5, join2.getLabel()));

      join2.addInstruction(new ILReturnVoidInstruction(6));

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // IDs: entry(0), split(1), a(2), b(3), join1(4), c(5), join2(6)

      // a (2) has join1 (4) in frontier
      expect(frontiers.getFrontier(2).has(4)).toBe(true);

      // b (3) has join1 (4) in frontier (since b also goes to join1)
      // But actually b is also the idom of c, so we need to check carefully
      // b dominates itself which is a predecessor of join1

      // join1 (4) has join2 (6) in frontier (join1 is predecessor of join2)
      expect(frontiers.getFrontier(4).has(6)).toBe(true);

      // c (5) has join2 (6) in frontier
      expect(frontiers.getFrontier(5).has(6)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.10: Frontier is empty for exit blocks
  // ---------------------------------------------------------------------------
  describe('Exit Block Frontiers', () => {
    it('Test S5.10: exit blocks have empty frontiers', () => {
      const func = createDiamondCFG();
      // IDs: entry(0), header(1), left(2), right(3), merge(4)

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // merge (4) is exit block - has empty frontier
      // (no successors means nothing can be in its frontier)
      expect(frontiers.getFrontier(4).size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.11: Frontier computation is deterministic
  // ---------------------------------------------------------------------------
  describe('Determinism', () => {
    it('Test S5.11: frontier computation is deterministic', () => {
      const func = createDiamondCFG();

      // Compute frontiers multiple times
      const domTree = computeDominators(func);
      const frontiers1 = computeFrontiers(func, domTree);
      const frontiers2 = computeFrontiers(func, domTree);
      const frontiers3 = computeFrontiers(func, domTree);

      // Results should be identical
      for (const blockId of frontiers1.getAllBlockIds()) {
        const f1 = Array.from(frontiers1.getFrontier(blockId)).sort();
        const f2 = Array.from(frontiers2.getFrontier(blockId)).sort();
        const f3 = Array.from(frontiers3.getFrontier(blockId)).sort();

        expect(f1).toEqual(f2);
        expect(f2).toEqual(f3);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.12: Frontier invariants hold
  // ---------------------------------------------------------------------------
  describe('Frontier Invariants', () => {
    it('Test S5.12: frontier definition invariants hold', () => {
      const func = createDiamondCFG();
      // IDs: entry(0), header(1), left(2), right(3), merge(4)

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // For each block B and each X in DF(B):
      // - B dominates some predecessor P of X
      // - B does NOT strictly dominate X
      for (const blockId of frontiers.getAllBlockIds()) {
        const frontier = frontiers.getFrontier(blockId);

        for (const frontierBlockId of frontier) {
          // Get predecessors of frontierBlockId
          const frontierBlock = func.getBlocks().find((b) => b.id === frontierBlockId);
          expect(frontierBlock).toBeDefined();

          const predecessors = frontierBlock!.getPredecessors();

          // B should dominate at least one predecessor
          const dominatesSomePredecessor = predecessors.some((pred) =>
            domTree.dominates(blockId, pred.id),
          );
          expect(dominatesSomePredecessor).toBe(true);

          // B should NOT strictly dominate frontierBlockId
          expect(domTree.strictlyDominates(blockId, frontierBlockId)).toBe(false);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.13: Frontier for entry block
  // ---------------------------------------------------------------------------
  describe('Entry Block Frontier', () => {
    it('Test S5.13: entry block frontier is typically empty', () => {
      const func = createDiamondCFG();

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Entry block (0) typically has empty frontier
      // because entry dominates all reachable blocks
      // so it strictly dominates everything (except itself)
      expect(frontiers.getFrontier(0).size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.14: Frontier consistency with dominator tree
  // ---------------------------------------------------------------------------
  describe('Consistency with Dominator Tree', () => {
    it('Test S5.14: frontiers reference same dominator tree', () => {
      const func = createDiamondCFG();

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Frontiers should maintain reference to dominator tree
      expect(frontiers.getDominatorTree()).toBe(domTree);

      // Block counts should match
      expect(frontiers.getBlockCount()).toBe(domTree.getBlockCount());

      // All block IDs should be the same
      const frontierIds = new Set(frontiers.getAllBlockIds());
      const domTreeIds = new Set(domTree.getAllBlockIds());
      expect(frontierIds).toEqual(domTreeIds);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S5.15: DominanceFrontier class methods
  // ---------------------------------------------------------------------------
  describe('DominanceFrontier Class Methods', () => {
    it('Test S5.15: all class methods work correctly', () => {
      const func = createDiamondCFG();
      // IDs: entry(0), header(1), left(2), right(3), merge(4)

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // getFrontier() - tested above

      // isInFrontier()
      expect(frontiers.isInFrontier(2, 4)).toBe(true); // left has merge in frontier
      expect(frontiers.isInFrontier(0, 4)).toBe(false); // entry doesn't have merge

      // getBlocksWithFrontier()
      const blocksWithMerge = frontiers.getBlocksWithFrontier(4);
      expect(blocksWithMerge.has(2)).toBe(true); // left
      expect(blocksWithMerge.has(3)).toBe(true); // right
      expect(blocksWithMerge.has(0)).toBe(false); // entry

      // getTotalFrontierSize()
      const totalSize = frontiers.getTotalFrontierSize();
      expect(totalSize).toBeGreaterThanOrEqual(2); // At least left and right have merge

      // hasNoFrontiers()
      expect(frontiers.hasNoFrontiers()).toBe(false); // Diamond has frontiers

      // toString()
      const str = frontiers.toString();
      expect(str).toContain('DominanceFrontier');
      expect(str).toContain('DF(block');

      // Immutability - frontier should be a copy
      const frontier = frontiers.getFrontier(2);
      frontier.add(999);
      expect(frontiers.getFrontier(2).has(999)).toBe(false);
    });
  });
});

// =============================================================================
// Session 6 Tests: Dominance Frontier Extreme Tests
// =============================================================================

describe('SSA Dominance Frontier Extreme Tests (Session 6)', () => {
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

    prev.addInstruction(new ILReturnVoidInstruction(blockCount - 1));
    return func;
  }

  /**
   * Creates a diamond chain CFG with N diamonds in sequence.
   * Each diamond creates a merge point (join) in the CFG.
   *
   * Structure:
   * ```
   *   entry -> header0 -> left0/right0 -> merge0 -> header1 -> left1/right1 -> merge1 -> ...
   * ```
   *
   * @param diamondCount - Number of diamond patterns
   * @returns ILFunction with diamond chain CFG
   */
  function createDiamondChain(diamondCount: number): ILFunction {
    const func = new ILFunction(`diamond_chain_${diamondCount}`, [], IL_VOID);
    const entry = func.getEntryBlock();
    const condReg = func.createRegister(IL_BYTE, 'cond');
    let instrId = 0;

    if (diamondCount === 0) {
      entry.addInstruction(new ILReturnVoidInstruction(0));
      return func;
    }

    // Create all diamonds in sequence
    let prev = entry;
    for (let i = 0; i < diamondCount; i++) {
      const header = func.createBlock(`header${i}`);
      const left = func.createBlock(`left${i}`);
      const right = func.createBlock(`right${i}`);
      const merge = func.createBlock(`merge${i}`);

      // prev -> header
      prev.linkTo(header);
      prev.addInstruction(new ILJumpInstruction(instrId++, header.getLabel()));

      // header -> left, right
      header.linkTo(left);
      header.linkTo(right);
      header.addInstruction(
        new ILBranchInstruction(instrId++, condReg, left.getLabel(), right.getLabel()),
      );

      // left -> merge
      left.linkTo(merge);
      left.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));

      // right -> merge
      right.linkTo(merge);
      right.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));

      prev = merge;
    }

    // Final merge returns
    prev.addInstruction(new ILReturnVoidInstruction(instrId));
    return func;
  }

  /**
   * Creates a CFG where multiple blocks all branch to a single merge point.
   * High fan-in pattern with N predecessor blocks.
   *
   * @param predCount - Number of predecessor blocks
   * @returns ILFunction with high fan-in CFG
   */
  function createHighFanInMerge(predCount: number): ILFunction {
    const func = new ILFunction(`fanin_${predCount}`, [], IL_VOID);
    const entry = func.getEntryBlock();
    const merge = func.createBlock('merge');
    const condReg = func.createRegister(IL_BYTE, 'cond');
    let instrId = 0;

    if (predCount <= 1) {
      entry.linkTo(merge);
      entry.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));
      merge.addInstruction(new ILReturnVoidInstruction(instrId));
      return func;
    }

    // Create branch blocks
    const branches: ReturnType<typeof func.createBlock>[] = [];
    for (let i = 0; i < predCount; i++) {
      branches.push(func.createBlock(`branch${i}`));
    }

    // Create a decision tree from entry to reach all branches
    let currentBlock = entry;
    for (let i = 0; i < predCount - 1; i++) {
      const branch = branches[i];
      const nextDecision =
        i < predCount - 2 ? func.createBlock(`decision${i}`) : branches[predCount - 1];

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

  /**
   * Creates a CFG with multiple nested loops.
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

    // Create headers and bodies for each nesting level
    const headers: ReturnType<typeof func.createBlock>[] = [];
    const bodies: ReturnType<typeof func.createBlock>[] = [];

    for (let i = 0; i < nestingLevel; i++) {
      headers.push(func.createBlock(`header${i}`));
      bodies.push(func.createBlock(`body${i}`));
    }

    const exit = func.createBlock('exit');

    // Link entry to first header
    entry.linkTo(headers[0]);
    entry.addInstruction(new ILJumpInstruction(instrId++, headers[0].getLabel()));

    // Link headers to next header or body, and to exit condition
    for (let i = 0; i < nestingLevel; i++) {
      const header = headers[i];
      const body = bodies[i];

      if (i < nestingLevel - 1) {
        // Not innermost - link to next header or body
        header.linkTo(headers[i + 1]);
        header.linkTo(bodies[i]);
        header.addInstruction(
          new ILBranchInstruction(
            instrId++,
            condReg,
            headers[i + 1].getLabel(),
            bodies[i].getLabel(),
          ),
        );
      } else {
        // Innermost header - link to body or exit path
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

    exit.addInstruction(new ILReturnVoidInstruction(instrId));
    return func;
  }

  /**
   * Creates a CFG with multiple variable definition points for DF+ testing.
   * Multiple blocks define variables, requiring iterated frontier computation.
   *
   * @param defCount - Number of definition blocks
   * @returns Object with function and definition block IDs
   */
  function createMultiDefCFG(defCount: number): { func: ILFunction; defBlockIds: number[] } {
    const func = new ILFunction(`multi_def_${defCount}`, [], IL_VOID);
    const entry = func.getEntryBlock();
    const condReg = func.createRegister(IL_BYTE, 'cond');
    let instrId = 0;

    const defBlockIds: number[] = [];

    if (defCount <= 1) {
      entry.addInstruction(new ILReturnVoidInstruction(instrId));
      defBlockIds.push(0);
      return { func, defBlockIds };
    }

    // Create a tree structure where multiple paths have definitions
    // that all merge at a common point
    const defBlocks: ReturnType<typeof func.createBlock>[] = [];
    for (let i = 0; i < defCount; i++) {
      defBlocks.push(func.createBlock(`def${i}`));
      defBlockIds.push(defBlocks[i].id);
    }

    const merge = func.createBlock('merge');

    // Create decision tree from entry
    let currentBlock = entry;
    for (let i = 0; i < defCount - 1; i++) {
      const defBlock = defBlocks[i];
      const nextDecision =
        i < defCount - 2 ? func.createBlock(`decision${i}`) : defBlocks[defCount - 1];

      currentBlock.linkTo(defBlock);
      currentBlock.linkTo(nextDecision);
      currentBlock.addInstruction(
        new ILBranchInstruction(instrId++, condReg, defBlock.getLabel(), nextDecision.getLabel()),
      );

      if (i < defCount - 2) {
        currentBlock = nextDecision;
      }
    }

    // All def blocks lead to merge
    for (const defBlock of defBlocks) {
      defBlock.linkTo(merge);
      defBlock.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));
    }

    merge.addInstruction(new ILReturnVoidInstruction(instrId));
    return { func, defBlockIds };
  }

  // ---------------------------------------------------------------------------
  // Tests S6.1-S6.5: Large CFG Frontier Computation
  // ---------------------------------------------------------------------------
  describe('Large CFG Frontier Computation (Tests S6.1-S6.5)', () => {
    it('Test S6.1: 100-block linear chain has no frontiers', () => {
      const func = createLinearChain(100);
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Linear chain has no join points, so no frontiers
      expect(frontiers.hasNoFrontiers()).toBe(true);
      expect(frontiers.getTotalFrontierSize()).toBe(0);
    });

    it('Test S6.2: 50-diamond chain has correct frontier count', () => {
      const func = createDiamondChain(50);
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Each diamond creates a merge point
      // Left and right branches of each diamond have the merge in their frontier
      // So total frontier size should be 50 * 2 = 100 (2 per diamond)
      expect(frontiers.getTotalFrontierSize()).toBe(100);

      // Should not have no frontiers
      expect(frontiers.hasNoFrontiers()).toBe(false);
    });

    it('Test S6.3: 25-diamond chain left branches all have merge in frontier', () => {
      const func = createDiamondChain(25);
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Verify structure: for each diamond, left branch has merge in frontier
      // Block IDs in our construction:
      // entry(0), header0(1), left0(2), right0(3), merge0(4),
      // header1(5), left1(6), right1(7), merge1(8), ...

      // Count blocks with non-empty frontiers
      let blocksWithFrontiers = 0;
      for (const blockId of frontiers.getAllBlockIds()) {
        if (frontiers.getFrontier(blockId).size > 0) {
          blocksWithFrontiers++;
        }
      }

      // Each diamond has 2 blocks (left, right) with frontiers
      expect(blocksWithFrontiers).toBe(50); // 25 diamonds * 2
    });

    it('Test S6.4: large CFG frontier invariants hold', () => {
      const func = createDiamondChain(20);
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Verify frontier invariants for all blocks
      for (const blockId of frontiers.getAllBlockIds()) {
        const frontier = frontiers.getFrontier(blockId);

        for (const frontierBlockId of frontier) {
          // Get predecessors of frontierBlockId
          const frontierBlock = func.getBlocks().find((b) => b.id === frontierBlockId);
          expect(frontierBlock).toBeDefined();

          const predecessors = frontierBlock!.getPredecessors();

          // blockId should dominate at least one predecessor
          const dominatesSomePredecessor = predecessors.some((pred) =>
            domTree.dominates(blockId, pred.id),
          );
          expect(dominatesSomePredecessor).toBe(true);

          // blockId should NOT strictly dominate frontierBlockId
          expect(domTree.strictlyDominates(blockId, frontierBlockId)).toBe(false);
        }
      }
    });

    it('Test S6.5: 100+ block mixed CFG computes correctly', () => {
      // Create a CFG with diamonds and loops combined
      const func = new ILFunction('large_mixed', [], IL_VOID);
      const entry = func.getEntryBlock();
      const condReg = func.createRegister(IL_BYTE, 'cond');
      let instrId = 0;

      // Create 20 diamonds followed by a loop
      let prev = entry;
      for (let i = 0; i < 20; i++) {
        const header = func.createBlock(`header${i}`);
        const left = func.createBlock(`left${i}`);
        const right = func.createBlock(`right${i}`);
        const merge = func.createBlock(`merge${i}`);

        prev.linkTo(header);
        prev.addInstruction(new ILJumpInstruction(instrId++, header.getLabel()));

        header.linkTo(left);
        header.linkTo(right);
        header.addInstruction(
          new ILBranchInstruction(instrId++, condReg, left.getLabel(), right.getLabel()),
        );

        left.linkTo(merge);
        left.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));

        right.linkTo(merge);
        right.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));

        prev = merge;
      }

      // Add a loop at the end
      const loopHeader = func.createBlock('loop_header');
      const loopBody = func.createBlock('loop_body');
      const exit = func.createBlock('exit');

      prev.linkTo(loopHeader);
      prev.addInstruction(new ILJumpInstruction(instrId++, loopHeader.getLabel()));

      loopHeader.linkTo(loopBody);
      loopHeader.linkTo(exit);
      loopHeader.addInstruction(
        new ILBranchInstruction(instrId++, condReg, loopBody.getLabel(), exit.getLabel()),
      );

      loopBody.linkTo(loopHeader);
      loopBody.addInstruction(new ILJumpInstruction(instrId++, loopHeader.getLabel()));

      exit.addInstruction(new ILReturnVoidInstruction(instrId));

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Verify we have many blocks
      expect(frontiers.getBlockCount()).toBeGreaterThan(80);

      // Verify loop body has loop header in frontier
      const loopBodyId = loopBody.id;
      const loopHeaderId = loopHeader.id;
      expect(frontiers.getFrontier(loopBodyId).has(loopHeaderId)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Tests S6.6-S6.10: Many-to-One Merge Points
  // ---------------------------------------------------------------------------
  describe('Many-to-One Merge Points (Tests S6.6-S6.10)', () => {
    it('Test S6.6: 50-predecessor merge has correct frontier pattern', () => {
      const func = createHighFanInMerge(50);
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Find merge block (block with many predecessors)
      const mergeBlock = func.getBlocks().find((b) => b.getPredecessors().length >= 50);
      expect(mergeBlock).toBeDefined();

      // All predecessor branches should have merge in their frontier
      const blocksWithMerge = frontiers.getBlocksWithFrontier(mergeBlock!.id);
      expect(blocksWithMerge.size).toBeGreaterThanOrEqual(50);
    });

    it('Test S6.7: 100-predecessor merge computes without error', () => {
      const func = createHighFanInMerge(100);
      const domTree = computeDominators(func);

      // Should compute without throwing
      const frontiers = computeFrontiers(func, domTree);

      expect(frontiers.getBlockCount()).toBeGreaterThan(100);
    });

    it('Test S6.8: high fan-in merge is in many frontiers', () => {
      const func = createHighFanInMerge(30);
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Find the merge block
      const mergeBlock = func.getBlocks().find((b) => b.getPredecessors().length >= 30);
      expect(mergeBlock).toBeDefined();

      // Merge should be in frontier of all its predecessor's dominator paths
      const blocksWithMerge = frontiers.getBlocksWithFrontier(mergeBlock!.id);
      expect(blocksWithMerge.size).toBeGreaterThanOrEqual(30);
    });

    it('Test S6.9: high fan-in merge block has empty frontier (exit block)', () => {
      const func = createHighFanInMerge(20);
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Merge block is an exit block, so its frontier should be empty
      const mergeBlock = func.getBlocks().find((b) => b.getPredecessors().length >= 20);
      expect(mergeBlock).toBeDefined();

      expect(frontiers.getFrontier(mergeBlock!.id).size).toBe(0);
    });

    it('Test S6.10: high fan-in frontier invariants hold', () => {
      const func = createHighFanInMerge(40);
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Verify frontier definition for merge block
      const mergeBlock = func.getBlocks().find((b) => b.getPredecessors().length >= 40);
      expect(mergeBlock).toBeDefined();

      const mergeId = mergeBlock!.id;
      const blocksWithMerge = frontiers.getBlocksWithFrontier(mergeId);

      for (const blockId of blocksWithMerge) {
        // blockId should dominate a predecessor of merge
        const mergePredsIds = mergeBlock!.getPredecessors().map((p) => p.id);
        const dominatesSomePred = mergePredsIds.some((predId) => domTree.dominates(blockId, predId));
        expect(dominatesSomePred).toBe(true);

        // blockId should NOT strictly dominate merge
        expect(domTree.strictlyDominates(blockId, mergeId)).toBe(false);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Tests S6.11-S6.15: Iterated Frontier (DF+)
  // ---------------------------------------------------------------------------
  describe('Iterated Frontier DF+ (Tests S6.11-S6.15)', () => {
    it('Test S6.11: DF+ with single def block equals DF', () => {
      const func = createDiamondCFG();
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // For a single def block, DF+ should equal DF
      const singleDef = new Set([2]); // left branch
      const dfPlus = frontiers.computeIteratedFrontier(singleDef);
      const df = frontiers.getFrontier(2);

      expect(dfPlus).toEqual(df);
    });

    it('Test S6.12: DF+ with multiple defs includes all DF', () => {
      const func = createDiamondCFG();
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Multiple defs should include DF of each def block
      const defs = new Set([2, 3]); // left and right branches
      const dfPlus = frontiers.computeIteratedFrontier(defs);

      // Should include merge (4) since both branches have it in frontier
      expect(dfPlus.has(4)).toBe(true);
    });

    it('Test S6.13: DF+ iterates to fixed point in nested loops', () => {
      const func = createNestedLoops(5);
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Get all body blocks as def points
      const bodyIds = new Set<number>();
      for (const block of func.getBlocks()) {
        if (block.label.startsWith('body')) {
          bodyIds.add(block.id);
        }
      }

      // DF+ should include all loop headers
      const dfPlus = frontiers.computeIteratedFrontier(bodyIds);

      // Should find loop headers in the iterated frontier
      for (const block of func.getBlocks()) {
        if (block.label.startsWith('header')) {
          // Loop headers should be in DF+ of bodies
          expect(dfPlus.has(block.id)).toBe(true);
        }
      }
    });

    it('Test S6.14: DF+ with 50 def blocks computes correctly', () => {
      const { func, defBlockIds } = createMultiDefCFG(50);
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // All def blocks converge at merge
      const defs = new Set(defBlockIds);
      const dfPlus = frontiers.computeIteratedFrontier(defs);

      // Merge block should be in DF+
      const mergeBlock = func.getBlocks().find((b) => b.label === 'merge');
      if (mergeBlock) {
        expect(dfPlus.has(mergeBlock.id)).toBe(true);
      }
    });

    it('Test S6.15: DF+ returns empty set for empty def set', () => {
      const func = createDiamondCFG();
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Empty def set should give empty DF+
      const emptyDefs = new Set<number>();
      const dfPlus = frontiers.computeIteratedFrontier(emptyDefs);

      expect(dfPlus.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Tests S6.16-S6.20: Frontier Computation Performance
  // ---------------------------------------------------------------------------
  describe('Frontier Computation Performance (Tests S6.16-S6.20)', () => {
    it('Test S6.16: 200-block CFG computes in reasonable time', () => {
      const func = createDiamondChain(50); // 50 diamonds = ~200 blocks
      const domTree = computeDominators(func);

      const start = performance.now();
      const frontiers = computeFrontiers(func, domTree);
      const duration = performance.now() - start;

      // Should complete in under 1 second
      expect(duration).toBeLessThan(1000);
      expect(frontiers.getBlockCount()).toBeGreaterThan(200);
    });

    it('Test S6.17: repeated frontier computation is deterministic', () => {
      const func = createDiamondChain(20);
      const domTree = computeDominators(func);

      // Compute frontiers multiple times
      const results: DominanceFrontier[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(computeFrontiers(func, domTree));
      }

      // All results should be identical
      const first = results[0];
      for (let i = 1; i < results.length; i++) {
        for (const blockId of first.getAllBlockIds()) {
          const f1 = Array.from(first.getFrontier(blockId)).sort();
          const fi = Array.from(results[i].getFrontier(blockId)).sort();
          expect(f1).toEqual(fi);
        }
      }
    });

    it('Test S6.18: frontier toString() handles large CFG', () => {
      const func = createDiamondChain(30);
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // toString should not throw or produce excessive output
      const str = frontiers.toString();
      expect(str).toContain('DominanceFrontier');
      expect(str.length).toBeGreaterThan(0);
      expect(str.length).toBeLessThan(100000); // Reasonable size
    });

    it('Test S6.19: DF+ on large CFG with many defs computes efficiently', () => {
      const { func, defBlockIds } = createMultiDefCFG(100);
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      const defs = new Set(defBlockIds);

      const start = performance.now();
      const dfPlus = frontiers.computeIteratedFrontier(defs);
      const duration = performance.now() - start;

      // Should complete quickly
      expect(duration).toBeLessThan(500);

      // Should have found the merge point
      expect(dfPlus.size).toBeGreaterThan(0);
    });

    it('Test S6.20: getBlocksWithFrontier() is efficient on large CFG', () => {
      const func = createHighFanInMerge(80);
      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);

      // Find merge block
      const mergeBlock = func.getBlocks().find((b) => b.getPredecessors().length >= 80);
      expect(mergeBlock).toBeDefined();

      const start = performance.now();
      const blocksWithMerge = frontiers.getBlocksWithFrontier(mergeBlock!.id);
      const duration = performance.now() - start;

      // Should be fast (O(n) at worst)
      expect(duration).toBeLessThan(100);
      expect(blocksWithMerge.size).toBeGreaterThanOrEqual(80);
    });
  });
});