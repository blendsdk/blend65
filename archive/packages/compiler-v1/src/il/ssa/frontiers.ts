/**
 * Dominance Frontier Computation for SSA Construction
 *
 * This module computes dominance frontiers, which determine where phi functions
 * need to be placed in SSA form. A block X is in the dominance frontier of block B
 * if B dominates a predecessor of X, but B does not strictly dominate X.
 *
 * **Key Concept:**
 * ```
 * DF(B) = {X | B dominates a predecessor of X, but B does not strictly dominate X}
 * ```
 *
 * **Why Dominance Frontiers Matter for SSA:**
 * - Variables assigned in block B may need phi functions at DF(B)
 * - The frontier represents where B's "control influence" ends
 * - Multiple definitions of a variable from different paths merge at frontiers
 *
 * **Example:**
 * ```
 *     entry (0)
 *       |
 *       v
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
 * - DF(left) = {merge} - left dominates itself, merge has left as predecessor
 *   but header (not left) dominates merge
 * - DF(right) = {merge} - same reasoning
 * - DF(header) = {} - header dominates merge, so merge is NOT in DF(header)
 *
 * **Algorithm:**
 * We use the efficient algorithm by Cooper, Harvey, and Kennedy:
 *
 * ```
 * for each block B in CFG:
 *   if |predecessors(B)| >= 2:
 *     for each predecessor P of B:
 *       runner = P
 *       while runner != idom(B):
 *         DF(runner) += B
 *         runner = idom(runner)
 * ```
 *
 * @module il/ssa/frontiers
 */

import type { ILFunction } from '../function.js';
import type { DominatorTree } from './dominators.js';

// =============================================================================
// DominanceFrontier Class
// =============================================================================

/**
 * Dominance frontier information for a function's CFG.
 *
 * The dominance frontier of a block B is the set of blocks where B's
 * "dominance ends" - blocks that have a predecessor dominated by B,
 * but are not themselves strictly dominated by B.
 *
 * This information is crucial for phi function placement:
 * - If variable V is defined in block B, a phi for V may be needed at each block in DF(B)
 *
 * **Properties:**
 * - DF(B) can be empty (especially for leaf nodes or linear chains)
 * - DF(B) typically includes join points where control flow merges
 * - Loop headers are often in the frontiers of blocks inside the loop
 *
 * @example
 * ```typescript
 * // Compute frontiers
 * const domTree = computeDominators(func);
 * const frontiers = computeFrontiers(func, domTree);
 *
 * // Find where phi functions are needed for a variable defined in block 2
 * const phiLocations = frontiers.getFrontier(2);
 * console.log(`Phi needed at: ${Array.from(phiLocations)}`);
 *
 * // Compute iterated dominance frontier (DF+)
 * const defBlocks = new Set([2, 3]); // Variable defined in blocks 2 and 3
 * const iteratedDF = frontiers.computeIteratedFrontier(defBlocks);
 * ```
 */
export class DominanceFrontier {
  /**
   * Map from block ID to its dominance frontier set.
   * Protected for testing access, but not meant for direct modification.
   */
  protected readonly frontierMap: Map<number, Set<number>>;

  /**
   * Reference to the dominator tree used for computation.
   * Useful for verification and debugging.
   */
  protected readonly dominatorTree: DominatorTree;

