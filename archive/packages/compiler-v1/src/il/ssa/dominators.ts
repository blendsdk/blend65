/**
 * Dominator Tree - Core data structures for SSA construction
 *
 * This module provides the types and interfaces for dominator tree computation.
 * A dominator tree is fundamental to SSA construction because it determines:
 *
 * 1. **Where phi functions are needed** - At dominance frontiers
 * 2. **Variable versioning order** - Walk dominator tree in preorder
 * 3. **Definition dominance checking** - All uses must be dominated by their definition
 *
 * **Key Concepts:**
 * - Block A **dominates** Block B if every path from entry to B goes through A
 * - Block A **strictly dominates** B if A dominates B and A ≠ B
 * - **Immediate dominator** of B is the closest strict dominator
 * - Entry block dominates all reachable blocks
 *
 * **Example CFG:**
 * ```
 *     entry (block 0)
 *       |
 *       v
 *     block 1
 *      / \
 *     v   v
 *   b2    b3
 *     \  /
 *      v
 *     b4 (exit)
 * ```
 *
 * **Dominator Tree:**
 * - entry dominates all blocks
 * - block 1's immediate dominator is entry
 * - block 2 and 3's immediate dominator is block 1
 * - block 4's immediate dominator is block 1 (not b2 or b3!)
 *
 * @module il/ssa/dominators
 */

import type { ILFunction } from '../function.js';

// =============================================================================
// Interfaces
// =============================================================================

/**
 * Information about a block's dominator relationships.
 *
 * This interface captures all dominator-related information for a single basic block.
 * It is used to build and query the dominator tree efficiently.
 *
 * @example
 * ```typescript
 * // For block 4 in the example above:
 * const info: DominatorInfo = {
 *   blockId: 4,
 *   immediateDominator: 1,  // block 1 is the closest dominator
 *   dominates: new Set([4]), // block 4 only dominates itself
 *   depth: 2  // entry(0) -> block1(1) -> block4(2)
 * };
 * ```
 */
export interface DominatorInfo {
  /**
   * The unique identifier of this block.
   * Corresponds to BasicBlock.id in the CFG.
   */
  blockId: number;

  /**
   * The block ID of the immediate dominator.
   *
   * The immediate dominator is the closest strict dominator in the dominator tree.
   * - For the entry block, this is -1 (no dominator)
   * - For all other reachable blocks, this is the parent in the dominator tree
   *
   * **Why -1 for entry?**
   * The entry block has no dominator because there is no block that
   * dominates it (you can't have a block on all paths to the entry point).
   */
  immediateDominator: number;

  /**
   * Set of block IDs that this block dominates.
   *
   * A block always dominates itself (reflexive property).
   * This set enables efficient "does A dominate B?" queries.
   *
   * **Note:** This is the full dominator set, not just immediate children.
   */
  dominates: Set<number>;

  /**
   * Depth in the dominator tree.
   *
   * - Entry block has depth 0
   * - Each level down adds 1
   * - Useful for quickly computing lowest common ancestors
   */
  depth: number;
}

// =============================================================================
// DominatorTree Class
// =============================================================================

/**
 * Dominator tree for a function's Control Flow Graph.
 *
 * The dominator tree is a tree where:
 * - The root is the entry block
 * - Each node's parent is its immediate dominator
 * - The tree captures the dominance relationships for all blocks
 *
 * This class provides efficient queries for dominance relationships,
 * which are essential for phi function placement and variable renaming.
 *
 * **Construction:**
 * Use `computeDominators(func)` to build a DominatorTree from an ILFunction.
 * This class is immutable after construction to ensure consistency.
 *
 * @example
 * ```typescript
 * // Build dominator tree from function
 * const domTree = computeDominators(ilFunction);
 *
 * // Query dominance relationships
 * domTree.getImmediateDominator(4); // Returns 1
 * domTree.dominates(0, 4);          // Returns true (entry dominates all)
 * domTree.dominates(2, 4);          // Returns false (b2 does not dominate b4)
 * domTree.getDepth(4);              // Returns 2
 * ```
 */
export class DominatorTree {
  /**
   * Map from block ID to its dominator information.
   * Protected for testing access, but not meant for direct modification.
   */
  protected readonly dominatorMap: Map<number, DominatorInfo>;

  /**
   * The entry block ID (root of the dominator tree).
   */
  protected readonly entryBlockId: number;

