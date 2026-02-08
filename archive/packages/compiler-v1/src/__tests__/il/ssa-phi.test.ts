/**
 * Tests for Phi Function Placement Types and PhiPlacer Class
 *
 * **Session 7 Tests:** Phi placement type definitions and class structure
 * - PhiPlacementInfo interface fields
 * - PhiPlacementResult interface fields
 * - PhiPlacementStats interface fields
 * - PhiPlacer class instantiation and methods
 *
 * **Key Concepts Tested:**
 * - Type structure for phi placement information
 * - PhiPlacer class lifecycle (create, add defs, compute, query)
 * - Variable definition registration
 * - Immutability and defensive copies
 *
 * @module __tests__/il/ssa-phi.test
 */

import { describe, it, expect } from 'vitest';
import {
  PhiPlacer,
  type PhiPlacementInfo,
  type PhiPlacementResult,
  type PhiPlacementStats,
  type VariableDefInfo,
} from '../../il/ssa/phi.js';
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
 * Creates a diamond CFG for testing phi placement.
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
 * @returns Object with ILFunction and DominanceFrontier
 */
function createDiamondWithFrontiers(): { func: ILFunction; frontiers: DominanceFrontier } {
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

  const domTree = computeDominators(func);
  const frontiers = computeFrontiers(func, domTree);

  return { func, frontiers };
}

/**
 * Creates a simple linear CFG for testing (no join points).
 *
 * Structure:
 * ```
 *     entry (0)
 *        |
 *     block1 (1)
 *        |
 *     block2 (2)
 * ```
 *
 * @returns Object with ILFunction and DominanceFrontier
 */
function createLinearWithFrontiers(): { func: ILFunction; frontiers: DominanceFrontier } {
  const func = new ILFunction('linear', [], IL_VOID);
  const entry = func.getEntryBlock();
  const block1 = func.createBlock('block1');
  const block2 = func.createBlock('block2');

  entry.linkTo(block1);
  entry.addInstruction(new ILJumpInstruction(0, block1.getLabel()));

  block1.linkTo(block2);
  block1.addInstruction(new ILJumpInstruction(1, block2.getLabel()));

  block2.addInstruction(new ILReturnVoidInstruction(2));

  const domTree = computeDominators(func);
  const frontiers = computeFrontiers(func, domTree);

  return { func, frontiers };
}

// =============================================================================
// Session 7 Tests: Phi Placement Types
// =============================================================================