  /**
   * Creates a new DominanceFrontier with pre-computed frontier information.
   *
   * **Note:** This constructor is intended to be called by `computeFrontiers()`.
   * The frontiers are frozen after construction to ensure immutability.
   *
   * @param frontierMap - Map of block ID to dominance frontier set
   * @param dominatorTree - The dominator tree used for computation
   */
  constructor(frontierMap: Map<number, Set<number>>, dominatorTree: DominatorTree) {
    // Create defensive copies and freeze
    this.frontierMap = new Map();
    for (const [blockId, frontier] of frontierMap) {
      this.frontierMap.set(blockId, new Set(frontier));
    }

    this.dominatorTree = dominatorTree;

    // Freeze the frontier sets
    for (const frontier of this.frontierMap.values()) {
      Object.freeze(frontier);
    }

    // Freeze the map and object
    Object.freeze(this.frontierMap);
    Object.freeze(this);
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Gets the dominance frontier for a specific block.
   *
   * The frontier is the set of blocks where this block's dominance "ends".
   *
   * @param blockId - The block ID to query
   * @returns Set of block IDs in the dominance frontier, or empty set if not found
   *
   * @example
   * ```typescript
   * // For a diamond CFG, the branches have the merge in their frontier
   * frontiers.getFrontier(2); // Set{4} - left branch, merge is at frontier
   * frontiers.getFrontier(1); // Set{} - header dominates merge, empty frontier
   * ```
   */
  getFrontier(blockId: number): Set<number> {
    const frontier = this.frontierMap.get(blockId);

    // Return empty set for unknown blocks
    if (!frontier) {
      return new Set();
    }

    // Return a copy to prevent modification
    return new Set(frontier);
  }

  /**
   * Checks if a block is in another block's dominance frontier.
   *
   * @param dominator - The block whose frontier to check
   * @param target - The block to look for in the frontier
   * @returns true if target is in the dominance frontier of dominator
   *
   * @example
   * ```typescript
   * frontiers.isInFrontier(2, 4); // true - merge(4) is in left(2)'s frontier
   * frontiers.isInFrontier(1, 4); // false - merge(4) is NOT in header(1)'s frontier
   * ```
   */
  isInFrontier(dominator: number, target: number): boolean {
    const frontier = this.frontierMap.get(dominator);
    return frontier?.has(target) ?? false;
  }

  /**
   * Gets all block IDs that have the specified block in their frontier.
   *
   * This is the "reverse" query - find all blocks B where target ∈ DF(B).
   *
   * @param target - The block to find in frontiers
   * @returns Set of block IDs that have target in their frontier
   *
   * @example
   * ```typescript
   * // Who has merge(4) in their frontier?
   * frontiers.getBlocksWithFrontier(4); // Set{2, 3} - left and right branches
   * ```
   */
  getBlocksWithFrontier(target: number): Set<number> {
    const result = new Set<number>();

    for (const [blockId, frontier] of this.frontierMap) {
      if (frontier.has(target)) {
        result.add(blockId);
      }
    }

    return result;
  }

  /**
   * Computes the iterated dominance frontier (DF+) for a set of blocks.
   *
   * The iterated frontier is the closure of the dominance frontier operation:
   * - Start with DF(all input blocks)
   * - Add DF(blocks in frontier)
   * - Repeat until no new blocks are added
   *
   * This is where ALL phi functions may be needed for a variable defined
   * in the input blocks.
   *
   * **Algorithm:**
   * ```
   * DF+(S) = limit of: DF_i(S)
   * where DF_0(S) = S
   * and   DF_{i+1}(S) = DF_i(S) ∪ DF(DF_i(S))
   * ```
   *
   * @param defBlocks - Set of blocks where a variable is defined
   * @returns Set of all blocks where phi functions may be needed
   *
   * @example
   * ```typescript
   * // Variable defined in blocks 2 and 3
   * const defBlocks = new Set([2, 3]);
   * const phiBlocks = frontiers.computeIteratedFrontier(defBlocks);
   * // phiBlocks contains all blocks needing phi functions for this variable
   * ```
   */
  computeIteratedFrontier(defBlocks: Set<number>): Set<number> {
    const result = new Set<number>();
    const worklist = new Set(defBlocks);
    const processed = new Set<number>();

    while (worklist.size > 0) {
      // Get next block from worklist
      const blockId = worklist.values().next().value!;
      worklist.delete(blockId);

      if (processed.has(blockId)) {
        continue;
      }
      processed.add(blockId);

      // Add frontier of this block to result
      const frontier = this.getFrontier(blockId);
      for (const frontierBlockId of frontier) {
        result.add(frontierBlockId);

        // If this frontier block hasn't been processed, add to worklist
        // This propagates the frontier computation
        if (!processed.has(frontierBlockId)) {
          worklist.add(frontierBlockId);
        }
      }
    }

    return result;
  }

  /**
   * Gets the total number of blocks with frontier information.
   *
   * @returns Number of blocks
   */
  getBlockCount(): number {
    return this.frontierMap.size;
  }

  /**
   * Gets all block IDs with frontier information.
   *
   * @returns Array of block IDs
   */
  getAllBlockIds(): number[] {
    return Array.from(this.frontierMap.keys());
  }

  /**
   * Gets the total size of all frontiers combined.
   *
   * Useful for statistics and debugging.
   *
   * @returns Total number of frontier entries across all blocks
   */
  getTotalFrontierSize(): number {
    let total = 0;
    for (const frontier of this.frontierMap.values()) {
      total += frontier.size;
    }
    return total;
  }

  /**
   * Checks if all frontiers are empty.
   *
   * This is true for linear CFGs with no branches.
   *
   * @returns true if all blocks have empty frontiers
   */
  hasNoFrontiers(): boolean {
    for (const frontier of this.frontierMap.values()) {
      if (frontier.size > 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Gets the reference to the dominator tree.
   *
   * @returns The DominatorTree used for frontier computation
   */
  getDominatorTree(): DominatorTree {
    return this.dominatorTree;
  }

  // ===========================================================================
  // Debugging
  // ===========================================================================

  /**
   * Returns a string representation of the dominance frontiers.
   *
   * @returns Human-readable frontier representation
   */
  toString(): string {
    const lines: string[] = ['DominanceFrontier:'];

    // Sort by block ID for consistent output
    const sortedIds = Array.from(this.frontierMap.keys()).sort((a, b) => a - b);

    for (const blockId of sortedIds) {
      const frontier = this.frontierMap.get(blockId)!;
      const frontierStr =
        frontier.size > 0
          ? `{${Array.from(frontier)
              .sort((a, b) => a - b)
              .join(', ')}}`
          : '{}';
      lines.push(`  DF(block${blockId}) = ${frontierStr}`);
    }

    return lines.join('\n');
  }
}

// =============================================================================
// Computation Functions
// =============================================================================

/**
 * Computes dominance frontiers for all blocks in a function.
 *
 * This uses the efficient algorithm by Cooper, Harvey, and Kennedy (2001):
 *
 * **Algorithm:**
 * ```
 * for each block B with >= 2 predecessors:
 *   for each predecessor P of B:
 *     runner = P
 *     while runner != idom(B):
 *       DF(runner) += B
 *       runner = idom(runner)
 * ```
 *
 * **Key Insight:**
 * The algorithm walks up the dominator tree from each predecessor of a join point.
 * All blocks on this path (except the idom of the join) have the join in their frontier.
 *
 * **Why This Works:**
 * - If B has multiple predecessors, it's a join point
 * - Each predecessor P dominates itself (and maybe more)
 * - Walking up from P, we find all blocks that dominate P but don't strictly dominate B
 * - These blocks have B in their frontier (their dominance "ends" at B)
 *
 * **Performance:**
 * - Time: O(|edges| × |blocks|) worst case, but typically much better
 * - Space: O(|blocks|²) worst case for frontier storage
 *
 * @param func - The IL function to analyze
 * @param domTree - Pre-computed dominator tree for the function
 * @returns DominanceFrontier with computed frontiers for all blocks
 *
 * @example
 * ```typescript
 * // First compute dominator tree
 * const domTree = computeDominators(func);
 *
 * // Then compute frontiers
 * const frontiers = computeFrontiers(func, domTree);
 *
 * // Use for phi placement
 * const leftBranchFrontier = frontiers.getFrontier(2);
 * ```
 */
export function computeFrontiers(func: ILFunction, domTree: DominatorTree): DominanceFrontier {
  // Initialize empty frontier for each block in dominator tree
  const frontierMap = new Map<number, Set<number>>();

  for (const blockId of domTree.getAllBlockIds()) {
    frontierMap.set(blockId, new Set());
  }

  // Get all blocks from function for predecessor access
  const blocks = func.getBlocks();

  // For each block B with >= 2 predecessors (join points)
  for (const block of blocks) {
    const blockId = block.id;
    const predecessors = block.getPredecessors();

    // Skip if not a join point (< 2 predecessors)
    if (predecessors.length < 2) {
      continue;
    }

    // Get immediate dominator of this join point
    const idomOfBlock = domTree.getImmediateDominator(blockId);

    // For each predecessor P
    for (const pred of predecessors) {
      const predId = pred.id;

      // Walk up dominator tree from P until we reach idom(B)
      let runner = predId;

      // Safety limit to prevent infinite loops in pathological cases
      const maxIterations = domTree.getBlockCount() + 1;
      let iterations = 0;

      while (runner !== idomOfBlock && iterations < maxIterations) {
        // Add B to DF(runner)
        const runnerFrontier = frontierMap.get(runner);
        if (runnerFrontier) {
          runnerFrontier.add(blockId);
        }

        // Move up to runner's immediate dominator
        const runnerIdom = domTree.getImmediateDominator(runner);

        // If runner has no dominator (entry block), stop
        if (runnerIdom === undefined || runnerIdom === -1) {
          break;
        }

        runner = runnerIdom;
        iterations++;
      }
    }
  }

  return new DominanceFrontier(frontierMap, domTree);
}