  /**
   * Creates a new DominatorTree with pre-computed dominator information.
   *
   * **Note:** This constructor is intended to be called by `computeDominators()`.
   * The tree is frozen after construction to ensure immutability.
   *
   * @param dominatorMap - Map of block ID to DominatorInfo
   * @param entryBlockId - The ID of the entry block (root of tree)
   */
  constructor(dominatorMap: Map<number, DominatorInfo>, entryBlockId: number) {
    // Freeze the map to ensure immutability after construction
    this.dominatorMap = new Map(dominatorMap);
    this.entryBlockId = entryBlockId;

    // Freeze the DominatorInfo objects to prevent modification
    for (const info of this.dominatorMap.values()) {
      Object.freeze(info);
    }

    // Freeze the tree itself
    Object.freeze(this.dominatorMap);
    Object.freeze(this);
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Gets the immediate dominator of a block.
   *
   * The immediate dominator is the closest strict dominator in the tree.
   *
   * @param blockId - The block ID to query
   * @returns The immediate dominator block ID, or undefined if block not found
   *
   * @example
   * ```typescript
   * // For entry block
   * tree.getImmediateDominator(0); // Returns -1 (no dominator)
   *
   * // For regular block
   * tree.getImmediateDominator(4); // Returns 1 (block 1 is idom)
   *
   * // For unknown block
   * tree.getImmediateDominator(999); // Returns undefined
   * ```
   */
  getImmediateDominator(blockId: number): number | undefined {
    const info = this.dominatorMap.get(blockId);
    return info?.immediateDominator;
  }

  /**
   * Checks if block A dominates block B.
   *
   * Block A dominates B if every path from entry to B goes through A.
   * Note: A block dominates itself (reflexive property).
   *
   * @param a - The potential dominator block ID
   * @param b - The block ID to check
   * @returns true if A dominates B, false otherwise
   *
   * @example
   * ```typescript
   * // Entry dominates all
   * tree.dominates(0, 4); // true
   *
   * // A block dominates itself
   * tree.dominates(2, 2); // true
   *
   * // Non-dominator
   * tree.dominates(2, 3); // false (parallel branches)
   *
   * // Unknown blocks
   * tree.dominates(999, 0); // false
   * ```
   */
  dominates(a: number, b: number): boolean {
    const infoA = this.dominatorMap.get(a);

    // If block A is not in the tree, it cannot dominate anything
    if (!infoA) {
      return false;
    }

    // Check if B is in A's dominated set
    return infoA.dominates.has(b);
  }

  /**
   * Checks if block A strictly dominates block B.
   *
   * A strictly dominates B if A dominates B and A ≠ B.
   *
   * @param a - The potential strict dominator block ID
   * @param b - The block ID to check
   * @returns true if A strictly dominates B, false otherwise
   */
  strictlyDominates(a: number, b: number): boolean {
    return a !== b && this.dominates(a, b);
  }

  /**
   * Gets all blocks dominated by a specific block.
   *
   * This includes the block itself (a block dominates itself).
   *
   * @param blockId - The block ID to query
   * @returns Set of block IDs dominated by this block, or empty set if not found
   *
   * @example
   * ```typescript
   * // Entry dominates all reachable blocks
   * tree.getDominatedBlocks(0); // Set{0, 1, 2, 3, 4}
   *
   * // Leaf block only dominates itself
   * tree.getDominatedBlocks(4); // Set{4}
   *
   * // Unknown block
   * tree.getDominatedBlocks(999); // Set{} (empty)
   * ```
   */
  getDominatedBlocks(blockId: number): Set<number> {
    const info = this.dominatorMap.get(blockId);

    // Return empty set for unknown blocks
    if (!info) {
      return new Set();
    }

    // Return a copy to prevent modification
    return new Set(info.dominates);
  }

  /**
   * Gets the immediate children of a block in the dominator tree.
   *
   * These are blocks whose immediate dominator is the given block.
   *
   * @param blockId - The block ID to query
   * @returns Array of block IDs that are immediate children in the dom tree
   */
  getImmediatelyDominatedBlocks(blockId: number): number[] {
    const children: number[] = [];

    for (const [id, info] of this.dominatorMap) {
      if (info.immediateDominator === blockId && id !== blockId) {
        children.push(id);
      }
    }

    return children;
  }

  /**
   * Gets the depth of a block in the dominator tree.
   *
   * - Entry block has depth 0
   * - Each level down in the tree adds 1
   *
   * @param blockId - The block ID to query
   * @returns Depth in the dominator tree, or -1 if block not found
   *
   * @example
   * ```typescript
   * tree.getDepth(0); // 0 (entry block)
   * tree.getDepth(1); // 1
   * tree.getDepth(4); // 2
   * tree.getDepth(999); // -1 (unknown)
   * ```
   */
  getDepth(blockId: number): number {
    const info = this.dominatorMap.get(blockId);
    return info?.depth ?? -1;
  }

  /**
   * Gets the entry block ID (root of the dominator tree).
   *
   * @returns The entry block ID
   */
  getEntryBlockId(): number {
    return this.entryBlockId;
  }

  /**
   * Gets all block IDs in the dominator tree.
   *
   * @returns Array of all block IDs
   */
  getAllBlockIds(): number[] {
    return Array.from(this.dominatorMap.keys());
  }

  /**
   * Gets the total number of blocks in the dominator tree.
   *
   * @returns Number of blocks
   */
  getBlockCount(): number {
    return this.dominatorMap.size;
  }

  /**
   * Gets the DominatorInfo for a specific block.
   *
   * @param blockId - The block ID to query
   * @returns DominatorInfo or undefined if not found
   */
  getInfo(blockId: number): DominatorInfo | undefined {
    return this.dominatorMap.get(blockId);
  }

  // ===========================================================================
  // Tree Traversal
  // ===========================================================================

  /**
   * Traverses the dominator tree in preorder (parent before children).
   *
   * This is the order needed for SSA variable renaming, as it ensures
   * that definitions are processed before their uses in dominated blocks.
   *
   * @returns Array of block IDs in preorder
   */
  getPreorder(): number[] {
    const result: number[] = [];
    const visited = new Set<number>();

    /**
     * Recursive helper for preorder traversal.
     * @param blockId - Current block ID
     */
    const visit = (blockId: number): void => {
      if (visited.has(blockId)) {
        return;
      }

      visited.add(blockId);
      result.push(blockId);

      // Visit children in the dominator tree
      for (const childId of this.getImmediatelyDominatedBlocks(blockId)) {
        visit(childId);
      }
    };

    // Start from entry block
    visit(this.entryBlockId);

    return result;
  }

  /**
   * Traverses the dominator tree in postorder (children before parent).
   *
   * Useful for bottom-up analysis where child results are needed first.
   *
   * @returns Array of block IDs in postorder
   */
  getPostorder(): number[] {
    const result: number[] = [];
    const visited = new Set<number>();

    /**
     * Recursive helper for postorder traversal.
     * @param blockId - Current block ID
     */
    const visit = (blockId: number): void => {
      if (visited.has(blockId)) {
        return;
      }

      visited.add(blockId);

      // Visit children first
      for (const childId of this.getImmediatelyDominatedBlocks(blockId)) {
        visit(childId);
      }

      // Then add this block
      result.push(blockId);
    };

    visit(this.entryBlockId);

    return result;
  }

  // ===========================================================================
  // Debugging
  // ===========================================================================

  /**
   * Returns a string representation of the dominator tree.
   *
   * @returns Human-readable tree representation
   */
  toString(): string {
    const lines: string[] = ['DominatorTree:'];

    /**
     * Helper to format a block with indentation.
     * @param blockId - Block ID
     * @param indent - Indentation level
     */
    const formatBlock = (blockId: number, indent: number): void => {
      const info = this.dominatorMap.get(blockId);
      if (!info) return;

      const prefix = '  '.repeat(indent);
      lines.push(`${prefix}block${blockId} (depth=${info.depth})`);

      // Format children
      for (const childId of this.getImmediatelyDominatedBlocks(blockId)) {
        formatBlock(childId, indent + 1);
      }
    };

    formatBlock(this.entryBlockId, 1);

    return lines.join('\n');
  }
}

// =============================================================================
// Computation Functions
// =============================================================================

/**
 * Computes the intersection of multiple sets.
 *
 * Returns a new set containing only elements present in ALL input sets.
 * If no sets are provided, returns an empty set.
 *
 * @param sets - Array of sets to intersect
 * @returns Set containing elements in all input sets
 *
 * @example
 * ```typescript
 * const result = computeIntersection([
 *   new Set([1, 2, 3]),
 *   new Set([2, 3, 4]),
 *   new Set([3, 4, 5])
 * ]);
 * // result = Set{3}
 * ```
 */
export function computeIntersection(sets: Set<number>[]): Set<number> {
  if (sets.length === 0) {
    return new Set();
  }

  if (sets.length === 1) {
    return new Set(sets[0]);
  }

  // Start with the first set
  const result = new Set(sets[0]);

  // Intersect with each subsequent set
  for (let i = 1; i < sets.length; i++) {
    for (const element of result) {
      if (!sets[i].has(element)) {
        result.delete(element);
      }
    }
  }

  return result;
}

/**
 * Computes the depth of each block in the dominator tree.
 *
 * Entry block has depth 0, each level down adds 1.
 *
 * @param entryBlockId - ID of the entry block
 * @param idomMap - Map from block ID to immediate dominator ID
 * @param reachableBlocks - Set of reachable block IDs
 * @returns Map from block ID to depth
 */
function computeDepths(
  entryBlockId: number,
  idomMap: Map<number, number>,
  reachableBlocks: Set<number>,
): Map<number, number> {
  const depths = new Map<number, number>();

  // Entry block has depth 0
  depths.set(entryBlockId, 0);

  // Compute depths for all other blocks
  // We need to walk up the dominator tree to find depth
  for (const blockId of reachableBlocks) {
    if (blockId === entryBlockId) {
      continue;
    }

    // Walk up the dominator tree counting steps
    let depth = 0;
    let current = blockId;

    while (current !== entryBlockId) {
      const idom = idomMap.get(current);
      if (idom === undefined || idom === -1) {
        // No dominator found - this shouldn't happen for reachable blocks
        break;
      }
      depth++;
      current = idom;
    }

    depths.set(blockId, depth);
  }

  return depths;
}

/**
 * Computes which blocks each block dominates.
 *
 * A block dominates itself and all blocks in its subtree.
 *
 * @param entryBlockId - ID of the entry block
 * @param idomMap - Map from block ID to immediate dominator ID
 * @param reachableBlocks - Set of reachable block IDs
 * @returns Map from block ID to set of dominated block IDs
 */
function computeDominatedSets(
  entryBlockId: number,
  idomMap: Map<number, number>,
  reachableBlocks: Set<number>,
): Map<number, Set<number>> {
  // Initialize: each block dominates at least itself
  const dominatedSets = new Map<number, Set<number>>();
  for (const blockId of reachableBlocks) {
    dominatedSets.set(blockId, new Set([blockId]));
  }

  // For each block, walk up the dominator tree and add it to each ancestor's dominated set
  // This is correct because A dominates B if A is on the path from entry to B's idom
  for (const blockId of reachableBlocks) {
    if (blockId === entryBlockId) {
      continue;
    }

    // Walk up the dominator tree
    let current = idomMap.get(blockId);
    while (current !== undefined && current !== -1) {
      const dominatedSet = dominatedSets.get(current);
      if (dominatedSet) {
        dominatedSet.add(blockId);
      }
      // Stop at entry block - its idom is itself, which would cause infinite loop
      if (current === entryBlockId) {
        break;
      }
      current = idomMap.get(current);
    }
  }

  return dominatedSets;
}

/**
 * Computes the dominator tree for a function.
 *
 * This function uses the Cooper-Harvey-Kennedy algorithm (already implemented
 * in ILFunction.computeDominators()) to compute immediate dominators, then
 * builds the complete DominatorTree structure with:
 * - Immediate dominator for each block
 * - Full set of dominated blocks for each block
 * - Depth in the dominator tree
 *
 * **Algorithm:**
 * 1. Get immediate dominators from ILFunction.computeDominators()
 * 2. Filter to only reachable blocks
 * 3. Compute dominator tree depths
 * 4. Compute dominated sets (transitive closure)
 * 5. Build DominatorTree with all information
 *
 * **Performance:**
 * - Time: O(n²) where n = number of blocks
 * - Space: O(n²) for dominated sets
 *
 * @param func - The IL function to analyze
 * @returns DominatorTree with computed dominance relationships
 *
 * @example
 * ```typescript
 * const domTree = computeDominators(ilFunction);
 *
 * // Now use the tree for SSA construction
 * const preorder = domTree.getPreorder();
 * for (const blockId of preorder) {
 *   // Process in dominator tree order
 * }
 * ```
 */
export function computeDominators(func: ILFunction): DominatorTree {
  const entryBlockId = func.getEntryBlock().id;

  // Step 1: Get immediate dominators using existing algorithm
  const idomMap = func.computeDominators();

  // Step 2: Get reachable blocks (only include reachable blocks in dominator tree)
  const reachableBlocks = func.getReachableBlocks();

  // Handle edge case: function with no reachable blocks (shouldn't happen)
  if (reachableBlocks.size === 0) {
    return new DominatorTree(new Map(), entryBlockId);
  }

  // Step 3: Compute depths in dominator tree
  const depths = computeDepths(entryBlockId, idomMap, reachableBlocks);

  // Step 4: Compute dominated sets (which blocks each block dominates)
  const dominatedSets = computeDominatedSets(entryBlockId, idomMap, reachableBlocks);

  // Step 5: Build DominatorInfo for each reachable block
  const dominatorMap = new Map<number, DominatorInfo>();

  for (const blockId of reachableBlocks) {
    const immediateDominator = blockId === entryBlockId ? -1 : (idomMap.get(blockId) ?? -1);
    const dominates = dominatedSets.get(blockId) ?? new Set([blockId]);
    const depth = depths.get(blockId) ?? 0;

    const info: DominatorInfo = {
      blockId,
      immediateDominator,
      dominates,
      depth,
    };

    dominatorMap.set(blockId, info);
  }

  return new DominatorTree(dominatorMap, entryBlockId);
}