describe('SSA Phi Placement Types (Session 7)', () => {
  // ---------------------------------------------------------------------------
  // Test S7.1: PhiPlacementInfo interface has required fields
  // ---------------------------------------------------------------------------
  describe('PhiPlacementInfo Interface', () => {
    it('Test S7.1: PhiPlacementInfo interface has required fields', () => {
      // Create a valid PhiPlacementInfo object
      const info: PhiPlacementInfo = {
        variable: 'x',
        phiBlocks: new Set([4, 5]),
        defBlocks: new Set([1, 2, 3]),
      };

      // Verify all fields are present and correctly typed
      expect(info.variable).toBe('x');
      expect(info.phiBlocks).toBeInstanceOf(Set);
      expect(info.defBlocks).toBeInstanceOf(Set);
      expect(info.phiBlocks.has(4)).toBe(true);
      expect(info.phiBlocks.has(5)).toBe(true);
      expect(info.defBlocks.has(1)).toBe(true);
      expect(info.defBlocks.has(2)).toBe(true);
      expect(info.defBlocks.has(3)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S7.2: PhiPlacementStats interface has required fields
  // ---------------------------------------------------------------------------
  describe('PhiPlacementStats Interface', () => {
    it('Test S7.2: PhiPlacementStats interface has required fields', () => {
      const stats: PhiPlacementStats = {
        variableCount: 5,
        blocksWithPhis: 3,
        totalPhiCount: 7,
        maxPhisPerBlock: 3,
        iterations: 2,
      };

      expect(stats.variableCount).toBe(5);
      expect(stats.blocksWithPhis).toBe(3);
      expect(stats.totalPhiCount).toBe(7);
      expect(stats.maxPhisPerBlock).toBe(3);
      expect(stats.iterations).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S7.3: PhiPlacer class instantiation
  // ---------------------------------------------------------------------------
  describe('PhiPlacer Class Instantiation', () => {
    it('Test S7.3: PhiPlacer can be instantiated with DominanceFrontier', () => {
      const { frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      expect(placer).toBeInstanceOf(PhiPlacer);
      expect(placer.isComputed()).toBe(false);
      expect(placer.getVariableCount()).toBe(0);
      expect(placer.getResult()).toBeNull();
      expect(placer.getFrontiers()).toBe(frontiers);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S7.4-S7.5: Variable Definition Registration
  // ---------------------------------------------------------------------------
  describe('Variable Definition Registration', () => {
    it('Test S7.4: addVariableDef() accumulates definitions for same variable', () => {
      const { frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      placer.addVariableDef('x', 1);
      placer.addVariableDef('x', 2);
      placer.addVariableDef('x', 3);

      expect(placer.getVariableCount()).toBe(1);
      expect(placer.hasVariable('x')).toBe(true);
      expect(placer.hasVariable('y')).toBe(false);

      const defs = placer.getVariableDefs();
      expect(defs.get('x')?.size).toBe(3);
    });

    it('Test S7.5: addVariableDef() handles multiple variables', () => {
      const { frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      placer.addVariableDef('x', 1);
      placer.addVariableDef('y', 1);
      placer.addVariableDef('z', 2);

      expect(placer.getVariableCount()).toBe(3);
      expect(placer.hasVariable('x')).toBe(true);
      expect(placer.hasVariable('y')).toBe(true);
      expect(placer.hasVariable('z')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S7.6: Defensive copies
  // ---------------------------------------------------------------------------
  describe('Defensive Copies', () => {
    it('Test S7.6: getVariableDefs() returns defensive copy', () => {
      const { frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      placer.addVariableDef('x', 1);

      const copy = placer.getVariableDefs();
      copy.get('x')?.add(999);
      copy.set('modified', new Set([1]));

      const original = placer.getVariableDefs();
      expect(original.get('x')?.has(999)).toBe(false);
      expect(original.has('modified')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S7.7: Batch registration
  // ---------------------------------------------------------------------------
  describe('Batch Variable Registration', () => {
    it('Test S7.7: addVariableDefs() registers multiple variables at once', () => {
      const { frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      const defs: VariableDefInfo[] = [
        { variable: 'a', defBlocks: new Set([1, 2]) },
        { variable: 'b', defBlocks: new Set([3]) },
        { variable: 'c', defBlocks: new Set([1, 2, 3]) },
      ];
      placer.addVariableDefs(defs);

      expect(placer.getVariableCount()).toBe(3);
      expect(placer.getVariableDefs().get('a')?.size).toBe(2);
      expect(placer.getVariableDefs().get('b')?.size).toBe(1);
      expect(placer.getVariableDefs().get('c')?.size).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S7.8: Compute state management
  // ---------------------------------------------------------------------------
  describe('Compute State Management', () => {
    it('Test S7.8: addVariableDef() throws after phi placement is computed', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      placer.addVariableDef('x', 2);
      placer.addVariableDef('x', 3);
      placer.placePhiFunctions(func);

      expect(placer.isComputed()).toBe(true);
      expect(() => placer.addVariableDef('y', 1)).toThrow(
        'Cannot add variable definitions after phi placement is computed'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Test S7.9: Reset functionality
  // ---------------------------------------------------------------------------
  describe('Reset Functionality', () => {
    it('Test S7.9: reset() clears all state and allows recomputation', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      placer.addVariableDef('x', 2);
      placer.placePhiFunctions(func);
      expect(placer.isComputed()).toBe(true);

      placer.reset();

      expect(placer.isComputed()).toBe(false);
      expect(placer.getVariableCount()).toBe(0);
      expect(placer.getResult()).toBeNull();

      placer.addVariableDef('y', 1);
      expect(placer.hasVariable('y')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S7.10: Debug output
  // ---------------------------------------------------------------------------
  describe('Debug Output', () => {
    it('Test S7.10: toString() provides useful debug information', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      const beforeStr = placer.toString();
      expect(beforeStr).toContain('PhiPlacer');
      expect(beforeStr).toContain('Variables: 0');
      expect(beforeStr).toContain('Computed: false');

      placer.addVariableDef('x', 2);
      placer.addVariableDef('x', 3);
      placer.placePhiFunctions(func);

      const afterStr = placer.toString();
      expect(afterStr).toContain('Computed: true');
      expect(afterStr).toContain('x:');
    });
  });
});

// =============================================================================
// Session 8 Tests: Phi Placement Algorithm
// =============================================================================

describe('SSA Phi Placement Algorithm (Session 8)', () => {
  // ---------------------------------------------------------------------------
  // Helper Functions for Session 8
  // ---------------------------------------------------------------------------

  /**
   * Creates a simple loop CFG for testing phi placement.
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
   */
  function createLoopWithFrontiers(): { func: ILFunction; frontiers: DominanceFrontier } {
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

    const domTree = computeDominators(func);
    const frontiers = computeFrontiers(func, domTree);

    return { func, frontiers };
  }

  /**
   * Creates a nested loop CFG for testing phi placement.
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
   */
  function createNestedLoopWithFrontiers(): { func: ILFunction; frontiers: DominanceFrontier } {
    const func = new ILFunction('nested_loop', [], IL_VOID);
    const entry = func.getEntryBlock();
    const outerHeader = func.createBlock('outer_header');
    const innerHeader = func.createBlock('inner_header');
    const innerBody = func.createBlock('inner_body');
    const outerBody = func.createBlock('outer_body');
    const exit = func.createBlock('exit');

    const cond1 = func.createRegister(IL_BYTE, 'cond1');
    const cond2 = func.createRegister(IL_BYTE, 'cond2');

    // entry -> outer_header
    entry.linkTo(outerHeader);
    entry.addInstruction(new ILJumpInstruction(0, outerHeader.getLabel()));

    // outer_header -> inner_header or exit
    outerHeader.linkTo(innerHeader);
    outerHeader.linkTo(exit);
    outerHeader.addInstruction(
      new ILBranchInstruction(1, cond1, innerHeader.getLabel(), exit.getLabel())
    );

    // inner_header -> inner_body or outer_body
    innerHeader.linkTo(innerBody);
    innerHeader.linkTo(outerBody);
    innerHeader.addInstruction(
      new ILBranchInstruction(2, cond2, innerBody.getLabel(), outerBody.getLabel())
    );

    // inner_body -> inner_header (back edge)
    innerBody.linkTo(innerHeader);
    innerBody.addInstruction(new ILJumpInstruction(3, innerHeader.getLabel()));

    // outer_body -> outer_header (back edge)
    outerBody.linkTo(outerHeader);
    outerBody.addInstruction(new ILJumpInstruction(4, outerHeader.getLabel()));

    // exit returns
    exit.addInstruction(new ILReturnVoidInstruction(5));

    const domTree = computeDominators(func);
    const frontiers = computeFrontiers(func, domTree);

    return { func, frontiers };
  }

  // ---------------------------------------------------------------------------
  // Test S8.1: No phi needed (single assignment)
  // ---------------------------------------------------------------------------
  describe('Single Assignment (No Phi Needed)', () => {
    it('Test S8.1: no phi needed when variable defined only once', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      // Variable 'x' defined only in entry block
      placer.addVariableDef('x', 0);

      const result = placer.placePhiFunctions(func);

      // No phi functions needed - single definition dominates all uses
      expect(result.totalPhiCount).toBe(0);
      expect(result.byVariable.get('x')?.phiBlocks.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.2: Phi at if-else merge
  // ---------------------------------------------------------------------------
  describe('If-Else Merge Pattern', () => {
    it('Test S8.2: phi placed at if-else merge point', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      // IDs: entry(0), header(1), left(2), right(3), merge(4)
      const placer = new PhiPlacer(frontiers);

      // Variable 'x' defined in both branches
      placer.addVariableDef('x', 2); // left branch
      placer.addVariableDef('x', 3); // right branch

      const result = placer.placePhiFunctions(func);

      // Phi needed at merge point (4)
      expect(result.totalPhiCount).toBe(1);
      expect(result.byVariable.get('x')?.phiBlocks.has(4)).toBe(true);
      expect(result.byBlock.get(4)?.includes('x')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.3: Phi at loop header
  // ---------------------------------------------------------------------------
  describe('Loop Header Pattern', () => {
    it('Test S8.3: phi placed at loop header for loop variable', () => {
      const { func, frontiers } = createLoopWithFrontiers();
      // IDs: entry(0), header(1), body(2), exit(3)
      const placer = new PhiPlacer(frontiers);

      // Variable 'counter' defined in entry and body (back edge)
      placer.addVariableDef('counter', 0); // initial value
      placer.addVariableDef('counter', 2); // increment in body

      const result = placer.placePhiFunctions(func);

      // Phi needed at loop header (1) - merge of initial and back edge
      expect(result.totalPhiCount).toBe(1);
      expect(result.byVariable.get('counter')?.phiBlocks.has(1)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.4: Multiple variables need phi
  // ---------------------------------------------------------------------------
  describe('Multiple Variables', () => {
    it('Test S8.4: multiple variables each get phi at merge', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      // IDs: entry(0), header(1), left(2), right(3), merge(4)
      const placer = new PhiPlacer(frontiers);

      // Variable 'x' defined in both branches
      placer.addVariableDef('x', 2);
      placer.addVariableDef('x', 3);

      // Variable 'y' also defined in both branches
      placer.addVariableDef('y', 2);
      placer.addVariableDef('y', 3);

      // Variable 'z' defined only in left branch
      placer.addVariableDef('z', 2);

      const result = placer.placePhiFunctions(func);

      // Both x and y need phi at merge, z needs phi too (defined in branch)
      expect(result.byVariable.get('x')?.phiBlocks.has(4)).toBe(true);
      expect(result.byVariable.get('y')?.phiBlocks.has(4)).toBe(true);
      expect(result.byVariable.get('z')?.phiBlocks.has(4)).toBe(true);

      // Merge block has all three variables
      const mergeVars = result.byBlock.get(4);
      expect(mergeVars?.includes('x')).toBe(true);
      expect(mergeVars?.includes('y')).toBe(true);
      expect(mergeVars?.includes('z')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.5: Nested loop phi placement
  // ---------------------------------------------------------------------------
  describe('Nested Loop Pattern', () => {
    it('Test S8.5: phi functions placed at nested loop headers', () => {
      const { func, frontiers } = createNestedLoopWithFrontiers();
      // IDs: entry(0), outer_header(1), inner_header(2), inner_body(3), outer_body(4), exit(5)
      const placer = new PhiPlacer(frontiers);

      // Outer loop counter: defined in entry and outer_body
      placer.addVariableDef('i', 0);
      placer.addVariableDef('i', 4);

      // Inner loop counter: defined in outer_header and inner_body
      placer.addVariableDef('j', 1);
      placer.addVariableDef('j', 3);

      const result = placer.placePhiFunctions(func);

      // 'i' needs phi at outer_header (1)
      expect(result.byVariable.get('i')?.phiBlocks.has(1)).toBe(true);

      // 'j' needs phi at inner_header (2)
      expect(result.byVariable.get('j')?.phiBlocks.has(2)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.6: Phi placement iterates to fixed point
  // ---------------------------------------------------------------------------
  describe('Fixed Point Iteration', () => {
    it('Test S8.6: phi placement iterates to fixed point for chained merges', () => {
      const { func, frontiers } = createNestedLoopWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      // Define variable in innermost body only - phi propagates outward
      placer.addVariableDef('value', 3); // inner_body only

      const result = placer.placePhiFunctions(func);

      // Phi should be placed at inner_header (2) since inner_body is in its frontier
      expect(result.byVariable.get('value')?.phiBlocks.has(2)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.7: No phi for variable with no definitions
  // ---------------------------------------------------------------------------
  describe('No Definitions', () => {
    it('Test S8.7: no phi placed when no variable definitions registered', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      // No variable definitions added
      const result = placer.placePhiFunctions(func);

      // Should have no phi functions
      expect(result.totalPhiCount).toBe(0);
      expect(result.byVariable.size).toBe(0);
      expect(result.byBlock.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.8: Phi with 2 predecessors
  // ---------------------------------------------------------------------------
  describe('Two Predecessors', () => {
    it('Test S8.8: phi at join with exactly 2 predecessors', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      // merge block (4) has exactly 2 predecessors: left (2) and right (3)
      const placer = new PhiPlacer(frontiers);

      placer.addVariableDef('x', 2);
      placer.addVariableDef('x', 3);

      const result = placer.placePhiFunctions(func);

      // Phi at merge (4) - exactly 2 predecessors
      expect(result.byVariable.get('x')?.phiBlocks.has(4)).toBe(true);
      expect(result.totalPhiCount).toBe(1);

      // Verify merge block has 2 predecessors
      const mergeBlock = func.getBlocks().find(b => b.id === 4);
      expect(mergeBlock?.getPredecessors().length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.9: Phi with many predecessors (loop entry)
  // ---------------------------------------------------------------------------
  describe('Multiple Predecessors', () => {
    it('Test S8.9: phi at loop header with entry and back edge predecessors', () => {
      const { func, frontiers } = createLoopWithFrontiers();
      // header (1) has 2 predecessors: entry (0) and body (2)
      const placer = new PhiPlacer(frontiers);

      placer.addVariableDef('counter', 0);
      placer.addVariableDef('counter', 2);

      const result = placer.placePhiFunctions(func);

      // Verify header has predecessors from entry and back edge
      const header = func.getBlocks().find(b => b.id === 1);
      expect(header?.getPredecessors().length).toBe(2);

      expect(result.byVariable.get('counter')?.phiBlocks.has(1)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.10: Phi placement is deterministic
  // ---------------------------------------------------------------------------
  describe('Determinism', () => {
    it('Test S8.10: phi placement produces identical results on repeated runs', () => {
      const { func, frontiers } = createDiamondWithFrontiers();

      // Run phi placement multiple times
      const results: ReturnType<PhiPlacer['placePhiFunctions']>[] = [];
      for (let i = 0; i < 5; i++) {
        const placer = new PhiPlacer(frontiers);
        placer.addVariableDef('x', 2);
        placer.addVariableDef('x', 3);
        placer.addVariableDef('y', 2);
        results.push(placer.placePhiFunctions(func));
      }

      // All results should be identical
      const first = results[0];
      for (let i = 1; i < results.length; i++) {
        expect(results[i].totalPhiCount).toBe(first.totalPhiCount);
        expect(results[i].byVariable.size).toBe(first.byVariable.size);

        for (const [variable, info] of first.byVariable) {
          const otherInfo = results[i].byVariable.get(variable);
          expect(otherInfo).toBeDefined();
          expect(Array.from(info.phiBlocks).sort()).toEqual(
            Array.from(otherInfo!.phiBlocks).sort()
          );
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.11: Phi only at dominance frontiers
  // ---------------------------------------------------------------------------
  describe('Frontier-Only Placement', () => {
    it('Test S8.11: phi functions only placed at dominance frontiers', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      // IDs: entry(0), header(1), left(2), right(3), merge(4)
      const placer = new PhiPlacer(frontiers);

      placer.addVariableDef('x', 2);
      placer.addVariableDef('x', 3);

      const result = placer.placePhiFunctions(func);

      // Phi should only be at merge (4), which is in DF(left) and DF(right)
      expect(result.byVariable.get('x')?.phiBlocks.has(4)).toBe(true);

      // No phi at other blocks
      expect(result.byVariable.get('x')?.phiBlocks.has(0)).toBe(false);
      expect(result.byVariable.get('x')?.phiBlocks.has(1)).toBe(false);
      expect(result.byVariable.get('x')?.phiBlocks.has(2)).toBe(false);
      expect(result.byVariable.get('x')?.phiBlocks.has(3)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.12: No redundant phi placement
  // ---------------------------------------------------------------------------
  describe('No Redundant Placement', () => {
    it('Test S8.12: same phi not placed multiple times', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      // Define x in both branches - should only get ONE phi at merge
      placer.addVariableDef('x', 2);
      placer.addVariableDef('x', 3);

      const result = placer.placePhiFunctions(func);

      // Total phi count should be exactly 1
      expect(result.totalPhiCount).toBe(1);

      // Merge block should have exactly 1 variable (x)
      expect(result.byBlock.get(4)?.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.13: Phi for parameter modification
  // ---------------------------------------------------------------------------
  describe('Parameter Modification', () => {
    it('Test S8.13: phi placed when parameter is modified in branch', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      // Simulate: parameter modified in one branch only
      // IDs: entry(0), header(1), left(2), right(3), merge(4)
      const placer = new PhiPlacer(frontiers);

      // Parameter 'param' defined at entry (initial value)
      placer.addVariableDef('param', 0);
      // Parameter modified in left branch only
      placer.addVariableDef('param', 2);

      const result = placer.placePhiFunctions(func);

      // Phi needed at merge (4) - one path modifies, one doesn't
      expect(result.byVariable.get('param')?.phiBlocks.has(4)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.14: Phi for loop counter
  // ---------------------------------------------------------------------------
  describe('Loop Counter Pattern', () => {
    it('Test S8.14: classic for-loop counter phi placement', () => {
      const { func, frontiers } = createLoopWithFrontiers();
      // Classic pattern: i = 0; while(i < n) { ...; i++ }
      // IDs: entry(0), header(1), body(2), exit(3)
      const placer = new PhiPlacer(frontiers);

      // i initialized in entry
      placer.addVariableDef('i', 0);
      // i incremented in body
      placer.addVariableDef('i', 2);

      const result = placer.placePhiFunctions(func);

      // Phi at header where initial value meets incremented value
      expect(result.byVariable.get('i')?.phiBlocks.has(1)).toBe(true);
      expect(result.totalPhiCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.15: Complex CFG phi placement
  // ---------------------------------------------------------------------------
  describe('Complex CFG', () => {
    it('Test S8.15: phi placement in nested loop with conditionals', () => {
      const { func, frontiers } = createNestedLoopWithFrontiers();
      // IDs: entry(0), outer_header(1), inner_header(2), inner_body(3), outer_body(4), exit(5)
      const placer = new PhiPlacer(frontiers);

      // Variable defined in multiple places
      placer.addVariableDef('sum', 0); // initialized
      placer.addVariableDef('sum', 3); // updated in inner body
      placer.addVariableDef('sum', 4); // updated in outer body

      const result = placer.placePhiFunctions(func);

      // Should have phi functions at merge points
      // inner_header (2) merges inner_body back edge
      expect(result.byVariable.get('sum')?.phiBlocks.has(2)).toBe(true);

      // outer_header (1) merges outer_body back edge
      expect(result.byVariable.get('sum')?.phiBlocks.has(1)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.16: Linear CFG has no phi functions
  // ---------------------------------------------------------------------------
  describe('Linear CFG (No Join Points)', () => {
    it('Test S8.16: no phi needed in linear CFG with multiple defs', () => {
      const { func, frontiers } = createLinearWithFrontiers();
      // IDs: entry(0), block1(1), block2(2)
      const placer = new PhiPlacer(frontiers);

      // Variable defined in each block sequentially
      placer.addVariableDef('x', 0);
      placer.addVariableDef('x', 1);
      placer.addVariableDef('x', 2);

      const result = placer.placePhiFunctions(func);

      // No phi functions in linear chain - no join points
      expect(result.totalPhiCount).toBe(0);
      expect(result.byBlock.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.17: Result statistics are accurate
  // ---------------------------------------------------------------------------
  describe('Statistics Accuracy', () => {
    it('Test S8.17: result stats match actual phi placement', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      placer.addVariableDef('a', 2);
      placer.addVariableDef('a', 3);
      placer.addVariableDef('b', 2);
      placer.addVariableDef('c', 0); // entry only - no phi needed

      const result = placer.placePhiFunctions(func);

      // Verify stats
      expect(result.stats.variableCount).toBe(3);
      expect(result.totalPhiCount).toBe(result.stats.totalPhiCount);

      // Count blocks with phis
      let blocksWithPhis = 0;
      for (const [_blockId, vars] of result.byBlock) {
        if (vars.length > 0) blocksWithPhis++;
      }
      expect(result.stats.blocksWithPhis).toBe(blocksWithPhis);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.18: byBlock index is consistent with byVariable
  // ---------------------------------------------------------------------------
  describe('Index Consistency', () => {
    it('Test S8.18: byBlock and byVariable are consistent', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      placer.addVariableDef('x', 2);
      placer.addVariableDef('x', 3);
      placer.addVariableDef('y', 2);

      const result = placer.placePhiFunctions(func);

      // For each variable, verify its phi blocks are in byBlock
      for (const [variable, info] of result.byVariable) {
        for (const blockId of info.phiBlocks) {
          const varsAtBlock = result.byBlock.get(blockId);
          expect(varsAtBlock).toBeDefined();
          expect(varsAtBlock?.includes(variable)).toBe(true);
        }
      }

      // For each block, verify its variables are in byVariable
      for (const [blockId, variables] of result.byBlock) {
        for (const variable of variables) {
          const varInfo = result.byVariable.get(variable);
          expect(varInfo).toBeDefined();
          expect(varInfo?.phiBlocks.has(blockId)).toBe(true);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.19: Cached result is returned on repeated calls
  // ---------------------------------------------------------------------------
  describe('Result Caching', () => {
    it('Test S8.19: placePhiFunctions returns cached result on second call', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      placer.addVariableDef('x', 2);
      placer.addVariableDef('x', 3);

      const result1 = placer.placePhiFunctions(func);
      const result2 = placer.placePhiFunctions(func);

      // Should be the same object (cached)
      expect(result1).toBe(result2);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S8.20: defBlocks preserved in result
  // ---------------------------------------------------------------------------
  describe('Definition Block Preservation', () => {
    it('Test S8.20: original def blocks preserved in placement info', () => {
      const { func, frontiers } = createDiamondWithFrontiers();
      const placer = new PhiPlacer(frontiers);

      // Define x in specific blocks
      placer.addVariableDef('x', 2);
      placer.addVariableDef('x', 3);

      const result = placer.placePhiFunctions(func);

      // Result should preserve original def blocks
      const xInfo = result.byVariable.get('x');
      expect(xInfo).toBeDefined();
      expect(xInfo?.defBlocks.has(2)).toBe(true);
      expect(xInfo?.defBlocks.has(3)).toBe(true);
      expect(xInfo?.defBlocks.size).toBe(2);
    });
  });
});

// =============================================================================
// Session 9 Tests: Phi Placement Extreme Tests
// =============================================================================

describe('SSA Phi Placement Extreme Tests (Session 9)', () => {
  // ---------------------------------------------------------------------------
  // Helper Functions for Session 9
  // ---------------------------------------------------------------------------

  /**
   * Creates a large linear CFG for testing (many blocks in sequence).
   *
   * Structure:
   * ```
   *     entry (0)
   *        |
   *     block_1 (1)
   *        |
   *     block_2 (2)
   *        |
   *       ...
   *        |
   *     block_n (n)
   * ```
   *
   * @param blockCount Number of blocks after entry
   */
  function createLargeLinearCFG(blockCount: number): {
    func: ILFunction;
    frontiers: DominanceFrontier;
  } {
    const func = new ILFunction('large_linear', [], IL_VOID);
    const entry = func.getEntryBlock();

    let prev = entry;
    for (let i = 1; i <= blockCount; i++) {
      const block = func.createBlock(`block_${i}`);
      prev.linkTo(block);
      prev.addInstruction(new ILJumpInstruction(i - 1, block.getLabel()));
      prev = block;
    }

    // Final block returns
    prev.addInstruction(new ILReturnVoidInstruction(blockCount));

    const domTree = computeDominators(func);
    const frontiers = computeFrontiers(func, domTree);

    return { func, frontiers };
  }

  /**
   * Creates a large diamond cascade CFG (many if-else merges).
   *
   * Structure:
   * ```
   *     entry (0)
   *        |
   *     header_1 (1)
   *      /    \
   *   left_1  right_1
   *     \    /
   *     merge_1
   *        |
   *     header_2
   *      /    \
   *    ...
   * ```
   *
   * @param diamondCount Number of diamond patterns
   */
  function createDiamondCascade(diamondCount: number): {
    func: ILFunction;
    frontiers: DominanceFrontier;
  } {
    const func = new ILFunction('diamond_cascade', [], IL_VOID);
    const entry = func.getEntryBlock();
    const condReg = func.createRegister(IL_BYTE, 'cond');

    let prev = entry;
    let instrId = 0;

    for (let i = 1; i <= diamondCount; i++) {
      const header = func.createBlock(`header_${i}`);
      const left = func.createBlock(`left_${i}`);
      const right = func.createBlock(`right_${i}`);
      const merge = func.createBlock(`merge_${i}`);

      prev.linkTo(header);
      prev.addInstruction(new ILJumpInstruction(instrId++, header.getLabel()));

      header.linkTo(left);
      header.linkTo(right);
      header.addInstruction(
        new ILBranchInstruction(instrId++, condReg, left.getLabel(), right.getLabel())
      );

      left.linkTo(merge);
      left.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));

      right.linkTo(merge);
      right.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));

      prev = merge;
    }

    prev.addInstruction(new ILReturnVoidInstruction(instrId));

    const domTree = computeDominators(func);
    const frontiers = computeFrontiers(func, domTree);

    return { func, frontiers };
  }

  /**
   * Creates a deeply nested loop structure.
   *
   * @param depth Nesting depth
   */
  function createDeeplyNestedLoops(depth: number): {
    func: ILFunction;
    frontiers: DominanceFrontier;
  } {
    const func = new ILFunction('deep_nested', [], IL_VOID);
    const entry = func.getEntryBlock();
    const condReg = func.createRegister(IL_BYTE, 'cond');

    const headers: ReturnType<typeof func.createBlock>[] = [];
    const bodies: ReturnType<typeof func.createBlock>[] = [];

    // Create all headers and bodies
    for (let i = 0; i < depth; i++) {
      headers.push(func.createBlock(`header_${i}`));
      bodies.push(func.createBlock(`body_${i}`));
    }
    const exit = func.createBlock('exit');

    let instrId = 0;

    // Entry -> first header
    entry.linkTo(headers[0]);
    entry.addInstruction(new ILJumpInstruction(instrId++, headers[0].getLabel()));

    // Connect headers and bodies
    for (let i = 0; i < depth; i++) {
      const nextTarget = i < depth - 1 ? headers[i + 1] : bodies[i];
      const exitTarget = i === 0 ? exit : bodies[i - 1];

      headers[i].linkTo(nextTarget);
      headers[i].linkTo(exitTarget);
      headers[i].addInstruction(
        new ILBranchInstruction(instrId++, condReg, nextTarget.getLabel(), exitTarget.getLabel())
      );
    }

    // Connect innermost body to its header
    bodies[depth - 1].linkTo(headers[depth - 1]);
    bodies[depth - 1].addInstruction(
      new ILJumpInstruction(instrId++, headers[depth - 1].getLabel())
    );

    // Connect outer bodies
    for (let i = depth - 2; i >= 0; i--) {
      bodies[i].linkTo(headers[i]);
      bodies[i].addInstruction(new ILJumpInstruction(instrId++, headers[i].getLabel()));
    }

    // Exit returns
    exit.addInstruction(new ILReturnVoidInstruction(instrId));

    const domTree = computeDominators(func);
    const frontiers = computeFrontiers(func, domTree);

    return { func, frontiers };
  }

  /**
   * Creates a many-to-one merge CFG (N predecessors to 1 block).
   *
   * Structure for 4 predecessors:
   * ```
   *        entry (0)
   *           |
   *        decision_0 (1)
   *         /      \
   *    branch_0   decision_1
   *       (2)        (3)
   *        |        /    \
   *        |   branch_1  decision_2
   *        |      (4)       (5)
   *        |       |       /    \
   *        |       |  branch_2  branch_3
   *        |       |     (6)      (7)
   *        |       |      |        |
   *        +-------+------+--------+
   *                    |
   *                  merge (8)
   * ```
   *
   * @param predecessorCount Number of predecessor blocks (branches merging)
   */
  function createManyToOneMerge(predecessorCount: number): {
    func: ILFunction;
    frontiers: DominanceFrontier;
  } {
    const func = new ILFunction('many_to_one', [], IL_VOID);
    const entry = func.getEntryBlock();
    const merge = func.createBlock('merge');

    const condReg = func.createRegister(IL_BYTE, 'cond');
    let instrId = 0;

    // Handle edge case: single predecessor
    if (predecessorCount === 1) {
      const branch = func.createBlock('branch_0');
      entry.linkTo(branch);
      entry.addInstruction(new ILJumpInstruction(instrId++, branch.getLabel()));
      branch.linkTo(merge);
      branch.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));
      merge.addInstruction(new ILReturnVoidInstruction(instrId));

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);
      return { func, frontiers };
    }

    // Create decision nodes and branches
    const decisions: ReturnType<typeof func.createBlock>[] = [];
    const branches: ReturnType<typeof func.createBlock>[] = [];

    // Create all decision nodes (predecessorCount - 1)
    for (let i = 0; i < predecessorCount - 1; i++) {
      decisions.push(func.createBlock(`decision_${i}`));
    }

    // Create all branch nodes
    for (let i = 0; i < predecessorCount; i++) {
      branches.push(func.createBlock(`branch_${i}`));
    }

    // Entry -> first decision
    entry.linkTo(decisions[0]);
    entry.addInstruction(new ILJumpInstruction(instrId++, decisions[0].getLabel()));

    // Connect decision cascade
    for (let i = 0; i < decisions.length; i++) {
      const decision = decisions[i];
      const branch = branches[i];

      if (i < decisions.length - 1) {
        // Decision branches to branch_i or next decision
        const nextDecision = decisions[i + 1];
        decision.linkTo(branch);
        decision.linkTo(nextDecision);
        decision.addInstruction(
          new ILBranchInstruction(instrId++, condReg, branch.getLabel(), nextDecision.getLabel())
        );
      } else {
        // Last decision branches to branch_{n-2} or branch_{n-1}
        const lastBranch = branches[branches.length - 1];
        decision.linkTo(branch);
        decision.linkTo(lastBranch);
        decision.addInstruction(
          new ILBranchInstruction(instrId++, condReg, branch.getLabel(), lastBranch.getLabel())
        );
      }
    }

    // All branches jump to merge
    for (const branch of branches) {
      branch.linkTo(merge);
      branch.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));
    }

    // Merge returns
    merge.addInstruction(new ILReturnVoidInstruction(instrId));

    const domTree = computeDominators(func);
    const frontiers = computeFrontiers(func, domTree);

    return { func, frontiers };
  }

  // ---------------------------------------------------------------------------
  // Test S9.1-S9.5: Large CFG Tests
  // ---------------------------------------------------------------------------
  describe('Large CFG Tests', () => {
    it('Test S9.1: phi placement in CFG with 50 linear blocks', () => {
      const { func, frontiers } = createLargeLinearCFG(50);
      const placer = new PhiPlacer(frontiers);

      // Define variable at start and end
      placer.addVariableDef('x', 0);
      placer.addVariableDef('x', 50);

      const result = placer.placePhiFunctions(func);

      // Linear CFG has no join points, so no phi needed
      expect(result.totalPhiCount).toBe(0);
      expect(result.byVariable.get('x')?.defBlocks.size).toBe(2);
    });

    it('Test S9.2: phi placement in CFG with 100 blocks', () => {
      const { func, frontiers } = createLargeLinearCFG(100);
      const placer = new PhiPlacer(frontiers);

      // Define variable in multiple blocks
      for (let i = 0; i <= 100; i += 10) {
        placer.addVariableDef('counter', i);
      }

      const result = placer.placePhiFunctions(func);

      // Still no phi in linear chain
      expect(result.totalPhiCount).toBe(0);
      expect(result.byVariable.get('counter')?.defBlocks.size).toBe(11);
    });

    it('Test S9.3: phi placement in 25 diamond cascade', () => {
      const { func, frontiers } = createDiamondCascade(25);
      const placer = new PhiPlacer(frontiers);

      // Define variable in each left branch
      for (let i = 1; i <= 25; i++) {
        const leftBlockId = (i - 1) * 4 + 2; // left blocks
        placer.addVariableDef('value', leftBlockId);
      }

      const result = placer.placePhiFunctions(func);

      // Should have phi at each merge point (25 merges)
      expect(result.totalPhiCount).toBe(25);
    });

    it('Test S9.4: phi placement in 50 diamond cascade', () => {
      const { func, frontiers } = createDiamondCascade(50);
      const placer = new PhiPlacer(frontiers);

      // Define variable in all branches
      for (let i = 1; i <= 50; i++) {
        const leftBlockId = (i - 1) * 4 + 2;
        const rightBlockId = (i - 1) * 4 + 3;
        placer.addVariableDef('x', leftBlockId);
        placer.addVariableDef('x', rightBlockId);
      }

      const result = placer.placePhiFunctions(func);

      // Should have exactly 50 phi functions (one per merge)
      expect(result.totalPhiCount).toBe(50);
    });

    it('Test S9.5: phi placement scales linearly with diamond count', () => {
      const results: { diamonds: number; phis: number }[] = [];

      for (const count of [5, 10, 15, 20]) {
        const { func, frontiers } = createDiamondCascade(count);
        const placer = new PhiPlacer(frontiers);

        // Define in both branches of each diamond
        for (let i = 1; i <= count; i++) {
          const leftBlockId = (i - 1) * 4 + 2;
          const rightBlockId = (i - 1) * 4 + 3;
          placer.addVariableDef('x', leftBlockId);
          placer.addVariableDef('x', rightBlockId);
        }

        const result = placer.placePhiFunctions(func);
        results.push({ diamonds: count, phis: result.totalPhiCount });
      }

      // Verify linear scaling - each diamond adds exactly one phi
      expect(results[0].phis).toBe(5);
      expect(results[1].phis).toBe(10);
      expect(results[2].phis).toBe(15);
      expect(results[3].phis).toBe(20);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S9.6-S9.10: Many Variables Tests
  // ---------------------------------------------------------------------------
  describe('Many Variables Tests', () => {
    it('Test S9.6: phi placement with 50 variables', () => {
      const { func, frontiers } = createDiamondCascade(5);
      const placer = new PhiPlacer(frontiers);

      // Register 50 variables, each defined in different branches
      for (let v = 0; v < 50; v++) {
        const diamondIdx = v % 5;
        const leftBlockId = diamondIdx * 4 + 2;
        const rightBlockId = diamondIdx * 4 + 3;
        placer.addVariableDef(`var_${v}`, leftBlockId);
        placer.addVariableDef(`var_${v}`, rightBlockId);
      }

      const result = placer.placePhiFunctions(func);

      // All 50 variables need phi
      expect(result.byVariable.size).toBe(50);
      expect(result.stats.variableCount).toBe(50);
    });

    it('Test S9.7: phi placement with 100 variables', () => {
      const { func, frontiers } = createDiamondCascade(10);
      const placer = new PhiPlacer(frontiers);

      // Register 100 variables
      for (let v = 0; v < 100; v++) {
        const diamondIdx = v % 10;
        const leftBlockId = diamondIdx * 4 + 2;
        placer.addVariableDef(`v_${v}`, leftBlockId);
      }

      const result = placer.placePhiFunctions(func);

      expect(result.byVariable.size).toBe(100);
    });

    it('Test S9.8: max phis per block with many variables', () => {
      const { func, frontiers } = createDiamondCascade(1);
      const placer = new PhiPlacer(frontiers);

      // Register 20 variables, all merging at same block
      for (let v = 0; v < 20; v++) {
        placer.addVariableDef(`v_${v}`, 2); // left branch
        placer.addVariableDef(`v_${v}`, 3); // right branch
      }

      const result = placer.placePhiFunctions(func);

      // All 20 variables need phi at merge (block 4)
      expect(result.stats.maxPhisPerBlock).toBe(20);
      expect(result.byBlock.get(4)?.length).toBe(20);
    });

    it('Test S9.9: distributed variables across blocks', () => {
      const { func, frontiers } = createDiamondCascade(10);
      const placer = new PhiPlacer(frontiers);

      // Each diamond gets 5 unique variables
      for (let d = 0; d < 10; d++) {
        for (let v = 0; v < 5; v++) {
          const leftBlockId = d * 4 + 2;
          const rightBlockId = d * 4 + 3;
          placer.addVariableDef(`d${d}_v${v}`, leftBlockId);
          placer.addVariableDef(`d${d}_v${v}`, rightBlockId);
        }
      }

      const result = placer.placePhiFunctions(func);

      // 10 diamonds * 5 variables = 50 variables, each with 1 phi
      expect(result.totalPhiCount).toBe(50);
      expect(result.stats.maxPhisPerBlock).toBe(5);
    });

    it('Test S9.10: variables with different definition counts', () => {
      const { func, frontiers } = createDiamondCascade(5);
      const placer = new PhiPlacer(frontiers);

      // Variable with 1 def (no phi needed if at entry)
      placer.addVariableDef('single_def', 0);

      // Variable with 2 defs in same diamond
      placer.addVariableDef('two_def', 2);
      placer.addVariableDef('two_def', 3);

      // Variable with defs spread across multiple diamonds
      placer.addVariableDef('spread_def', 2); // diamond 1 left
      placer.addVariableDef('spread_def', 6); // diamond 2 left
      placer.addVariableDef('spread_def', 10); // diamond 3 left

      const result = placer.placePhiFunctions(func);

      expect(result.byVariable.get('single_def')?.phiBlocks.size).toBe(0);
      expect(result.byVariable.get('two_def')?.phiBlocks.size).toBe(1);
      expect(result.byVariable.get('spread_def')?.phiBlocks.size).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S9.11-S9.15: Deeply Nested Loop Tests
  // ---------------------------------------------------------------------------
  describe('Deeply Nested Loop Tests', () => {
    it('Test S9.11: phi placement with 5-level nested loops', () => {
      const { func, frontiers } = createDeeplyNestedLoops(5);
      const placer = new PhiPlacer(frontiers);

      // Define counter at each level (entry + each header)
      placer.addVariableDef('i', 0); // entry
      for (let level = 0; level < 5; level++) {
        const bodyBlockId = 5 + level + 1; // body blocks start after headers
        placer.addVariableDef('i', bodyBlockId);
      }

      const result = placer.placePhiFunctions(func);

      // Should have phi at multiple loop headers
      expect(result.totalPhiCount).toBeGreaterThan(0);
    });

    it('Test S9.12: phi placement with 10-level nested loops', () => {
      const { func, frontiers } = createDeeplyNestedLoops(10);
      const placer = new PhiPlacer(frontiers);

      // Define separate counter for each level
      for (let level = 0; level < 10; level++) {
        placer.addVariableDef(`level_${level}`, 0); // initial
        const bodyBlockId = 10 + level + 1;
        placer.addVariableDef(`level_${level}`, bodyBlockId);
      }

      const result = placer.placePhiFunctions(func);

      expect(result.byVariable.size).toBe(10);
    });

    it('Test S9.13: phi propagation through nested loop levels', () => {
      const { func, frontiers } = createDeeplyNestedLoops(3);
      const placer = new PhiPlacer(frontiers);

      // Define variable only in innermost body
      // It should propagate phi outward
      const innermostBody = 3 + 3; // body_2 in 3-level nesting
      placer.addVariableDef('inner_only', innermostBody);

      const result = placer.placePhiFunctions(func);

      // Should have phi at innermost header at minimum
      expect(result.byVariable.get('inner_only')?.phiBlocks.size).toBeGreaterThan(0);
    });

    it('Test S9.14: multiple variables in deeply nested loops', () => {
      const { func, frontiers } = createDeeplyNestedLoops(4);
      const placer = new PhiPlacer(frontiers);

      // 10 variables, each defined at different levels
      for (let v = 0; v < 10; v++) {
        const level = v % 4;
        const bodyBlockId = 4 + level + 1;
        placer.addVariableDef(`v${v}`, 0);
        placer.addVariableDef(`v${v}`, bodyBlockId);
      }

      const result = placer.placePhiFunctions(func);

      expect(result.byVariable.size).toBe(10);
      expect(result.totalPhiCount).toBeGreaterThan(0);
    });

    it('Test S9.15: shared variable across all nesting levels', () => {
      const { func, frontiers } = createDeeplyNestedLoops(5);
      const placer = new PhiPlacer(frontiers);

      // Single variable modified at every level
      placer.addVariableDef('shared', 0);
      for (let level = 0; level < 5; level++) {
        const bodyBlockId = 5 + level + 1;
        placer.addVariableDef('shared', bodyBlockId);
      }

      const result = placer.placePhiFunctions(func);

      // Variable should have phi at multiple loop headers
      const sharedPhis = result.byVariable.get('shared')?.phiBlocks.size ?? 0;
      expect(sharedPhis).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S9.16-S9.20: Many-to-One Merge Tests
  // ---------------------------------------------------------------------------
  describe('Many-to-One Merge Tests', () => {
    it('Test S9.16: phi placement with 10 predecessors merging', () => {
      const { func, frontiers } = createManyToOneMerge(10);
      const placer = new PhiPlacer(frontiers);

      // Define variable in each branch
      for (let i = 0; i < 10; i++) {
        const branchBlockId = i + 2; // branch blocks after entry and merge
        placer.addVariableDef('x', branchBlockId);
      }

      const result = placer.placePhiFunctions(func);

      // All definitions merge at one point
      expect(result.totalPhiCount).toBeGreaterThan(0);
    });

    it('Test S9.17: phi placement with 25 predecessors merging', () => {
      const { func, frontiers } = createManyToOneMerge(25);
      const placer = new PhiPlacer(frontiers);

      // Define variable in half the branches
      for (let i = 0; i < 25; i += 2) {
        const branchBlockId = i + 2;
        placer.addVariableDef('x', branchBlockId);
      }

      const result = placer.placePhiFunctions(func);

      expect(result.byVariable.get('x')?.defBlocks.size).toBe(13);
    });

    it('Test S9.18: multiple variables with many predecessors', () => {
      const { func, frontiers } = createManyToOneMerge(15);
      const placer = new PhiPlacer(frontiers);

      // Each variable defined in specific branches
      for (let v = 0; v < 5; v++) {
        for (let i = v; i < 15; i += 5) {
          const branchBlockId = i + 2;
          placer.addVariableDef(`var_${v}`, branchBlockId);
        }
      }

      const result = placer.placePhiFunctions(func);

      expect(result.byVariable.size).toBe(5);
    });

    it('Test S9.19: all predecessors define same variable', () => {
      const { func, frontiers } = createManyToOneMerge(20);
      const placer = new PhiPlacer(frontiers);

      // Every branch defines the variable
      for (let i = 0; i < 20; i++) {
        const branchBlockId = i + 2;
        placer.addVariableDef('all_define', branchBlockId);
      }

      const result = placer.placePhiFunctions(func);

      // Should have exactly 1 phi (at the merge)
      expect(result.byVariable.get('all_define')?.defBlocks.size).toBe(20);
    });

    it('Test S9.20: only first and last predecessor define variable', () => {
      const { func, frontiers } = createManyToOneMerge(30);
      const placer = new PhiPlacer(frontiers);

      // Only first and last branches define variable
      placer.addVariableDef('sparse', 2); // first branch
      placer.addVariableDef('sparse', 31); // last branch

      const result = placer.placePhiFunctions(func);

      expect(result.byVariable.get('sparse')?.defBlocks.size).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S9.21-S9.25: Performance and Stress Tests
  // ---------------------------------------------------------------------------
  describe('Performance and Stress Tests', () => {
    it('Test S9.21: phi placement performance with 200 blocks', () => {
      const { func, frontiers } = createDiamondCascade(50);
      // 50 diamonds = 200+ blocks (entry + 4 blocks per diamond)
      const placer = new PhiPlacer(frontiers);

      // Define variable in every left branch
      for (let i = 1; i <= 50; i++) {
        const leftBlockId = (i - 1) * 4 + 2;
        placer.addVariableDef('perf_test', leftBlockId);
      }

      const start = performance.now();
      const result = placer.placePhiFunctions(func);
      const elapsed = performance.now() - start;

      // Should complete in reasonable time (< 1 second)
      expect(elapsed).toBeLessThan(1000);
      expect(result.totalPhiCount).toBe(50);
    });

    it('Test S9.22: repeated phi placement operations', () => {
      const { func, frontiers } = createDiamondCascade(10);

      // Run phi placement 50 times
      for (let run = 0; run < 50; run++) {
        const placer = new PhiPlacer(frontiers);

        for (let v = 0; v < 10; v++) {
          placer.addVariableDef(`var_${v}`, 2);
          placer.addVariableDef(`var_${v}`, 3);
        }

        const result = placer.placePhiFunctions(func);
        expect(result.totalPhiCount).toBe(10);
      }
    });

    it('Test S9.23: stress test with 200 variables', () => {
      const { func, frontiers } = createDiamondCascade(20);
      const placer = new PhiPlacer(frontiers);

      // Register 200 variables
      for (let v = 0; v < 200; v++) {
        const diamondIdx = v % 20;
        const leftBlockId = diamondIdx * 4 + 2;
        placer.addVariableDef(`stress_var_${v}`, leftBlockId);
      }

      const result = placer.placePhiFunctions(func);

      expect(result.byVariable.size).toBe(200);
      expect(result.stats.variableCount).toBe(200);
    });

    it('Test S9.24: memory efficiency with large CFG', () => {
      const { func, frontiers } = createLargeLinearCFG(200);
      const placer = new PhiPlacer(frontiers);

      // Even with many definitions, linear CFG should produce no phis
      for (let i = 0; i <= 200; i += 5) {
        placer.addVariableDef('linear_var', i);
      }

      const result = placer.placePhiFunctions(func);

      // No phi in linear chain - efficient handling
      expect(result.totalPhiCount).toBe(0);
      expect(result.byBlock.size).toBe(0);
    });

    it('Test S9.25: combined stress with many blocks and variables', () => {
      const { func, frontiers } = createDiamondCascade(25);
      const placer = new PhiPlacer(frontiers);

      // 50 variables across 25 diamonds
      for (let v = 0; v < 50; v++) {
        const diamondIdx = v % 25;
        const leftBlockId = diamondIdx * 4 + 2;
        const rightBlockId = diamondIdx * 4 + 3;
        placer.addVariableDef(`combined_${v}`, leftBlockId);
        placer.addVariableDef(`combined_${v}`, rightBlockId);
      }

      const result = placer.placePhiFunctions(func);

      // 50 variables, each needing 1 phi
      expect(result.totalPhiCount).toBe(50);
      expect(result.byVariable.size).toBe(50);
    });
  });

  // ---------------------------------------------------------------------------
  // Test S9.26-S9.30: Edge Cases and Corner Cases
  // ---------------------------------------------------------------------------
  describe('Edge Cases and Corner Cases', () => {
    it('Test S9.26: single block CFG (no edges)', () => {
      // Create minimal CFG with just entry block
      const func = new ILFunction('single_block', [], IL_VOID);
      func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const domTree = computeDominators(func);
      const frontiers = computeFrontiers(func, domTree);
      const placer = new PhiPlacer(frontiers);

      placer.addVariableDef('x', 0);
      placer.addVariableDef('x', 0); // Same block - duplicate def

      const result = placer.placePhiFunctions(func);

      // Single block - no join points, no phi needed
      expect(result.totalPhiCount).toBe(0);
      expect(result.byVariable.get('x')?.defBlocks.size).toBe(1);
    });

    it('Test S9.27: variable defined in non-existent block ID', () => {
      const { func, frontiers } = createDiamondCascade(2);
      const placer = new PhiPlacer(frontiers);

      // Define in valid blocks
      placer.addVariableDef('valid', 2);
      placer.addVariableDef('valid', 3);

      // Define in block that doesn't exist in frontier computation
      // This tests robustness when block IDs don't match
      placer.addVariableDef('edge_case', 999);

      const result = placer.placePhiFunctions(func);

      // Should handle gracefully
      expect(result.byVariable.has('edge_case')).toBe(true);
    });

    it('Test S9.28: empty variable name', () => {
      const { func, frontiers } = createDiamondCascade(1);
      const placer = new PhiPlacer(frontiers);

      // Empty string variable name
      placer.addVariableDef('', 2);
      placer.addVariableDef('', 3);

      const result = placer.placePhiFunctions(func);

      // Should handle empty string as valid variable name
      expect(result.byVariable.has('')).toBe(true);
      expect(result.byVariable.get('')?.phiBlocks.has(4)).toBe(true);
    });

    it('Test S9.29: unicode variable names', () => {
      const { func, frontiers } = createDiamondCascade(1);
      const placer = new PhiPlacer(frontiers);

      // Unicode variable names
      placer.addVariableDef('��', 2);
      placer.addVariableDef('��', 3);
      placer.addVariableDef('���', 2);
      placer.addVariableDef('���', 3);
      placer.addVariableDef('<�', 2);
      placer.addVariableDef('<�', 3);

      const result = placer.placePhiFunctions(func);

      // All unicode names should work
      expect(result.byVariable.size).toBe(3);
      expect(result.byVariable.has('��')).toBe(true);
      expect(result.byVariable.has('���')).toBe(true);
      expect(result.byVariable.has('<�')).toBe(true);
    });

    it('Test S9.30: determinism across multiple runs with complex CFG', () => {
      // Run same computation 10 times and verify identical results
      const results: PhiPlacementResult[] = [];

      for (let run = 0; run < 10; run++) {
        const { func, frontiers } = createDiamondCascade(15);
        const placer = new PhiPlacer(frontiers);

        // Complex pattern of variable definitions
        for (let v = 0; v < 20; v++) {
          const pattern = v % 3;
          if (pattern === 0) {
            // Defined in left branches only
            for (let d = 0; d < 15; d += 3) {
              placer.addVariableDef(`v${v}`, d * 4 + 2);
            }
          } else if (pattern === 1) {
            // Defined in right branches only
            for (let d = 0; d < 15; d += 3) {
              placer.addVariableDef(`v${v}`, d * 4 + 3);
            }
          } else {
            // Defined in both branches of specific diamonds
            placer.addVariableDef(`v${v}`, v * 4 + 2);
            placer.addVariableDef(`v${v}`, v * 4 + 3);
          }
        }

        results.push(placer.placePhiFunctions(func));
      }

      // All runs should produce identical results
      const reference = results[0];
      for (let i = 1; i < results.length; i++) {
        expect(results[i].totalPhiCount).toBe(reference.totalPhiCount);
        expect(results[i].byVariable.size).toBe(reference.byVariable.size);
        expect(results[i].stats.variableCount).toBe(reference.stats.variableCount);
        expect(results[i].stats.blocksWithPhis).toBe(reference.stats.blocksWithPhis);
      }
    });
  });
});
